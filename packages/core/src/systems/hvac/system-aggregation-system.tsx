/**
 * 【機能概要】: SystemAggregationSystem — 系統集計計算システム
 * 【設計方針】:
 *   - useFrame ループ内で dirty な SystemNode / HvacZoneNode を検出し再集計
 *   - 純粋計算ロジックは system-aggregation.ts に分離（テスタビリティ確保）
 *   - Core パッケージに配置（純粋計算ロジック、Three.js 描画なし）
 * 【対応要件】: REQ-402, REQ-404, REQ-405, REQ-1802
 * 🔵 信頼性レベル: TASK-0019 architecture.md Systemsパターンに準拠
 */

import { useFrame } from '@react-three/fiber'
import useScene from '../../store/use-scene'
import { aggregateSystemLoad, findSystemsForZone } from './system-aggregation'

export function SystemAggregationSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes, updateNode } = useScene.getState()
    if (dirtyNodes.size === 0) return

    // dirty ノードから再集計が必要な SystemNode ID を収集
    const systemsToUpdate = new Set<string>()

    for (const dirtyId of dirtyNodes) {
      const node = nodes[dirtyId as keyof typeof nodes]
      if (!node) continue

      if (node.type === 'system') {
        // SystemNode 自体が dirty の場合は再集計対象
        systemsToUpdate.add(dirtyId)
      } else if (node.type === 'hvac_zone') {
        // ゾーン負荷が変更された場合は関連する SystemNode を再集計対象にする（REQ-1802）
        for (const systemId of findSystemsForZone(dirtyId, nodes)) {
          systemsToUpdate.add(systemId)
        }
      }
    }

    // 各 SystemNode の aggregatedLoad を更新（REQ-404）
    for (const systemId of systemsToUpdate) {
      const system = nodes[systemId as keyof typeof nodes]
      if (!system || system.type !== 'system') continue
      const aggregatedLoad = aggregateSystemLoad(system.servedZoneIds, nodes)
      updateNode(systemId as keyof typeof nodes, { aggregatedLoad })
    }
  })

  return null
}
