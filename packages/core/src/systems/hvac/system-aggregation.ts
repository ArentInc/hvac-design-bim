/**
 * 【機能概要】: SystemAggregationSystem 用純粋関数群
 * 【設計方針】:
 *   - useFrame や React に依存しない純粋関数として実装（テスタビリティ重視）
 *   - React コンポーネント (system-aggregation-system.tsx) から呼び出す
 * 【対応要件】: REQ-402, REQ-404, REQ-405, REQ-1802
 * 🔵 信頼性レベル: TASK-0019 実装詳細に基づく
 */

import type { AnyNode } from '../../schema/types'

// ============================================================================
// 型定義
// ============================================================================

export interface AggregatedLoadResult {
  totalCoolingLoad: number
  totalHeatingLoad: number
  totalAirflow: number
}

// ============================================================================
// 公開純粋関数
// ============================================================================

/**
 * 【機能概要】: servedZoneIds から各ゾーンの負荷を合算する（REQ-405）
 * 【設計方針】: calcResult が null のゾーン・存在しないゾーンは 0 として扱う
 * 🔵 信頼性レベル: REQ-405 に合算ロジックが明示
 * @param servedZoneIds - 集計対象のゾーン ID 配列
 * @param nodes - シーン全ノード辞書
 * @returns totalCoolingLoad / totalHeatingLoad / totalAirflow の合算結果
 */
export function aggregateSystemLoad(
  servedZoneIds: string[],
  nodes: Record<string, AnyNode>,
): AggregatedLoadResult {
  let totalCoolingLoad = 0
  let totalHeatingLoad = 0
  let totalAirflow = 0

  for (const zoneId of servedZoneIds) {
    const zone = nodes[zoneId]
    if (zone?.type === 'hvac_zone' && zone.calcResult) {
      totalCoolingLoad += zone.calcResult.coolingLoad
      totalHeatingLoad += zone.calcResult.heatingLoad
      totalAirflow += zone.calcResult.requiredAirflow
    }
  }

  return { totalCoolingLoad, totalHeatingLoad, totalAirflow }
}

/**
 * 【機能概要】: 指定ゾーンを servedZoneIds に含む SystemNode の ID 一覧を返す（REQ-1802）
 * 【設計方針】: ゾーン負荷が変更された際に再集計対象の系統を特定するために使用
 * 🔵 信頼性レベル: REQ-1802「ゾーン負荷変更時の再集計」に明示
 * @param zoneId - 検索対象のゾーン ID
 * @param nodes - シーン全ノード辞書
 * @returns そのゾーンを含む SystemNode の ID 配列
 */
export function findSystemsForZone(zoneId: string, nodes: Record<string, AnyNode>): string[] {
  return Object.values(nodes)
    .filter((node) => node.type === 'system' && node.servedZoneIds.includes(zoneId))
    .map((node) => node.id)
}
