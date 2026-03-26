/**
 * TASK-0036: 配管口径選定 — 純粋計算モジュール
 *
 * 【機能概要】: AHU冷房能力から冷水配管口径を自動選定する純粋計算関数群
 * 【実装方針】: 全て副作用なしの純粋関数として実装。Three.js不使用（Core システムルール準拠）
 * 【テスト対応】: pipe-sizing-system.test.ts の全19テストケースを通すための実装
 * 🔵 信頼性レベル: REQ-1103, REQ-1104, PRDセクション15.7に明示
 */

// 【定数定義】: 標準口径表データのインポート
// standard-pipe-sizes.json に定義された 15A ~ 200A の12サイズを参照する
import standardPipeSizes from '../../data/standard-pipe-sizes.json'

// ============================================================================
// 型定義
// ============================================================================

/**
 * 【型定義】: 標準口径表エントリの型
 * 🔵 信頼性レベル: standard-pipe-sizes.json の構造に明示
 */
type PipeSizeEntry = {
  nominalSize: number // 呼び径 (A)
  outerDiameter: number // 外径 (mm)
  innerDiameter: number // 内径 (mm)
}

/**
 * 【型定義】: 流速制約検証結果
 * 【改善内容】: outerDiameterMm を追加し、selectPipeSize での再検索を不要に
 * 🔵 信頼性レベル: RED-PHASE テスト定義に明示
 */
type VelocityConstraintResult = {
  status: 'ok' | 'warning' | 'size-limit' // 【状態】: 制約充足・警告・サイズ限界
  nominalSize: number // 【口径】: 選定された呼び径 (A)
  innerDiameterM: number // 【内径】: 選定口径の内径 (m)
  outerDiameterMm: number // 【外径】: 選定口径の外径 (mm) — selectPipeSize での再検索を排除
  velocity: number // 【流速】: 実流速 (m/s)
}

/**
 * 【型定義】: 統合口径選定結果
 * 【改善内容】: export を追加し @pascal-app/core 経由で他パッケージから利用可能に
 * 🔵 信頼性レベル: REQ-1103, REQ-1104に明示
 */
export type SelectPipeSizeResult = {
  nominalSize: number | null // 【口径】: 選定呼び径 (A)、ゼロ流量時null
  outerDiameter: number | null // 【外径】: 選定口径の外径 (mm)
  calcResult: {
    velocity: number // 【実流速】: m/s
    pressureDrop: number // 【圧損】: kPa
  } | null
}

// ============================================================================
// 定数定義
// ============================================================================

/**
 * 【定数定義】: 配管口径選定のデフォルトパラメータ
 * 【実装方針】: 要件定義2.2の計算パラメータ表に定義された値を使用
 * 🔵 信頼性レベル: REQ-1103, REQ-1104, PRDセクション15.7に明示
 */
export const PIPE_SIZING_DEFAULTS = {
  cp: 4.186, // 【水の比熱】: kJ/(kg*K) — 物理定数
  rho: 1000, // 【水の密度】: kg/m3 — 物理定数
  deltaT: 5, // 【冷水温度差】: K — デフォルト5K (PRDセクション15.7)
  targetVelocity: 1.5, // 【目標流速】: m/s — 口径算出時の基準流速 (REQ-1103)
  minVelocity: 1.0, // 【流速下限】: m/s — 流速制約下限 (REQ-1103)
  maxVelocity: 2.0, // 【流速上限】: m/s — 流速制約上限 (REQ-1103)
  lambda: 0.02, // 【摩擦係数】: 鋼管概算値 (REQ-1104)
  fittingFactor: 0.5, // 【継手等価長さ係数】: 直管長の50% (REQ-1104)
} as const

// 【定数】: 標準口径表をキャッシュ（呼び径の昇順でソート済み前提）
const PIPE_SIZES: PipeSizeEntry[] = standardPipeSizes as PipeSizeEntry[]

// ============================================================================
// 計算関数
// ============================================================================

