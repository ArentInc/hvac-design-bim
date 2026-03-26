'use client'

// TASK-0037: PipePanel — 配管プロパティパネル（読み取り専用）
// 【機能概要】: PipeSegmentノードのプロパティ表示パネル
// 【設計方針】: MVPでは口径・流量は自動算出のため基本的に表示のみ
// 🔵 信頼性レベル: REQ-1403（配管プロパティパネル）に明示

import type { PipeSegmentNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

// 【定数定義】: PipeMediumの日本語ラベルマッピング
const MEDIUM_LABELS: Record<PipeSegmentNode['medium'], string> = {
  chilled_water: '冷水',
  hot_water: '温水',
  condensate: '冷媒ドレン',
}

// 【useSceneセレクター型】
interface SceneState {
  nodes: Record<string, { type: string } & Partial<PipeSegmentNode>>
  updateNode: (id: string, data: Partial<PipeSegmentNode>) => void
}

/**
 * ノードがPipeSegmentNodeであることを検証するtype guard
 * 🔵 信頼性レベル: pipe-segment.tsのtype定義（type: 'pipe_segment'）に基づく
 */
function isPipeSegmentNode(
  node: { type: string } & Partial<PipeSegmentNode>,
): node is PipeSegmentNode {
  return node.type === 'pipe_segment'
}

/**
 * 2点間のユークリッド距離を計算する（m）
 */
function calcDistance(start: [number, number, number], end: [number, number, number]): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * 【機能概要】: PipeSegmentノードのプロパティパネル（メインコンポーネント）
 * 【設計方針】:
 *   - useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
 *   - useSceneからnodesを取得
 *   - 選択なし/非PipeSegmentノードの場合はnullを返す（早期リターン）
 *   - MVPでは全フィールド読み取り専用
 * 🔵 信頼性レベル: REQ-1403（配管プロパティパネル）に明示
 */
export function PipePanel() {
  // 【selectedIds取得】: useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
  const selectedIds = useViewer((s: { selectedIds: string[] }) => s.selectedIds)

  // 【ストア状態取得】: useSceneを1回呼び出しでnodesを取得
  const { nodes } = useScene((s: SceneState) => ({
    nodes: s.nodes,
  }))

  // 【早期リターン】: 選択なし → null
  if (selectedIds.length === 0) return null

  // 【ノード取得】: 最初の選択IDでノードを取得
  const pipeId = selectedIds[0]
  const node = nodes[pipeId]

  // 【型ガード適用】: isPipeSegmentNode で安全な型チェック
  if (!node || !isPipeSegmentNode(node)) return null

  // 【配管長計算】: start/end 2点間のユークリッド距離（m）
  const length = calcDistance(node.start, node.end)

  return (
    <div>
      <h2>配管プロパティ</h2>

      {/* 【口径】: 呼び径 A 表記、読み取り専用 */}
      <div>
        <span>口径</span>
        <span>{node.nominalSize != null ? `${node.nominalSize}A` : '未選定'}</span>
      </div>

      {/* 【外径】: mm、読み取り専用 */}
      <div>
        <span>外径 (mm)</span>
        <span>{node.outerDiameter != null ? node.outerDiameter : '未選定'}</span>
      </div>

      {/* 【流速】: m/s、読み取り専用 */}
      <div>
        <span>流速 (m/s)</span>
        <span>{node.calcResult != null ? node.calcResult.velocity : '未計算'}</span>
      </div>

      {/* 【圧損】: kPa、読み取り専用 */}
      <div>
        <span>圧損 (kPa)</span>
        <span>{node.calcResult != null ? node.calcResult.pressureDrop : '未計算'}</span>
      </div>

      {/* 【媒体】: 日本語ラベル表示 */}
      <div>
        <span>媒体</span>
        <span>{MEDIUM_LABELS[node.medium] ?? node.medium}</span>
      </div>

      {/* 【配管長】: start→end距離（m）読み取り専用 */}
      <div>
        <span>配管長 (m)</span>
        <span>{length.toFixed(2)}</span>
      </div>
    </div>
  )
}
