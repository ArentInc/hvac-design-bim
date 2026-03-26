/**
 * TASK-0032: DuctSizingSystem — ダクト寸法選定システム
 *
 * 【機能概要】: useFrame で dirty な DuctSegment を監視し、等速法で寸法を自動決定して updateNode する
 * 【設計方針】: 純粋計算ロジックは duct-sizing.ts に分離。Core パッケージ配置（Three.js インポート禁止）
 * 【実行順序】: AirflowDistributionSystem → DuctSizingSystem の順に実行されること
 * 【対応要件】: REQ-901（等速法）, REQ-902（推奨風速）, REQ-903（アスペクト比制約）
 * 🔵 信頼性レベル: TASK-0032 architecture.md Systemsパターンに準拠
 */

import { useFrame } from '@react-three/fiber'
import type { AnyNodeId } from '../../schema/types'
import useScene from '../../store/use-scene'
import { calcDuctSize, findDirtyDuctSegmentsForSizing, selectDuctVelocity } from './duct-sizing'

export function DuctSizingSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes, updateNode } = useScene.getState()
    if (dirtyNodes.size === 0) return

    const segmentIds = findDirtyDuctSegmentsForSizing(dirtyNodes, nodes)
    if (segmentIds.length === 0) return

    for (const segId of segmentIds) {
      const seg = nodes[segId as AnyNodeId]
      if (!seg || seg.type !== 'duct_segment') continue
      if (seg.airflowRate == null || seg.airflowRate <= 0) continue

      // 幹線/枝線を判定して推奨風速を選択 (REQ-902)
      const velocity = selectDuctVelocity(segId, seg.systemId, nodes)

      // 等速法で断面寸法を算出 (REQ-901, REQ-903)
      const result = calcDuctSize(seg.airflowRate, velocity)
      if (!result) continue

      // 変更がある場合のみ更新（不要な dirty マークを防止）
      if (seg.width !== result.width || seg.height !== result.height) {
        updateNode(segId as AnyNodeId, {
          width: result.width,
          height: result.height,
        })
      }
    }
  })

  return null
}
