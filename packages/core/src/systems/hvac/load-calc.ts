/**
 * 【機能概要】: HVAC ゾーン負荷概算計算エンジン（純関数群）
 * 【設計方針】:
 *   - load-unit-table.json をマスタデータとして参照（定数ハードコード禁止）
 *   - 副作用なしの純関数として設計（テスタビリティ・再利用性を重視）
 *   - Three.js インポート禁止（Core パッケージのアーキテクチャ制約）
 *   - Biome コードスタイル準拠
 * 【対応要件】: REQ-301〜306（冷房/暖房/風量/外皮負荷計算）
 * 【テスト対応】: packages/core/src/systems/hvac/__tests__/load-calc.test.ts (29件)
 * 🔵 信頼性レベル: REQ-301〜306 に基づく実装
 */

import type { z } from 'zod'
import loadUnitTable from '../../data/load-unit-table.json'
import type { Orientation, PerimeterSegment, ZoneUsage } from '../../schema/nodes/hvac-shared'
import type { HvacZoneCalcResult } from '../../schema/nodes/hvac-zone'

// ============================================================================
// 型定義
// ============================================================================

/**
 * 【型エイリアス】: Zod スキーマから推論した各フィールドの TypeScript 型
 * 【設計方針】: z.infer の重複記述を避けて可読性を向上させる
 * 🔵 信頼性レベル: 既存 Zod スキーマの定義に直接対応
 */
type OrientationType = z.infer<typeof Orientation>
type ZoneUsageType = z.infer<typeof ZoneUsage>
type PerimeterSegmentType = z.infer<typeof PerimeterSegment>

/** 【型定義】: HvacZoneCalcResult の TypeScript 型（Zod スキーマから推論）*/
type HvacZoneCalcResultType = z.infer<typeof HvacZoneCalcResult>

/**
 * 【型定義】: calculateEnvelopeLoad の戻り値
 * 【設計方針】: 外皮負荷の合計値と方位別内訳を同時に返すことで、呼び出し元の再計算を防ぐ
 * 🔵 信頼性レベル: HvacZoneCalcResult.perimeterLoadBreakdown スキーマに準拠
 */
export type EnvelopeLoadResult = {
  total: number
  breakdown: Array<{
    orientation: OrientationType
    solarCorrectionFactor: number
    envelopeLoadContribution: number
  }>
}

/**
 * 【型定義】: calculateZoneLoad の入力ゾーンデータ
 * 【設計方針】: HvacZoneNode の計算に必要なフィールドのみを抽出した入力型
 * 【保守性】: designConditions を optional にして段階的な入力に対応
 * 🔵 信頼性レベル: REQ-203,205,206 に対応する HvacZoneNode のサブセット
 */
export type ZoneInput = {
  floorArea: number
  usage: ZoneUsageType
  perimeterSegments: PerimeterSegmentType[]
  designConditions?: { supplyAirTempDiff?: number }
}

// ============================================================================
// 定数定義
// ============================================================================

/**
 * 【定数定義】: 方位別日射補正係数テーブル（REQ-303）
 * 【設計方針】: 南面を基準（1.0）として東西面や北面の係数を設定
 * 【調整可能性】: 地域・気候帯による係数変更が必要な場合はここを更新する
 * 🔵 信頼性レベル: REQ-303 に全方位の係数が明示
 */
export const SOLAR_COEFFICIENTS: Record<OrientationType, number> = {
  S: 1.0, // 【南面】: 基準値（最も日射を受ける方向ではないが基準として定義）
  SE: 1.1, // 【南東面】: 南面より若干高い係数
  SW: 1.1, // 【南西面】: 南東面と対称
  E: 1.2, // 【東面】: 朝の日射で最大係数
  W: 1.2, // 【西面】: 夕方の日射で最大係数
  NE: 0.8, // 【北東面】: 北面寄りで係数が低い
  NW: 0.8, // 【北西面】: 北東面と対称
  N: 0.6, // 【北面】: 最小係数（日射が少ない）
}

/**
 * 【定数定義】: 風量計算に使用する空気の物理定数（REQ-304）
 * 【設計方針】: 関連する物理定数をオブジェクトにまとめて管理性を向上
 * 【調整可能性】: 高地など特殊環境での運用時は AIR_DENSITY の調整が必要になる場合がある
 * 🔵 信頼性レベル: REQ-304 に明示
 */
