/**
 * 【機能概要】: AirflowDistributionSystem 用純粋関数群
 * 【設計方針】:
 *   - useFrame や React に依存しない純粋関数として実装（テスタビリティ重視）
 *   - React コンポーネント (airflow-distribution-system.tsx) から呼び出す
 * 【対応要件】: REQ-801（風量自動配分）, REQ-802（制気口風量取得）,
 *             REQ-803（AHU幹線合計検証）, REQ-804（手動上書き時の再計算）
 * 🔵 信頼性レベル: TASK-0031 実装詳細に基づく
 */

import type { AnyNode } from '../../schema/types'
import { aggregateAirflow, buildSystemGraph, detectCycles } from '../../utils/hvac-graph'

// ============================================================================
// 型定義
// ============================================================================

export interface DistributeAirflowResult {
  /** segmentId → 計算済み風量 (m³/h) */
  airflowMap: Map<string, number>
  /** REQ-803: AHU幹線整合性警告など */
  warnings: string[]
  /** EDGE-004: サイクル検出エラーなど */
  errors: string[]
}

/** AHU幹線整合性チェックの許容誤差率（5%） */
export const AHU_AIRFLOW_TOLERANCE = 0.05

// ============================================================================
// 公開純粋関数
// ============================================================================

/**
 * 【機能概要】: AHU起点のダクトグラフをトラバースし各DuctSegmentの風量を合算設定する (REQ-801)
 * 【設計方針】:
 *   - hvac-graph.ts の buildSystemGraph / aggregateAirflow / detectCycles を利用
 *   - サイクル検出時は即座に中断してエラーを返す (EDGE-004)
 *   - AHU直近幹線の風量とAHU定格風量を比較して警告を返す (REQ-803)
 * 🔵 信頼性レベル: REQ-801~804, EDGE-004 に明示
 * @param systemId - 対象 SystemNode の ID
 * @param nodes - シーン全ノード辞書
 * @returns airflowMap（segmentId → 風量）, warnings, errors
 */
export function distributeAirflow(
  systemId: string,
  nodes: Record<string, AnyNode>,
): DistributeAirflowResult {
  const warnings: string[] = []
  const errors: string[] = []

  // グラフ構築
  const graph = buildSystemGraph(systemId, nodes)

  if (graph.root === null) {
    return { airflowMap: new Map(), warnings, errors }
  }

  // サイクル検出 (EDGE-004)
  const cycleResult = detectCycles(graph)
  if (cycleResult.hasCycle) {
    errors.push('ダクト接続にループが検出されました')
    return { airflowMap: new Map(), warnings, errors }
  }

  // 葉→根の逆トラバースで各区間風量を合算 (REQ-801, REQ-802)
  const airflowMap = aggregateAirflow(graph, nodes)

  // AHU直近幹線のtotalAirflow検証 (REQ-803)
  const ahuNode = nodes[graph.root]
  if (ahuNode?.type === 'ahu') {
    const ahuAirflow = ahuNode.airflowRate
    const ahuGraphNode = graph.nodes.get(graph.root)

    if (ahuGraphNode && ahuAirflow > 0) {
      for (const neighborId of ahuGraphNode.neighbors) {
        const neighborNode = nodes[neighborId]
        if (neighborNode?.type === 'duct_segment') {
          const segAirflow = airflowMap.get(neighborId) ?? 0
          const ratio = Math.abs(segAirflow - ahuAirflow) / ahuAirflow
          if (ratio > AHU_AIRFLOW_TOLERANCE) {
            warnings.push(
              `AHU直近幹線の風量 ${segAirflow} m³/h がAHU定格風量 ${ahuAirflow} m³/h と乖離しています（差異: ${(ratio * 100).toFixed(1)}%）`,
            )
          }
          break // 直近幹線は1本のみ検証
        }
      }
    }
  }

  return { airflowMap, warnings, errors }
}

/**
 * 【機能概要】: dirty ノードセットにAirflowDistributionSystemが再計算すべきノードが含まれるか判定
 * 【設計方針】:
 *   - DuctSegment / Diffuser / AHU が dirty の場合に再計算対象
 *   - 該当 systemId を返すことで、System 側でフィルタリング可能にする
 * 🔵 信頼性レベル: TASK-0031 実装詳細セクション1に明示
 * @param dirtyIds - 変更のあったノード ID セット
 * @param nodes - シーン全ノード辞書
 * @returns 再計算が必要な systemId の Set
 */
export function findDirtyAirflowSystems(
  dirtyIds: Set<string>,
  nodes: Record<string, AnyNode>,
): Set<string> {
  const systemIds = new Set<string>()

  for (const dirtyId of dirtyIds) {
    const node = nodes[dirtyId]
    if (!node) continue

    if (
      node.type === 'duct_segment' ||
      node.type === 'diffuser' ||
      node.type === 'ahu' ||
      node.type === 'duct_fitting'
    ) {
      const nodeWithSystem = node as AnyNode & { systemId: string }
      if (nodeWithSystem.systemId) {
        systemIds.add(nodeWithSystem.systemId)
      }
    }
  }

  return systemIds
}
