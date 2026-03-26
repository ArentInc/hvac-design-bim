/**
 * 【機能概要】: ZoneGroupingTool — ゾーングルーピングツール
 * 【設計方針】:
 *   - 複数 HvacZone を選択し、1つの SystemNode にグルーピングする
 *   - N:1 制約（1ゾーンが複数系統に属さない）をバリデーション
 *   - dirtyNode システムにより SystemAggregationSystem が自動的に再集計
 *   - Three.js API を直接呼ばない（Toolsルール）
 * 【対応要件】: REQ-401, REQ-403, REQ-404
 * 🔵 信頼性レベル: TASK-0020 実装詳細・dataflow.md機能2に基づく
 */

import { SystemNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { toggleZoneSelection, validateZoneAssignment } from './zone-grouping-logic'

export function ZoneGroupingTool() {
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([])
  const [conflictError, setConflictError] = useState<string | null>(null)

  const levelId = useViewer((state) => state.levelId)

  /**
   * ゾーン選択ハンドラ
   * @param zoneId - クリックされたゾーン ID
   * @param isMulti - Ctrl/Meta クリックによる複数選択モード
   */
  const handleZoneSelect = (zoneId: string, isMulti: boolean) => {
    setSelectedZoneIds((prev) => (isMulti ? toggleZoneSelection(zoneId, prev) : [zoneId]))
    setConflictError(null)
  }

  /**
   * 「系統に追加」操作
   * - N:1 制約バリデーション
   * - SystemNode 作成 + 各ゾーンへの systemId 設定
   */
  const handleCreateSystem = () => {
    if (selectedZoneIds.length === 0) return

    const { nodes, createNode, updateNode } = useScene.getState()

    // N:1 制約チェック（REQ-403）
    const conflicts = validateZoneAssignment(
      selectedZoneIds,
      nodes as Record<string, { type: string; systemId?: string | null }>,
    )
    if (conflicts.length > 0) {
      setConflictError(`ゾーン ${conflicts.join(', ')} は既に別の系統に属しています`)
      return
    }

    // SystemNode 作成（REQ-401）
    const systemNode = SystemNode.parse({
      systemName: `系統-${Date.now()}`,
      servedZoneIds: selectedZoneIds,
      ahuId: null,
      aggregatedLoad: null,
      status: 'draft',
    })

    createNode(systemNode, levelId ?? undefined)

    // 各ゾーンに systemId を設定（REQ-401）
    for (const zoneId of selectedZoneIds) {
      updateNode(zoneId, { systemId: systemNode.id })
    }

    // createNode/updateNode により dirty フラグが自動セットされ、
    // SystemAggregationSystem が次フレームで再集計（REQ-404）
    setSelectedZoneIds([])
    setConflictError(null)
  }

  // ToolManager から呼び出されるイベントハンドラを expose
  // 実際の UI レンダリングは後続の SystemTreePanel (TASK-0027) で実装
  return null
}
