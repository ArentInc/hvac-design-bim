/**
 * 【機能概要】: ZoneGroupingTool 用純粋ロジック関数群
 * 【設計方針】:
 *   - @pascal-app/core や Three.js に依存しない純粋関数として実装
 *   - ZoneGroupingTool コンポーネントおよびテストから利用
 * 【対応要件】: REQ-401, REQ-403
 * 🔵 信頼性レベル: TASK-0020 実装詳細に基づく
 */

// ============================================================================
// 型定義（@pascal-app/core に依存しない最小型）
// ============================================================================

/** validateZoneAssignment で必要なノードの最小型 */
export type ZoneNodeLike = {
  type: string
  systemId?: string | null
}

// ============================================================================
// 公開純粋関数
// ============================================================================

/**
 * 【機能概要】: N:1 制約バリデーション — 既に系統に属するゾーン ID を返す（REQ-403）
 * 【判定条件】: type === 'hvac_zone' かつ systemId が null でない
 * 🔵 信頼性レベル: REQ-403「1ゾーンが複数系統に属さない」に明示
 * @param zoneIds - バリデーション対象のゾーン ID 配列
 * @param nodes - シーンノード辞書（type / systemId フィールドのみ参照）
 * @returns 既に別の系統に属しているゾーン ID の配列（競合なしの場合は空配列）
 */
export function validateZoneAssignment(
  zoneIds: string[],
  nodes: Record<string, ZoneNodeLike>,
): string[] {
  return zoneIds.filter((id) => {
    const node = nodes[id]
    return node?.type === 'hvac_zone' && node.systemId != null
  })
}

/**
 * 【機能概要】: ゾーン選択のトグル（Ctrl+クリック相当）（REQ-401）
 * 【動作】: 既に選択済みなら除外、未選択なら追加
 * 🔵 信頼性レベル: REQ-401「複数ゾーン選択」に明示
 * @param zoneId - トグル対象のゾーン ID
 * @param selectedZoneIds - 現在の選択済みゾーン ID 配列
 * @returns 新しい選択済みゾーン ID 配列
 */
export function toggleZoneSelection(zoneId: string, selectedZoneIds: string[]): string[] {
  return selectedZoneIds.includes(zoneId)
    ? selectedZoneIds.filter((id) => id !== zoneId)
    : [...selectedZoneIds, zoneId]
}
