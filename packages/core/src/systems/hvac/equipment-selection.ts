/**
 * 【機能概要】: EquipmentSelectionSystem 用純粋関数群 — AHU候補選定ロジック
 * 【設計方針】:
 *   - useFrame や React に依存しない純粋関数として実装（テスタビリティ重視）
 *   - AHU カタログをフィルタ・ソートして最適候補を返す
 *   - 単位: coolingCapacity は kW、airflowRate は m3/h
 * 【対応要件】: REQ-501, REQ-502, REQ-503
 * 🔵 信頼性レベル: TASK-0021 実装詳細・PRDセクション15.3に基づく
 */

// ============================================================================
// 型定義
// ============================================================================

export interface AhuCatalogEntry {
  modelId: string
  modelName: string
  /** 定格風量 (m3/h) */
  airflowRate: number
  /** 冷房能力 (kW) */
  coolingCapacity: number
  /** 暖房能力 (kW) */
  heatingCapacity: number
  staticPressure?: number
  dimensions?: { width: number; height: number; depth: number }
  ports?: Array<{ label: string; medium: string; position: number[] }>
}

export interface EquipmentSelectionResult {
  equipmentCandidates: string[]
  selectionStatus: 'candidates-available' | 'no-candidates'
  recommendedEquipmentId: string | null
}

/** デフォルト余裕率（REQ-503） */
export const DEFAULT_SELECTION_MARGIN = 1.1

// ============================================================================
// 公開純粋関数
// ============================================================================

/**
 * 【機能概要】: 容量・風量条件を満たす AHU カタログをフィルタする（REQ-502）
 * 【フィルタ条件】:
 *   - coolingCapacity >= totalCoolingLoadKw * margin
 *   - airflowRate >= totalAirflow * margin
 * 🔵 信頼性レベル: REQ-502 に両条件が明示
 * @param catalog - AHU カタログエントリ配列
 * @param totalCoolingLoadKw - 系統合算冷房負荷 (kW)
 * @param totalAirflow - 系統合算必要風量 (m3/h)
 * @param margin - 余裕率（デフォルト 1.1）
 * @returns 条件を満たす候補エントリ配列
 */
export function filterAhuCandidates(
  catalog: AhuCatalogEntry[],
  totalCoolingLoadKw: number,
  totalAirflow: number,
  margin: number = DEFAULT_SELECTION_MARGIN,
): AhuCatalogEntry[] {
  return catalog.filter(
    (entry) =>
      entry.coolingCapacity >= totalCoolingLoadKw * margin &&
      entry.airflowRate >= totalAirflow * margin,
  )
}

/**
 * 【機能概要】: 候補を容量過不足の少ない順にソートする（REQ-502）
 * 【ソート方針】:
 *   - 主: coolingCapacity 余剰が小さい順（最適機器が上位）
 *   - 副: airflowRate 余剰が小さい順
 * 🔵 信頼性レベル: REQ-502「容量過不足の少ない順」に明示
 * @param candidates - フィルタ済み候補配列
 * @param totalCoolingLoadKw - 系統合算冷房負荷 (kW)
 * @param margin - 余裕率
 * @returns ソート済み候補配列（元配列を変更しない）
 */
export function sortAhuCandidates(
  candidates: AhuCatalogEntry[],
  totalCoolingLoadKw: number,
  margin: number = DEFAULT_SELECTION_MARGIN,
): AhuCatalogEntry[] {
  return [...candidates].sort((a, b) => {
    const requiredCapacity = totalCoolingLoadKw * margin
    const overA = a.coolingCapacity - requiredCapacity
    const overB = b.coolingCapacity - requiredCapacity
    if (overA !== overB) return overA - overB
    // 二次ソート: 風量余剰が小さい順
    return a.airflowRate - b.airflowRate
  })
}

/**
 * 【機能概要】: 系統負荷から AHU 候補を選定する統合関数（REQ-501）
 * 【処理フロー】: フィルタ → ソート → 結果生成
 * 【候補なし時】: selectionStatus: 'no-candidates' で手動設定を許可（EDGE-005）
 * 🔵 信頼性レベル: REQ-501, REQ-502, REQ-503 を統合
 * @param totalCoolingLoadKw - 系統合算冷房負荷 (kW)
 * @param totalAirflow - 系統合算必要風量 (m3/h)
 * @param margin - 余裕率
 * @param catalog - AHU カタログエントリ配列
 * @returns EquipmentSelectionResult
 */
export function selectEquipment(
  totalCoolingLoadKw: number,
  totalAirflow: number,
  margin: number,
  catalog: AhuCatalogEntry[],
): EquipmentSelectionResult {
  const filtered = filterAhuCandidates(catalog, totalCoolingLoadKw, totalAirflow, margin)
  const sorted = sortAhuCandidates(filtered, totalCoolingLoadKw, margin)

  if (sorted.length === 0) {
    return {
      equipmentCandidates: [],
      selectionStatus: 'no-candidates',
      recommendedEquipmentId: null,
    }
  }

  return {
    equipmentCandidates: sorted.map((c) => c.modelId),
    selectionStatus: 'candidates-available',
    recommendedEquipmentId: sorted[0]?.modelId ?? null,
  }
}
