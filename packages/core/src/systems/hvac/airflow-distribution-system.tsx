/**
 * 【機能概要】: AirflowDistributionSystem — 風量自動配分システム
 * 【設計方針】:
 *   - useFrame ループ内で dirty な DuctSegment / Diffuser / AHU を検出し風量配分を再計算
 *   - 純粋計算ロジックは airflow-distribution.ts に分離（テスタビリティ確保）
 *   - Core パッケージに配置（Three.js 描画なし）
 * 【対応要件】: REQ-801（風量自動配分）, REQ-802（制気口風量取得）,
 *             REQ-803（AHU幹線合計検証）, REQ-804（手動上書き時の再計算）
 * 🔵 信頼性レベル: TASK-0031 architecture.md Systemsパターンに準拠
 */

import { useFrame } from '@react-three/fiber'
import useScene from '../../store/use-scene'
import { distributeAirflow, findDirtyAirflowSystems } from './airflow-distribution'

export function AirflowDistributionSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes, updateNode } = useScene.getState()
    if (dirtyNodes.size === 0) return

    // dirty ノードから再計算が必要な systemId を収集 (REQ-804)
    const systemsToUpdate = findDirtyAirflowSystems(dirtyNodes, nodes)
    if (systemsToUpdate.size === 0) return

    for (const systemId of systemsToUpdate) {
      const result = distributeAirflow(systemId, nodes)

      // サイクル検出エラーをログ出力 (EDGE-004)
      for (const error of result.errors) {
        console.error(`[AirflowDistributionSystem] ${error} (systemId: ${systemId})`)
      }

      // AHU幹線不整合警告をログ出力 (REQ-803)
      for (const warning of result.warnings) {
        console.warn(`[AirflowDistributionSystem] ${warning} (systemId: ${systemId})`)
      }

      // 各 DuctSegment の airflowRate を更新 (REQ-801)
      for (const [segmentId, airflowRate] of result.airflowMap) {
        const node = nodes[segmentId]
        if (!node || node.type !== 'duct_segment') continue

        // 変更がある場合のみ更新（不要な再描画を防止）
        if (node.airflowRate !== airflowRate) {
          updateNode(segmentId as keyof typeof nodes, { airflowRate })
        }
      }
    }
  })

  return null
}