/**
 * 【機能概要】: AHU冷房能力から冷水体積流量を算出する
 * 【実装方針】: Q = P / (cp * ΔT * ρ) の公式に従い算出
 *   - P: 冷房能力 (kW)
 *   - cp: 水の比熱 (kJ/(kg*K))
 *   - ΔT: 冷水往還温度差 (K)
 *   - ρ: 水の密度 (kg/m3)
 *   - Q: 体積流量 (m3/s)
 * 【テスト対応】: TC-001, TC-009, TC-011, TC-023 を通すための実装
 * 🔵 信頼性レベル: REQ-1103, PRDセクション15.7に明示
 * @param coolingCapacity - AHU冷房能力 (kW)
 * @param deltaT - 冷水往還温度差 (K)、デフォルト5K
 * @returns 冷水体積流量 (m3/s)
 */
export function calculateFlowRate(
  coolingCapacity: number,
  deltaT: number = PIPE_SIZING_DEFAULTS.deltaT,
): number {
  // 【入力値検証】: 冷房能力ゼロ以下の場合はゼロを返す（EDGE-103対応）
  if (coolingCapacity <= 0) {
    return 0 // 【ゼロ処理】: ゼロ除算防止 + EDGE-103ケース対応
  }

  // 【流量計算】: Q = P(kW) / (cp * ΔT * ρ) — 単位: m3/s
  // 注: cp の単位が kJ/(kg*K)、P が kW なので 1000 で変換不要（kJ/s = kW のため）
  const flowRate = coolingCapacity / (PIPE_SIZING_DEFAULTS.cp * deltaT * PIPE_SIZING_DEFAULTS.rho)

  return flowRate
}

/**
 * 【機能概要】: 流量と目標流速から理論口径（mm）を算出する
 * 【実装方針】: 円形断面の流速公式から逆算
 *   v = Q / A, A = π * (d/2)^2
 *   → d = sqrt(4 * Q / (π * v)) → mm変換
 * 【テスト対応】: TC-002 を通すための実装
 * 🔵 信頼性レベル: REQ-1103「径算出: diameter = sqrt(4Q / πv)」に明示
 * @param flowRate - 体積流量 (m3/s)
 * @param targetVelocity - 目標流速 (m/s)
 * @returns 理論口径 (mm)
 */
export function calculateTheoreticalDiameter(flowRate: number, targetVelocity: number): number {
  // 【口径計算】: d = sqrt(4 * Q / (π * v)) をmm単位で返す
  const diameterM = Math.sqrt((4 * flowRate) / (Math.PI * targetVelocity))

  return diameterM * 1000 // 【単位変換】: m → mm
}

/**
 * 【機能概要】: 理論口径から標準口径表にスナップする
 * 【実装方針】: standard-pipe-sizes.json を参照して
 *   理論口径以上の内径を持つ最小標準口径を選択する
 *   - 理論口径が最小口径以下 → 最小口径(15A)
 *   - 理論口径が最大口径超過 → 最大口径(200A)
 * 【テスト対応】: TC-003, TC-004, TC-016, TC-017 を通すための実装
 * 🔵 信頼性レベル: REQ-1103「標準口径表へのスナップ」に明示
 * @param theoreticalDiameterMm - 理論口径 (mm)
 * @returns 選定された標準口径エントリ
 */
export function snapToStandardSize(theoreticalDiameterMm: number): PipeSizeEntry {
  // 【スナップ処理】: 理論口径以上の内径を持つ最小口径を検索
  const found = PIPE_SIZES.find((entry) => entry.innerDiameter >= theoreticalDiameterMm)

  if (found) {
    return found // 【正常ケース】: 適合する標準口径が見つかった
  }

  // 【上限超過】: 最大口径（200A）を返す（TC-017対応）
  return PIPE_SIZES[PIPE_SIZES.length - 1]!
}

