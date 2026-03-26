/**
 * TASK-0036: PipeSizingSystem — 配管口径選定システム 単体テスト
 *
 * 【テスト対象】: pipe-sizing.ts の純粋計算関数
 *   - calculateFlowRate: AHU冷房能力から冷水流量を算出
 *   - calculateTheoreticalDiameter: 流量と目標流速から理論口径を算出
 *   - snapToStandardSize: 計算口径を標準口径表にスナップ
 *   - validateVelocityConstraint: 流速範囲制約（1.0~2.0 m/s）を検証し口径を調整
 *   - calculatePressureDrop: 等価長さ法で配管圧損を概算
 *   - selectPipeSize: 統合口径選定処理（上記の組合せ）
 *
 * 【単位】:
 *   - flowRate: m3/s
 *   - coolingCapacity: kW
 *   - diameter: m（内部）, mm（表示）
 *   - nominalSize: A（呼び径）
 *   - velocity: m/s
 *   - pressureDrop: kPa
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0036 要件定義（REQ-1103, REQ-1104, PRDセクション15.7）に明示
 */

import { describe, expect, it } from 'vitest'
import {
  calculateFlowRate,
  calculatePressureDrop,
  calculateTheoreticalDiameter,
  PIPE_SIZING_DEFAULTS,
  selectPipeSize,
  snapToStandardSize,
  validateVelocityConstraint,
} from '../pipe-sizing'

// ============================================================================
// TC-001: 冷水流量計算（標準入力）
// ============================================================================

describe('calculateFlowRate — 冷水流量計算', () => {
  it('TC-001: coolingCapacity=50kWから冷水流量≈0.002389m3/sが算出される', () => {
    // 【テスト目的】: AHU冷房能力50kWから冷水流量を正しく算出する
    // 【テスト内容】: calculateFlowRate関数にcoolingCapacity=50kWを入力し、期待流量と比較
    // 【期待される動作】: flowRate = coolingCapacity / (cp * deltaT * rho) の公式に従い算出
    // 🔵 信頼性レベル: TASK-0036 テスト1（Given: coolingCapacity=50kW, ΔT=5K → Then: flowRate≈0.00239 m3/s）に明記

    // 【テストデータ準備】: 中規模AHUの標準的な冷房能力値（PRDセクション15.7に使用されている値）
    const coolingCapacity = 50 // kW

    // 【実際の処理実行】: calculateFlowRate 関数を呼び出し
    // 【処理内容】: flowRate = 50 / (4.186 * 5 * 1000) = 0.002389 m3/s
    const result = calculateFlowRate(coolingCapacity)

    // 【結果検証】: 計算結果が物理的に正しい値であること
    // 【期待値確認】: 50 / (4.186 * 5 * 1000) ≈ 0.002389 m3/s
    expect(result).toBeCloseTo(0.002389, 4) // 【確認内容】: 相対誤差0.01%以内で一致すること 🔵
  })

  it('TC-009: coolingCapacity=100kWでは流量が50kWの約2倍になる（線形性確認）', () => {
    // 【テスト目的】: 計算式が線形であることを確認
    // 【テスト内容】: 50kWの2倍の能力で流量も2倍になることを検証
    // 【期待される動作】: coolingCapacity2倍 → flowRate2倍の線形関係
    // 🟡 信頼性レベル: TASK-0036に直接記載はないが、計算式の線形性として標準的

    // 【テストデータ準備】: 大型AHUの冷房能力（TC-001の2倍）
    const coolingCapacity100 = 100 // kW
    const coolingCapacity50 = 50 // kW

    // 【実際の処理実行】: 2つの能力で流量を算出
    const result100 = calculateFlowRate(coolingCapacity100)
    const result50 = calculateFlowRate(coolingCapacity50)

    // 【結果検証】: 100kWの流量が50kWの約2倍であること
    // 【期待値確認】: 100kW → ≈0.004778 m3/s（TC-001の約2倍）
    expect(result100).toBeCloseTo(result50 * 2, 5) // 【確認内容】: 正確に2倍であること 🟡
  })

  it('TC-011: coolingCapacity=0kWのとき流量ゼロが返される', () => {
    // 【テスト目的】: 冷房能力ゼロでの流量計算の安全な動作確認
    // 【テスト内容】: coolingCapacity=0のとき、flowRate=0が返されること
    // 【期待される動作】: ゼロ除算が発生せず、0が返される
    // 🟡 信頼性レベル: TASK-0036 テスト6（EDGE-103）に明記。具体的な内部動作は推測

    // 【テストデータ準備】: 冷房能力未設定状態
    const coolingCapacity = 0 // kW

    // 【実際の処理実行】: calculateFlowRate 関数を呼び出し
    const result = calculateFlowRate(coolingCapacity)

    // 【結果検証】: ゼロが返され、クラッシュしないこと
    expect(result).toBe(0) // 【確認内容】: 流量ゼロが正しく返されること 🟡
  })

  it('TC-023: deltaT未指定時はデフォルト5Kが使用される', () => {
    // 【テスト目的】: デフォルトパラメータ（deltaT=5K）の動作確認
    // 【テスト内容】: deltaT を明示的に指定しない場合にデフォルト値で計算されること
    // 【期待される動作】: TC-001と同じ結果が返される
    // 🔵 信頼性レベル: 要件定義2.2「deltaT=5Kデフォルト」に明記

    // 【テストデータ準備】: デフォルト値を使用する標準的なケース
    const coolingCapacity = 50 // kW

    // 【実際の処理実行】: deltaTを指定せずに呼び出し
    const resultDefault = calculateFlowRate(coolingCapacity) // deltaT省略
    const resultExplicit = calculateFlowRate(coolingCapacity, 5) // deltaT=5明示

    // 【結果検証】: デフォルトと明示指定で同じ結果が得られること
    expect(resultDefault).toBeCloseTo(resultExplicit, 6) // 【確認内容】: 同じ結果であること 🔵
  })
})