const PHYSICS_CONSTANTS = {
  /** 【空気密度】: 1.2 kg/m^3（標準大気圧・20°C 相当の値） */
  AIR_DENSITY: 1.2,
  /** 【空気比熱】: 1005 J/(kg·K)（乾燥空気の定圧比熱） */
  AIR_SPECIFIC_HEAT: 1005,
  /** 【ベース外皮負荷】: 200 W/m^2（ガラス面の基準熱貫流負荷） */
  BASE_ENVELOPE_LOAD: 200,
  /** 【デフォルト送風温度差】: 10 K（hvac-zone.ts の supplyAirTempDiff デフォルト値と一致） */
  DEFAULT_SUPPLY_AIR_TEMP_DIFF: 10,
} as const

// ============================================================================
// ヘルパー: 負荷原単位テーブルの参照
// ============================================================================

/**
 * 【ヘルパー型】: load-unit-table.json の各エントリの型定義
 * 🔵 信頼性レベル: load-unit-table.json の構造に対応
 */
type LoadUnitEntry = {
  coolingLoadPerArea: number
  heatingLoadPerArea: number
}

/**
 * 【機能概要】: load-unit-table.json から指定 usage の原単位エントリを取得
 * 【ヘルパー関数】: コードに定数をハードコードせず JSON ファイルを参照する（REQ-305）
 * 【再利用性】: calculateInternalLoad / calculateHeatingLoad の両方から利用
 * 【単一責任】: 原単位テーブルの参照とフォールバック処理のみを担当
 * 【テスト対応】: TC-N01〜TC-N05, TC-N12, TC-N17, TC-E06
 * 🟡 信頼性レベル: JSON ファイルのデータを正として使用（TASK 記載値と乖離あり）
 * @param usage - ZoneUsage（5種類の用途区分）
 * @returns 負荷原単位エントリ（マッチしない場合は office_general にフォールバック）
 */
function getLoadUnitEntry(usage: ZoneUsageType): LoadUnitEntry {
  // 【原単位検索】: load-unit-table.json から usage に一致するエントリを検索
  const entry = loadUnitTable.find((e) => e.usage === usage)

  if (entry) {
    // 【正常ケース】: 一致するエントリが見つかった場合はその値を返す 🔵
    return {
      coolingLoadPerArea: entry.coolingLoadPerArea,
      heatingLoadPerArea: entry.heatingLoadPerArea,
    }
  }

  // 【フォールバック】: 未知の usage が渡された場合は office_general の値でフォールバック 🟡
  // TASK-0015 に「デフォルト値を適用」と記載。TC-E06 の期待値 15000 = 100 x 150 に対応
  const fallback = loadUnitTable.find((e) => e.usage === 'office_general')
  return {
    coolingLoadPerArea: fallback?.coolingLoadPerArea ?? 150,
    heatingLoadPerArea: fallback?.heatingLoadPerArea ?? 80,
  }
}

// ============================================================================
// 公開関数: 個別計算
// ============================================================================

/**
 * 【機能概要】: 内部冷房負荷を計算する（REQ-302）
 * 【実装方針】: floorArea x coolingLoadPerArea[usage] の単純乗算
 * 【テスト対応】: TC-N01〜TC-N05
 * 🔵 信頼性レベル: REQ-302 に計算式明示
 * @param floorArea - 床面積 (m^2)
 * @param usage - ゾーン用途区分
 * @returns 内部冷房負荷 (W)
 */
export function calculateInternalLoad(floorArea: number, usage: ZoneUsageType): number {
  // 【原単位取得】: load-unit-table.json から冷房原単位を取得
  const { coolingLoadPerArea } = getLoadUnitEntry(usage)

  // 【内部負荷計算】: 床面積 x 冷房原単位 🔵
  return floorArea * coolingLoadPerArea
}

/**
 * 【機能概要】: 外皮冷房負荷を計算する（REQ-303）
 * 【実装方針】: 各ペリメータセグメントについて wallArea x glazingRatio x solarCoeff x BASE を計算し合算
 * 【テスト対応】: TC-N06〜TC-N08, TC-B01〜TC-B03, TC-B07, TC-B08
 * 🔵 信頼性レベル: REQ-303 に計算式・係数が明示
 * @param segments - ペリメータセグメント配列
 * @returns 外皮負荷合計と方位別内訳
 */
