/**
 * 【機能概要】: EquipmentSelectionSystem — AHU候補選定システム
 * 【設計方針】:
 *   - useFrame ループ内で dirty な SystemNode を検出し候補選定を実行
 *   - 純粋計算ロジックは equipment-selection.ts に分離（テスタビリティ確保）
 *   - AHU カタログは catalog-ahu.json を参照
 *   - 負荷単位変換: aggregatedLoad.totalCoolingLoad (W) → kW に変換して比較
 * 【対応要件】: REQ-501, REQ-502, REQ-503
 * 🔵 信頼性レベル: TASK-0021 Systemsパターンに準拠
 */

import { useFrame } from '@react-three/fiber'
import catalogAhu from '../../data/catalog-ahu.json'
import useScene from '../../store/use-scene'
import type { AhuCatalogEntry } from './equipment-selection'
import { DEFAULT_SELECTION_MARGIN, selectEquipment } from './equipment-selection'

// catalog-ahu.json をキャスト
const AHU_CATALOG = catalogAhu as AhuCatalogEntry[]

export function EquipmentSelectionSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes, updateNode } = useScene.getState()
    if (dirtyNodes.size === 0) return

    for (const dirtyId of dirtyNodes) {
      const node = nodes[dirtyId]
      if (!node || node.type !== 'system') continue
      if (!node.aggregatedLoad) continue

      const margin = node.selectionMargin ?? DEFAULT_SELECTION_MARGIN
      // aggregatedLoad.totalCoolingLoad は W 単位 → kW に変換（REQ-502）
      const totalCoolingLoadKw = node.aggregatedLoad.totalCoolingLoad / 1000
      const totalAirflow = node.aggregatedLoad.totalAirflow

      const result = selectEquipment(totalCoolingLoadKw, totalAirflow, margin, AHU_CATALOG)

      updateNode(dirtyId, {
        equipmentCandidates: result.equipmentCandidates,
        selectionStatus: result.selectionStatus,
        recommendedEquipmentId: result.recommendedEquipmentId,
      })
    }
  })

  return null
}