/**
 * 【機能概要】: 流速範囲制約を検証し、必要に応じて口径を自動調整する
 * 【実装方針】:
 *   1. 現在口径で実流速を計算
 *   2. 1.0 <= v <= 2.0 の範囲チェック
 *   3. v > 2.0 → 1サイズ上げて再検証
 *   4. v < 1.0 → 1サイズ下げて再検証
 *   5. 最大/最小口径に到達したら 'size-limit' で返す
 * 【テスト対応】: TC-005, TC-020, TC-021, TC-012, TC-013 を通すための実装
 * 🔵 信頼性レベル: REQ-1103「流速範囲制約 1.0~2.0 m/s」に明示
 * @param nominalSize - 初期呼び径 (A)
 * @param innerDiameterM - 初期内径 (m)
 * @param flowRate - 体積流量 (m3/s)
 * @returns 検証・調整後の流速制約結果
 */
export function validateVelocityConstraint(
  nominalSize: number,
  innerDiameterM: number,
  flowRate: number,
): VelocityConstraintResult {
  // 【初期設定】: 現在の口径インデックスを標準口径表から特定
  let currentIdx = PIPE_SIZES.findIndex((e) => e.nominalSize === nominalSize)

  // 【インデックス未検出対策】: 最も近い口径インデックスにフォールバック
  if (currentIdx === -1) {
    currentIdx = PIPE_SIZES.findIndex((e) => e.nominalSize >= nominalSize)
    if (currentIdx === -1) currentIdx = PIPE_SIZES.length - 1
  }

  // 【反復調整ループ】: 流速制約を満たすまで口径を調整（最大ループ数でガード）
  const maxIterations = PIPE_SIZES.length
  for (let iter = 0; iter < maxIterations; iter++) {
    const entry = PIPE_SIZES[currentIdx]!
    const d = entry.innerDiameter / 1000 // 【単位変換】: mm → m
    const area = Math.PI * (d / 2) ** 2 // 【断面積】: m2
    const velocity = flowRate / area // 【実流速】: m/s

    if (
      velocity >= PIPE_SIZING_DEFAULTS.minVelocity &&
      velocity <= PIPE_SIZING_DEFAULTS.maxVelocity
    ) {
      // 【制約OK】: 流速範囲内に収まった
      return {
        status: 'ok',
        nominalSize: entry.nominalSize,
        innerDiameterM: d,
        outerDiameterMm: entry.outerDiameter, // 【改善】: 再検索不要のため直接格納
        velocity,
      }
    }

    if (velocity > PIPE_SIZING_DEFAULTS.maxVelocity) {
      // 【上限超過】: 1サイズ上げる（TC-020対応）
      if (currentIdx >= PIPE_SIZES.length - 1) {
        // 【サイズ上限】: 最大口径でも制約不満足 → size-limitで返す（TC-012対応）
        return {
          status: 'size-limit',
          nominalSize: entry.nominalSize,
          innerDiameterM: d,
          outerDiameterMm: entry.outerDiameter,
          velocity,
        }
      }
      currentIdx++
    } else {
      // 【下限未満】: 1サイズ下げる（TC-021対応）
      if (currentIdx <= 0) {
        // 【サイズ下限】: 最小口径でも制約不満足 → size-limitで返す（TC-013対応）
        return {
          status: 'size-limit',
          nominalSize: entry.nominalSize,
          innerDiameterM: d,
          outerDiameterMm: entry.outerDiameter,
          velocity,
        }
      }
      currentIdx--
    }
  }

  // 【フォールバック】: ループ終了後（理論上到達しない — PIPE_SIZES.length回反復で必ず収束）
  // 安全策として最終インデックスの口径を返す
  const finalEntry = PIPE_SIZES[currentIdx]!
  const d = finalEntry.innerDiameter / 1000
  const area = Math.PI * (d / 2) ** 2
  const velocity = flowRate / area
  return {
    status: 'warning',
    nominalSize: finalEntry.nominalSize,
    innerDiameterM: d,
    outerDiameterMm: finalEntry.outerDiameter,
    velocity,
  }
}