// ============================================================================
// TC-002: 理論口径計算
// ============================================================================

describe('calculateTheoreticalDiameter — 理論口径計算', () => {
  it('TC-002: flowRate=0.00239m3/s, velocity=1.5m/sから理論口径≈45mmが算出される', () => {
    // 【テスト目的】: 流量と目標流速から理論口径（mm）を正しく算出する
    // 【テスト内容】: diameter = sqrt(4 * flowRate / (pi * velocity)) の計算式確認
    // 【期待される動作】: flowRate=0.00239, velocity=1.5 → 理論口径≈45mm
    // 🔵 信頼性レベル: TASK-0036 テスト2（Given: flowRate=0.00239, velocity=1.5 → Then: ≈45mm）に明記

    // 【テストデータ準備】: TC-001の流量計算結果と推奨中央値の目標流速
    const flowRate = 0.00239 // m3/s
    const targetVelocity = 1.5 // m/s

    // 【実際の処理実行】: calculateTheoreticalDiameter 関数を呼び出し
    // 【処理内容】: sqrt(4 * 0.00239 / (pi * 1.5)) * 1000 ≈ 45mm
    const result = calculateTheoreticalDiameter(flowRate, targetVelocity)

    // 【結果検証】: 理論口径が45mm前後であること
    // 【期待値確認】: sqrt(4 * 0.00239 / (pi * 1.5)) * 1000 ≈ 45.0mm
    expect(result).toBeCloseTo(45, 0) // 【確認内容】: mm単位で整数近似が妥当であること 🔵
  })
})

// ============================================================================
// TC-003, TC-004: 標準口径スナップ
// ============================================================================

