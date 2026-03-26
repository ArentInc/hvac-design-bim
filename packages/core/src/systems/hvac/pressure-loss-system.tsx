/**
 * TASK-0034: PressureLossSystem — ダクト圧損計算システム
 *
 * 【機能概要】: DuctSizingSystem 完了後に dirty な DuctSegment を監視し、
 *             寸法が確定した区間の圧損を計算して updateNode する
 * 【設計方針】: 純粋計算ロジックは pressure-loss.ts に分離。Core パッケージ配置（Three.js 禁止）
 * 【実行順序】: DuctSizingSystem → PressureLossSystem の順に実行されること
 * 【対応要件】: REQ-1001~1004（直管圧損、継手損失、最遠経路、requiredFanPressure）
 * 🔵 信頼性レベル: TASK-0034 architecture.md Systemsパターンに準拠
 */

import { useFrame } from '@react-three/fiber'
import useScene from '../../store/use-scene'
import {
  calcAllPathPressureLosses,
  calcRequiredFanPressure,
  calcStraightDuctLoss,
  findDirtySystemsForPressureLoss,
  findMaxPathPressureLoss,
} from './pressure-loss'

// セグメント長計算用ヘルパー
function segmentLength(start: [number, number, number], end: [number, number, number]): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function PressureLossSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes, updateNode } = useScene.getState()
    if (dirtyNodes.size === 0) return

    const systemIds = findDirtySystemsForPressureLoss(dirtyNodes, nodes)
    if (systemIds.size === 0) return

    for (const systemId of systemIds) {
      // 各 DuctSegment の個別圧損を計算して calcResult に反映 (REQ-1001)
      for (const [nodeId, node] of Object.entries(nodes)) {
        if (node.type !== 'duct_segment') continue
        if ((node as typeof node & { systemId: string }).systemId !== systemId) continue
        if (!node.width || !node.height || !node.airflowRate) continue

        const length = segmentLength(node.start, node.end)
        const pressureLoss = calcStraightDuctLoss(
          length,
          node.width / 1000,
          node.height / 1000,
          node.airflowRate,
          node.ductMaterial,
        )

        // calcResult を更新（変更がある場合のみ）
        const prevLoss = node.calcResult?.totalPressureLoss ?? 0
        if (Math.abs(prevLoss - pressureLoss) > 0.001) {
          const q = node.airflowRate / 3600
          const area = (node.width / 1000) * (node.height / 1000)
          const velocity = q / area
          updateNode(nodeId as keyof typeof nodes, {
            calcResult: {
              velocity,
              frictionLoss: pressureLoss,
              totalPressureLoss: pressureLoss,
            },
          })
        }
      }

      // 全経路の圧損を計算し最遠経路から requiredFanPressure を算出 (REQ-1004)
      const pathLosses = calcAllPathPressureLosses(systemId, nodes)
      if (pathLosses.size === 0) continue

      const maxLoss = findMaxPathPressureLoss(pathLosses)
      const requiredFanPressure = calcRequiredFanPressure(maxLoss)

      // SystemNode に反映
      const systemNode = Object.values(nodes).find((n) => n.type === 'system' && n.id === systemId)
      if (systemNode) {
        const prev = (systemNode as typeof systemNode & { requiredFanPressure?: number })
          .requiredFanPressure
        if (prev !== requiredFanPressure) {
          updateNode(systemId as keyof typeof nodes, { requiredFanPressure })
        }
      }

      // AHU との比較警告ログ (REQ-1004)
      const ahuNode = Object.values(nodes).find(
        (n) => n.type === 'ahu' && (n as typeof n & { systemId: string }).systemId === systemId,
      )
      if (ahuNode && ahuNode.type === 'ahu') {
        if (requiredFanPressure > ahuNode.staticPressure) {
          console.warn(
            `[PressureLossSystem] 必要送風静圧 ${requiredFanPressure.toFixed(1)} Pa が ` +
              `AHU定格静圧 ${ahuNode.staticPressure} Pa を超過しています (systemId: ${systemId})`,
          )
        }
      }
    }
  })

  return null
}