export function calculateEnvelopeLoad(segments: PerimeterSegmentType[]): EnvelopeLoadResult {
  // 【セグメント別計算】: 各セグメントの外皮負荷を個別計算
  const breakdown = segments.map((seg) => {
    // 【日射補正係数取得】: 方位から補正係数を取得 🔵
    const solarCorrectionFactor = SOLAR_COEFFICIENTS[seg.orientation]

    // 【方位バリデーション】: SOLAR_COEFFICIENTS に存在しない方位はエラー（TC-E05 対応） 🟡
    // 不正な orientation が渡された場合、solarCorrectionFactor は undefined になる
    if (solarCorrectionFactor === undefined) {
      throw new Error(`不明な方位が指定されました: ${seg.orientation}`)
    }

    // 【外皮負荷寄与計算】: wallArea x glazingRatio x solarCoeff x BASE_ENVELOPE_LOAD 🔵
    const envelopeLoadContribution =
      seg.wallArea * seg.glazingRatio * solarCorrectionFactor * PHYSICS_CONSTANTS.BASE_ENVELOPE_LOAD

    return {
      orientation: seg.orientation,
      solarCorrectionFactor,
      envelopeLoadContribution,
    }
  })

  // 【合計算出】: 全セグメントの外皮負荷寄与を合算 🔵
  const total = breakdown.reduce((sum, entry) => sum + entry.envelopeLoadContribution, 0)

  return { total, breakdown }
}

/**
 * 【機能概要】: 冷房負荷合計を計算する（REQ-301）
 * 【実装方針】: coolingLoad = internalLoad + envelopeLoad の単純加算
 * 【テスト対応】: TC-N09
 * 🔵 信頼性レベル: REQ-301 に「内部負荷 + 外皮負荷」と明示
 * @param internalLoad - 内部冷房負荷 (W)
 * @param envelopeLoad - 外皮冷房負荷 (W)
 * @returns 冷房負荷合計 (W)
 */
export function calculateCoolingLoad(internalLoad: number, envelopeLoad: number): number {
  // 【冷房負荷合算】: 内部負荷と外皮負荷の単純加算 🔵
  return internalLoad + envelopeLoad
}

/**
 * 【機能概要】: 必要風量を計算する（REQ-304）
 * 【実装方針】: coolingLoad / (ρ x Cp x ΔT) x 3600 で m^3/h を算出し Math.round で整数丸め
 *   - supplyAirTempDiff <= 0 の場合はゼロ除算を防いで 0 を返す
 * 【テスト対応】: TC-N10, TC-N11, TC-E01, TC-E02, TC-B06
 * 🔵 信頼性レベル: REQ-304 に計算式・物理定数が明示
 * @param coolingLoad - 冷房負荷 (W)
 * @param supplyAirTempDiff - 送風温度差 (K)、省略時はデフォルト 10K
 * @returns 必要風量 (m^3/h)、整数値
 */
export function calculateRequiredAirflow(
  coolingLoad: number,
  supplyAirTempDiff: number = PHYSICS_CONSTANTS.DEFAULT_SUPPLY_AIR_TEMP_DIFF,
): number {
  // 【ゼロ除算防止】: supplyAirTempDiff <= 0 の場合は 0 を返す（NFR-102） 🔵
  if (supplyAirTempDiff <= 0) {
    return 0
  }

  // 【風量計算】: coolingLoad / (ρ x Cp x ΔT) x 3600 で m^3/h を算出 🔵
  // ρ=1.2 kg/m^3, Cp=1005 J/(kg·K)
  const airflowM3PerS =
    coolingLoad / (PHYSICS_CONSTANTS.AIR_DENSITY * PHYSICS_CONSTANTS.AIR_SPECIFIC_HEAT * supplyAirTempDiff)
  const airflowM3PerH = airflowM3PerS * 3600

  // 【整数丸め】: Math.round で m^3/h の整数値に丸める 🔵
  return Math.round(airflowM3PerH)
}