describe('snapToStandardSize — 標準口径スナップ', () => {
  it('TC-003: 計算口径45mmが50A（innerDiameter=52.7mm）にスナップされる', () => {
    // 【テスト目的】: 計算口径以上の最小標準口径にスナップするロジックを確認
    // 【テスト内容】: 45mm入力時に50A（52.7mm）が選択されること
    // 【期待される動作】: 40A(41.2mm) < 45mm < 50A(52.7mm) → 50Aにスナップ
    // 🔵 信頼性レベル: TASK-0036 テスト2（計算口径45mm → 50Aスナップ）に明記

    // 【テストデータ準備】: 40A(41.2mm)と50A(52.7mm)の中間値
    const theoreticalDiameterMm = 45

    // 【実際の処理実行】: snapToStandardSize 関数を呼び出し
    // 【処理内容】: standard-pipe-sizes.jsonを参照して最小適合口径を選択
    const result = snapToStandardSize(theoreticalDiameterMm)

    // 【結果検証】: 50Aが選択されること
    // 【期待値確認】: 45mm > 41.2mm(40A内径) なので40Aは不可、50Aが最小適合サイズ
    expect(result.nominalSize).toBe(50) // 【確認内容】: 呼び径50Aが選択されること 🔵
    expect(result.innerDiameter).toBeCloseTo(52.7, 1) // 【確認内容】: 内径52.7mmであること 🔵
  })

  it('TC-004: 計算口径38mmが40A（innerDiameter=41.2mm）にスナップされる', () => {
    // 【テスト目的】: 別の境界値での標準口径スナップ動作確認
    // 【テスト内容】: 38mm入力時に40A（41.2mm）が選択されること
    // 【期待される動作】: 32A(35.7mm) < 38mm < 40A(41.2mm) → 40Aにスナップ
    // 🔵 信頼性レベル: TASK-0036 テスト5（計算口径38mm → 40A）に明記

    // 【テストデータ準備】: 32A(35.7mm)と40A(41.2mm)の中間値
    const theoreticalDiameterMm = 38

    // 【実際の処理実行】: snapToStandardSize 関数を呼び出し
    const result = snapToStandardSize(theoreticalDiameterMm)

    // 【結果検証】: 40Aが選択されること
    expect(result.nominalSize).toBe(40) // 【確認内容】: 呼び径40Aが選択されること 🔵
  })

  it('TC-016: 計算口径5mm（最小口径以下）のとき15Aにスナップされる', () => {
    // 【テスト目的】: 標準口径表下限の境界動作確認
    // 【テスト内容】: 15Aより小さい口径（5mm）が15Aにスナップされること
    // 【期待される動作】: 標準口径表の最小サイズ15A（内径16.1mm）が返される
    // 🟡 信頼性レベル: TASK-0036に直接記載なし。標準口径表の境界として妥当

    // 【テストデータ準備】: 標準口径表の最小エントリ（15A、内径16.1mm）以下の値
    const theoreticalDiameterMm = 5

    // 【実際の処理実行】: snapToStandardSize 関数を呼び出し
    const result = snapToStandardSize(theoreticalDiameterMm)

    // 【結果検証】: 最小口径15Aが選択されること
    expect(result.nominalSize).toBe(15) // 【確認内容】: 最小口径15Aが返されること 🟡
  })

  it('TC-017: 計算口径250mm（最大口径超過）のとき200Aが選択される', () => {
    // 【テスト目的】: 標準口径表上限の境界動作確認
    // 【テスト内容】: 200Aの内径（204.7mm）を超える口径が入力されたとき200Aが返されること
    // 【期待される動作】: 標準口径表の最大サイズ200A（内径204.7mm）が返される
    // 🟡 信頼性レベル: TASK-0036に直接記載なし。標準口径表の境界として妥当

    // 【テストデータ準備】: 標準口径表の最大エントリ（200A、内径204.7mm）を超える値
    const theoreticalDiameterMm = 250

    // 【実際の処理実行】: snapToStandardSize 関数を呼び出し
    const result = snapToStandardSize(theoreticalDiameterMm)

    // 【結果検証】: 最大口径200Aが選択されること
    expect(result.nominalSize).toBe(200) // 【確認内容】: 最大口径200Aが返されること 🟡
  })
})

// ============================================================================
// TC-005, TC-020, TC-021: 流速範囲制約
// ============================================================================