/**
 * 【機能概要】: 等価長さ法による配管圧損を概算する (kPa)
 * 【実装方針】: ダルシー・ワイスバッハ式 + 等価長さ法
 *   総等価長さ = 直管長 * (1 + fittingFactor)
 *   ΔP = λ * (L_eq / d) * (ρ * v^2 / 2) / 1000  ← Pa → kPa変換
 * 【テスト対応】: TC-006, TC-022 を通すための実装
 * 🔵 信頼性レベル: REQ-1104「等価長さ法、lambda=0.02、fittingFactor=0.5」に明示
 * @param straightLength - 直管長 (m)
 * @param innerDiameterM - 内径 (m)
 * @param flowRate - 体積流量 (m3/s)
 * @param lambda - ダルシー・ワイスバッハ摩擦係数（デフォルト0.02）
 * @param fittingFactor - 継手等価長さ係数（デフォルト0.5）
 * @returns 圧損 (kPa)
 */
export function calculatePressureDrop(
  straightLength: number,
  innerDiameterM: number,
  flowRate: number,
  lambda: number = PIPE_SIZING_DEFAULTS.lambda,
  fittingFactor: number = PIPE_SIZING_DEFAULTS.fittingFactor,
): number {
  // 【ゼロ長処理】: 直管長ゼロのとき圧損=0（TC-022対応）
  if (straightLength <= 0) {
    return 0
  }

  // 【断面積・流速計算】
  const area = Math.PI * (innerDiameterM / 2) ** 2 // 【断面積】: m2
  const velocity = flowRate / area // 【流速】: m/s

  // 【等価長さ計算】: 継手分を加算した総等価長さ (m)
  const equivalentLength = straightLength * (1 + fittingFactor)

  // 【圧損計算】: ダルシー・ワイスバッハ式 (Pa → kPa変換)
  // ΔP [Pa] = λ * (L_eq / d) * (ρ * v^2 / 2)
  const pressureDropPa =
    lambda * (equivalentLength / innerDiameterM) * ((PIPE_SIZING_DEFAULTS.rho * velocity ** 2) / 2)

  return pressureDropPa / 1000 // 【単位変換】: Pa → kPa
}

/**
 * 【機能概要】: AHU冷房能力と配管長から口径を統合選定する
 * 【実装方針】: calculateFlowRate → calculateTheoreticalDiameter → snapToStandardSize
 *              → validateVelocityConstraint → calculatePressureDrop の一連のパイプライン
 * 【テスト対応】: TC-010（統合テスト）, TC-011統合（ゼロフローのスキップ）を通すための実装
 * 🔵 信頼性レベル: REQ-1103, REQ-1104の統合フローに明示
 * @param coolingCapacity - AHU冷房能力 (kW)
 * @param straightLength - 配管直管長 (m)
 * @returns 口径選定結果（流量ゼロ時はnull）
 */
export function selectPipeSize(
  coolingCapacity: number,
  straightLength: number,
): SelectPipeSizeResult {
  // 【ステップ1】: 冷水流量算出
  const flowRate = calculateFlowRate(coolingCapacity)

  // 【ゼロフロースキップ】: coolingCapacity=0のとき口径算出をスキップ（EDGE-103対応）
  if (flowRate <= 0) {
    return {
      nominalSize: null,
      outerDiameter: null,
      calcResult: null,
    }
  }

  // 【ステップ2】: 理論口径算出
  const theoreticalDiameterMm = calculateTheoreticalDiameter(
    flowRate,
    PIPE_SIZING_DEFAULTS.targetVelocity,
  )

  // 【ステップ3】: 標準口径スナップ
  const snappedSize = snapToStandardSize(theoreticalDiameterMm)

  // 【ステップ4】: 流速制約検証 + 口径自動調整
  const velocityResult = validateVelocityConstraint(
    snappedSize.nominalSize,
    snappedSize.innerDiameter / 1000, // 【単位変換】: mm → m
    flowRate,
  )

  // 【ステップ5】: 等価長さ法圧損概算
  const pressureDrop = calculatePressureDrop(
    straightLength,
    velocityResult.innerDiameterM,
    flowRate,
  )

  // 【改善】: outerDiameterMm は validateVelocityConstraint の戻り値から直接取得
  // 以前は PIPE_SIZES.find を再度呼んでいたが、不要な O(n) 線形スキャンを排除
  return {
    nominalSize: velocityResult.nominalSize,
    outerDiameter: velocityResult.outerDiameterMm,
    calcResult: {
      velocity: velocityResult.velocity,
      pressureDrop,
    },
  }
}