/**
 * 【機能概要】: 暖房負荷を計算する（REQ-305）
 * 【実装方針】: floorArea x heatingLoadPerArea[usage] の単純乗算
 * 【テスト対応】: TC-N12, TC-N13, TC-N17
 * 🔵 信頼性レベル: REQ-305 に計算式明示、load-unit-table.json で値確認済み
 * @param floorArea - 床面積 (m^2)
 * @param usage - ゾーン用途区分
 * @returns 暖房負荷 (W)
 */
export function calculateHeatingLoad(floorArea: number, usage: ZoneUsageType): number {
  // 【原単位取得】: load-unit-table.json から暖房原単位を取得
  const { heatingLoadPerArea } = getLoadUnitEntry(usage)

  // 【暖房負荷計算】: 床面積 x 暖房原単位 🔵
  return floorArea * heatingLoadPerArea
}

// ============================================================================
// 公開関数: 統合計算
// ============================================================================

/**
 * 【機能概要】: ゾーン全体の負荷計算を統合実行する（REQ-301〜306）
 * 【実装方針】:
 *   - floorArea <= 0 の場合はバリデーションエラーを返す（EDGE-001）
 *   - try-catch で例外を捕捉し status='error' で安全に返す（NFR-102）
 *   - 全計算結果を HvacZoneCalcResult 型にまとめて返す
 * 【テスト対応】: TC-N15, TC-N16, TC-E03, TC-E04, TC-E05
 * 🔵 信頼性レベル: REQ-301〜306 を統合
 * @param zone - ゾーン入力データ
 * @returns HvacZoneCalcResult 型の計算結果
 */
export function calculateZoneLoad(zone: ZoneInput): HvacZoneCalcResultType {
  // 【入力バリデーション】: floorArea <= 0 の場合はエラーを返す（EDGE-001） 🔵
  if (zone.floorArea <= 0) {
    return {
      coolingLoad: 0,
      heatingLoad: 0,
      requiredAirflow: 0,
      internalLoad: 0,
      envelopeLoad: 0,
      perimeterLoadBreakdown: [],
      status: 'error',
      error: `床面積が不正な値です（floorArea=${zone.floorArea}）。正の値を指定してください。`,
    }
  }

  // 【例外安全計算】: 計算中の例外を捕捉しエディタのクラッシュを防ぐ（NFR-102） 🔵
  try {
    // 【送風温度差取得】: designConditions から取得、未指定の場合はデフォルト値 🔵
    const supplyAirTempDiff =
      zone.designConditions?.supplyAirTempDiff ?? PHYSICS_CONSTANTS.DEFAULT_SUPPLY_AIR_TEMP_DIFF

    // 【内部負荷計算】: 用途別原単位 x 床面積 🔵
    const internalLoad = calculateInternalLoad(zone.floorArea, zone.usage)

    // 【外皮負荷計算】: 方位別日射補正係数を適用 🔵
    const envelopeResult = calculateEnvelopeLoad(zone.perimeterSegments)
    const envelopeLoad = envelopeResult.total

    // 【冷房負荷合算】: 内部負荷 + 外皮負荷 🔵
    const coolingLoad = calculateCoolingLoad(internalLoad, envelopeLoad)

    // 【暖房負荷計算】: 用途別暖房原単位 x 床面積 🔵
    const heatingLoad = calculateHeatingLoad(zone.floorArea, zone.usage)

    // 【必要風量計算】: 冷房負荷を空気の物理定数で割って m^3/h に変換 🔵
    const requiredAirflow = calculateRequiredAirflow(coolingLoad, supplyAirTempDiff)

    // 【結果返却】: HvacZoneCalcResult 型に整形して返す 🔵
    return {
      coolingLoad,
      heatingLoad,
      requiredAirflow,
      internalLoad,
      envelopeLoad,
      perimeterLoadBreakdown: envelopeResult.breakdown,
      status: 'success',
    }
  } catch (error) {
    // 【例外捕捉】: 計算中の例外を捕捉し、エラーステータスで返す（NFR-102） 🔵
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました'
    return {
      coolingLoad: 0,
      heatingLoad: 0,
      requiredAirflow: 0,
      internalLoad: 0,
      envelopeLoad: 0,
      perimeterLoadBreakdown: [],
      status: 'error',
      error: `負荷計算中にエラーが発生しました: ${errorMessage}`,
    }
  }
}