describe('validateVelocityConstraint — 流速範囲制約検証', () => {
  it('TC-005: 50A・flowRate=0.00239m3/sで実流速が1.0~2.0範囲内 → 制約OK', () => {
    // 【テスト目的】: 流速制約の正常パス（範囲内）確認
    // 【テスト内容】: 50A（内径0.0527m）でflowRate=0.00239m3/s時に実流速が1.0~2.0範囲内であること
    // 【期待される動作】: 実流速 ≈ 1.1 m/s → 制約OK、口径変更なし
    // 🔵 信頼性レベル: TASK-0036 テスト3（50A、flowRate=0.00239 → 実流速≈1.22 m/s、制約OK）に明記

    // 【テストデータ準備】: TC-001とTC-003の結果を組み合わせた標準的なケース
    const nominalSize = 50 // A
    const innerDiameterM = 0.0527 // m（52.7mm）
    const flowRate = 0.00239 // m3/s

    // 【実際の処理実行】: validateVelocityConstraint 関数を呼び出し
    // 【処理内容】: 実流速 = flowRate / (pi * (d/2)^2) を計算し、範囲チェック
    const result = validateVelocityConstraint(nominalSize, innerDiameterM, flowRate)

    // 【結果検証】: 制約OKかつ口径変更なし
    // 【期待値確認】: 実流速 ≈ 1.1 m/s で 1.0 <= v <= 2.0
    expect(result.status).toBe('ok') // 【確認内容】: 範囲内と判定されること 🔵
    expect(result.nominalSize).toBe(50) // 【確認内容】: 口径変更なし 🔵
    expect(result.velocity).toBeGreaterThanOrEqual(1.0) // 【確認内容】: 実流速が下限以上 🔵
    expect(result.velocity).toBeLessThanOrEqual(2.0) // 【確認内容】: 実流速が上限以下 🔵
  })

  it('TC-020: 流速上限超過（>2.0 m/s）のとき口径が1サイズ上げられる', () => {
    // 【テスト目的】: 流速上限超過時の自動サイズアップ動作確認
    // 【テスト内容】: 選定口径で実流速 > 2.0 m/s のとき、1サイズ上の口径が選択される
    // 【期待される動作】: 口径が1サイズ上げられ、再計算後に流速が範囲内に収まる
    // 🔵 信頼性レベル: TASK-0036 テスト4（口径が小さすぎて実流速>2.0 → 1サイズ上げ）に明記

    // 【テストデータ準備】: 25A（内径0.0276m）で大流量（流速>2.0になる組合せ）
    // 25Aで実流速: 0.005 / (pi * (0.0276/2)^2) ≈ 8.37 m/s → 上限大幅超過
    const nominalSize = 25 // A（意図的に小さい口径）
    const innerDiameterM = 0.0276 // m（27.6mm）
    const flowRate = 0.005 // m3/s（流速が上限超過になる大流量）

    // 【実際の処理実行】: validateVelocityConstraint 関数を呼び出し
    const result = validateVelocityConstraint(nominalSize, innerDiameterM, flowRate)

    // 【結果検証】: 口径が1サイズ上げられること
    // 【期待値確認】: 25A → 32A（またはそれ以上）にサイズアップ
    expect(result.nominalSize).toBeGreaterThan(25) // 【確認内容】: 元の口径より大きい口径が選択されること 🔵
    expect(result.velocity).toBeLessThanOrEqual(2.0) // 【確認内容】: 調整後の流速が上限以下 🔵
  })

  it('TC-021: 流速下限未満（<1.0 m/s）のとき口径が1サイズ下げられる', () => {
    // 【テスト目的】: 流速下限未満時の自動サイズダウン動作確認
    // 【テスト内容】: 選定口径で実流速 < 1.0 m/s のとき、1サイズ下の口径が選択される
    // 【期待される動作】: 口径が1サイズ下げられ、再計算後に流速が範囲内に収まる
    // 🔵 信頼性レベル: TASK-0036 実装詳細6「実流速 < 1.0 m/s: 口径を1サイズ下げて再検証」に明記

    // 【テストデータ準備】: 100A（内径0.1053m）で小流量（流速<1.0になる組合せ）
    // 100Aで実流速: 0.001 / (pi * (0.1053/2)^2) ≈ 0.115 m/s → 下限大幅未達
    const nominalSize = 100 // A（意図的に大きい口径）
    const innerDiameterM = 0.1053 // m（105.3mm）
    const flowRate = 0.001 // m3/s（流速が下限未満になる小流量）

    // 【実際の処理実行】: validateVelocityConstraint 関数を呼び出し
    const result = validateVelocityConstraint(nominalSize, innerDiameterM, flowRate)

    // 【結果検証】: 口径が1サイズ下げられること
    // 【期待値確認】: 100A → 80A（またはそれ以下）にサイズダウン
    expect(result.nominalSize).toBeLessThan(100) // 【確認内容】: 元の口径より小さい口径が選択されること 🔵
    expect(result.velocity).toBeGreaterThanOrEqual(1.0) // 【確認内容】: 調整後の流速が下限以上 🔵
  })
})

// ============================================================================
// TC-006: 等価長さ法による圧損概算
// ============================================================================

describe('calculatePressureDrop — 等価長さ法圧損概算', () => {
  it('TC-006: 直管長20m・50A・flowRate=0.00239m3/sで物理的に妥当な圧損が算出される', () => {
    // 【テスト目的】: ダルシー・ワイスバッハ式と等価長さ法による圧損概算の物理的妥当性確認
    // 【テスト内容】: 直管長20m、50A、flowRate=0.00239m3/s での圧損計算
    // 【期待される動作】: 総等価長さ=30m（直管20m + 継手等価10m）で圧損が数kPa算出される
    // 🔵 信頼性レベル: TASK-0036 テスト7（直管長20m, 口径50A, flowRate=0.00239m3/s）に明記

    // 【テストデータ準備】: TASK-0036 テスト7に明記された入力値
    const straightLength = 20 // m
    const innerDiameterM = 0.0527 // m（50A内径）
    const flowRate = 0.00239 // m3/s
    const lambda = 0.02 // 鋼管概算値
    const fittingFactor = 0.5 // 継手等価長さ係数

    // 【実際の処理実行】: calculatePressureDrop 関数を呼び出し
    // 【処理内容】: 総等価長さ=20*(1+0.5)=30m → ΔP = lambda*(L/d)*(rho*v^2/2)
    const result = calculatePressureDrop(
      straightLength,
      innerDiameterM,
      flowRate,
      lambda,
      fittingFactor,
    )

    // 【結果検証】: 物理的に妥当な範囲（0より大きく、100kPa未満）の圧損値
    // 【期待値確認】: ≈6.9 kPa（実流速≈1.10m/s、等価長さ30mで計算）
    expect(result).toBeGreaterThan(0) // 【確認内容】: 圧損が正の値であること 🔵
    expect(result).toBeLessThan(100) // 【確認内容】: 物理的に妥当な上限100kPa未満であること 🔵
    expect(result).toBeGreaterThan(1) // 【確認内容】: 少なくとも1kPa以上であること 🔵
  })

  it('TC-022: 直管長ゼロのとき圧損=0kPaが返される', () => {
    // 【テスト目的】: 直管長ゼロの極端なケースでの安定動作確認
    // 【テスト内容】: start=end（同一座標）のとき圧損=0が返されること
    // 【期待される動作】: ゼロ除算が発生せず、圧損0が返される
    // 🔴 信頼性レベル: TASK-0036に記載なし。一般的な境界値テストとして追加

    // 【テストデータ準備】: 長さゼロの配管区間
    const straightLength = 0 // m
    const innerDiameterM = 0.0527 // m（50A）
    const flowRate = 0.00239 // m3/s

    // 【実際の処理実行】: calculatePressureDrop 関数を呼び出し
    const result = calculatePressureDrop(straightLength, innerDiameterM, flowRate)

    // 【結果検証】: 圧損がゼロであること
    expect(result).toBe(0) // 【確認内容】: 長さゼロで圧損もゼロであること 🔴
  })
})

// ============================================================================
// TC-012, TC-013: 流速制約を満たせない（グレースフルデグラデーション）
// ============================================================================

describe('validateVelocityConstraint — 制約不可時のグレースフルデグラデーション', () => {
  it('TC-012: 極大流量（coolingCapacity=5000kW相当）では最大口径200Aが採用される', () => {
    // 【テスト目的】: 標準口径表上限超過時のグレースフルデグラデーション確認
    // 【テスト内容】: 最大口径200Aでも流速>2.0 m/sとなる極大流量時に200Aが採用されること
    // 【期待される動作】: 最大口径200Aを採用し、statusが'warning'または'size-limit'になる
    // 🟡 信頼性レベル: TASK-0036 実装詳細6「制約を満たせない場合: 警告+最も近い口径を採用」

    // 【テストデータ準備】: 5000kW冷房能力から算出される極大流量
    // flowRate = 5000 / (4.186 * 5 * 1000) ≈ 0.2389 m3/s
    const largeFlowRate = 0.2389 // m3/s（5000kW相当）
    const nominalSize200 = 200 // A（最大口径）
    const innerDiameter200 = 0.2047 // m（204.7mm）

    // 【実際の処理実行】: validateVelocityConstraint 関数を呼び出し
    const result = validateVelocityConstraint(nominalSize200, innerDiameter200, largeFlowRate)

    // 【結果検証】: 200Aが選択され、警告状態になること
    // 【期待値確認】: 最大口径でも制約不満足の場合、最大口径+警告
    expect(result.nominalSize).toBe(200) // 【確認内容】: 最大口径200Aが採用されること 🟡
    expect(result.status).not.toBe('ok') // 【確認内容】: 警告状態であること 🟡
  })

  it('TC-013: 極小流量（coolingCapacity=0.1kW相当）では最小口径15Aが採用される', () => {
    // 【テスト目的】: 標準口径表下限超過時のグレースフルデグラデーション確認
    // 【テスト内容】: 最小口径15Aでも流速<1.0 m/sとなる極小流量時に15Aが採用されること
    // 【期待される動作】: 最小口径15Aを採用し、statusが'warning'または'size-limit'になる
    // 🟡 信頼性レベル: TASK-0036 実装詳細6「制約を満たせない場合」から推測

    // 【テストデータ準備】: 0.1kW冷房能力から算出される極小流量
    // flowRate = 0.1 / (4.186 * 5 * 1000) ≈ 0.00000478 m3/s
    const tinyFlowRate = 0.00000478 // m3/s（0.1kW相当）
    const nominalSize15 = 15 // A（最小口径）
    const innerDiameter15 = 0.0161 // m（16.1mm）

    // 【実際の処理実行】: validateVelocityConstraint 関数を呼び出し
    const result = validateVelocityConstraint(nominalSize15, innerDiameter15, tinyFlowRate)

    // 【結果検証】: 15Aが選択され、警告状態になること
    expect(result.nominalSize).toBe(15) // 【確認内容】: 最小口径15Aが採用されること 🟡
    expect(result.status).not.toBe('ok') // 【確認内容】: 警告状態であること 🟡
  })
})

// ============================================================================
// TC-010: 統合テスト — AHU冷水配管の完全フロー
// ============================================================================

describe('selectPipeSize — 統合口径選定（完全フロー）', () => {
  it('TC-010: coolingCapacity=50kW・直管長20mで口径50A・流速≈1.1m/s・圧損>0が算出される', () => {
    // 【テスト目的】: PipeSizingSystemの完全フロー検証（流量計算→口径算出→スナップ→流速制約→圧損）
    // 【テスト内容】: coolingCapacity=50kWから始まる一連の計算フロー
    // 【期待される動作】: nominalSize=50, velocity≈1.1m/s, pressureDrop>0が算出される
    // 🔵 信頼性レベル: TASK-0036 統合テスト1（coolingCapacity=50kW → 50A、完全フロー）に明記

    // 【テストデータ準備】: TASK-0036 統合テスト1に明記された入力仕様
    const coolingCapacity = 50 // kW
    const straightLength = 20 // m

    // 【実際の処理実行】: selectPipeSize 統合関数を呼び出し
    // 【処理内容】: calculateFlowRate → calculateTheoreticalDiameter → snapToStandardSize
    //              → validateVelocityConstraint → calculatePressureDrop の統合処理
    const result = selectPipeSize(coolingCapacity, straightLength)

    // 【結果検証】: 全フィールドが正しく算出されること
    // 【期待値確認】: 50kW → flowRate≈0.00239 → 理論口径≈45mm → 50Aスナップ → 流速≈1.1m/s → 圧損>0
    expect(result.nominalSize).toBe(50) // 【確認内容】: 口径50Aが選定されること 🔵
    expect(result.calcResult).not.toBeNull() // 【確認内容】: calcResultが設定されること 🔵
    expect(result.calcResult?.velocity).toBeGreaterThanOrEqual(1.0) // 【確認内容】: 流速が下限以上 🔵
    expect(result.calcResult?.velocity).toBeLessThanOrEqual(2.0) // 【確認内容】: 流速が上限以下 🔵
    expect(result.calcResult?.pressureDrop).toBeGreaterThan(0) // 【確認内容】: 圧損が正の値 🔵
  })

  it('TC-011統合: coolingCapacity=0kWのとき口径算出がスキップされnominalSize=nullが返される', () => {
    // 【テスト目的】: 流量ゼロ時のスキップ動作（EDGE-103）の統合レベル確認
    // 【テスト内容】: coolingCapacity=0のとき、selectPipeSizeがスキップ状態を返すこと
    // 【期待される動作】: nominalSize=null, calcResult=null, status='skipped'または'warning'
    // 🟡 信頼性レベル: TASK-0036 テスト6（EDGE-103）に明記。具体的戻り値は推測

    // 【テストデータ準備】: 冷房能力未設定状態（EDGE-103ケース）
    const coolingCapacity = 0 // kW
    const straightLength = 20 // m

    // 【実際の処理実行】: selectPipeSize 統合関数を呼び出し
    const result = selectPipeSize(coolingCapacity, straightLength)

    // 【結果検証】: 口径算出がスキップされること
    expect(result.nominalSize).toBeNull() // 【確認内容】: 口径が未設定（null）のままであること 🟡
    expect(result.calcResult).toBeNull() // 【確認内容】: calcResultが未設定のままであること 🟡
  })

  it('PIPE_SIZING_DEFAULTSが正しい定数値を持つ', () => {
    // 【テスト目的】: 計算パラメータ定数の値確認
    // 【テスト内容】: 要件定義2.2に明記された定数値が正しく定義されていること
    // 【期待される動作】: 各定数が仕様値と一致する
    // 🔵 信頼性レベル: 要件定義2.2の計算パラメータ表に明記

    // 【実際の処理実行】: PIPE_SIZING_DEFAULTS エクスポートオブジェクトを確認
    // 【期待値確認】: cp=4.186, rho=1000, deltaT=5, targetVelocity=1.5, minVelocity=1.0, maxVelocity=2.0
    expect(PIPE_SIZING_DEFAULTS.cp).toBeCloseTo(4.186, 3) // 【確認内容】: 水の比熱 4.186 kJ/(kg*K) 🔵
    expect(PIPE_SIZING_DEFAULTS.rho).toBe(1000) // 【確認内容】: 水の密度 1000 kg/m3 🔵
    expect(PIPE_SIZING_DEFAULTS.deltaT).toBe(5) // 【確認内容】: 冷水温度差デフォルト5K 🔵
    expect(PIPE_SIZING_DEFAULTS.targetVelocity).toBe(1.5) // 【確認内容】: 目標流速1.5m/s 🔵
    expect(PIPE_SIZING_DEFAULTS.minVelocity).toBe(1.0) // 【確認内容】: 流速下限1.0m/s 🔵
    expect(PIPE_SIZING_DEFAULTS.maxVelocity).toBe(2.0) // 【確認内容】: 流速上限2.0m/s 🔵
    expect(PIPE_SIZING_DEFAULTS.lambda).toBeCloseTo(0.02, 3) // 【確認内容】: 摩擦係数0.02（鋼管概算値）🔵
    expect(PIPE_SIZING_DEFAULTS.fittingFactor).toBeCloseTo(0.5, 3) // 【確認内容】: 継手等価長さ係数0.5 🔵
  })
})
