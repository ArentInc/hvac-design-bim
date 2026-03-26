/**
 * TASK-0037: PipeVisualSystem — 配管色・太さ更新システム
 *
 * 【機能概要】: 口径確定後の配管メッシュの断面比例太さ更新、
 *             接続状態・口径確定状態に応じたカラー変更を行う
 * 【設計方針】:
 *   - Viewer システムとして実装（useFrame 内で dirtyNodes を監視）
 *   - sceneRegistry 経由でレンダラーが作成したメッシュを読み取り専用で参照・更新
 *   - 純粋ヘルパー関数をエクスポートしてテスタビリティを確保
 * 【Viewer 隔離】: @pascal-app/editor への依存禁止
 * 【対応要件】: REQ-1503（配管3Dビジュアル）
 * 🔵 信頼性レベル: TASK-0037 architecture.md viewerシステムパターンに準拠
 */

import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { sceneRegistry, useScene } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { MeshStandardMaterial } from 'three'

// ============================================================================
// 定数: 配管状態カラー (REQ-1503)
// ============================================================================

/** 冷水配管カラー */
export const PIPE_COLOR_CHILLED = '#0288D1'

/** 温水配管カラー (REQ-1503) */
export const PIPE_COLOR_HOT = '#01579B'

/** 冷媒ドレン配管カラー */
export const PIPE_COLOR_CONDENSATE = '#78909C'

/** 口径未確定 — サイジング待ち */
export const PIPE_COLOR_UNSIZED = '#BDBDBD'

/** 口径未確定時の最小表示スケール (m) */
export const PIPE_MIN_SCALE = 0.015

// ============================================================================
// 型定義
// ============================================================================

export type PipeVisualState = 'connected' | 'partial' | 'unsized'

// ============================================================================
// 純粋ヘルパー関数（テスト可能）
// ============================================================================

/**
 * 配管の接続・口径状態からビジュアル状態を決定する
 * @param nominalSize - 呼び径 (A、0 または null は未確定)
 * @param startConnected - 始端が接続済みか
 * @param endConnected - 終端が接続済みか
 */
export function getPipeVisualState(
  nominalSize: number | null,
  startConnected: boolean,
  endConnected: boolean,
): PipeVisualState {
  if (!nominalSize || nominalSize <= 0) {
    return 'unsized'
  }
  if (!startConnected || !endConnected) {
    return 'partial'
  }
  return 'connected'
}

/**
 * ビジュアル状態と媒体種別に対応するカラーコードを返す (REQ-1503)
 * @param state - ビジュアル状態
 * @param medium - 配管媒体種別
 */
export function getPipeColor(
  state: PipeVisualState,
  medium: 'chilled_water' | 'hot_water' | 'condensate' | string,
): string {
  if (state === 'unsized') {
    return PIPE_COLOR_UNSIZED
  }
  switch (medium) {
    case 'chilled_water':
      return PIPE_COLOR_CHILLED
    case 'hot_water':
      return PIPE_COLOR_HOT
    case 'condensate':
      return PIPE_COLOR_CONDENSATE
    default:
      return PIPE_COLOR_UNSIZED
  }
}

/**
 * 外径比例スケールを計算する（mm → Three.js スケール値）(REQ-1503)
 * @param outerDiameterMm - 外径 (mm)
 * @returns スケール値（m 単位）
 */
export function calcPipeMeshScale(outerDiameterMm: number | null): number {
  if (!outerDiameterMm || outerDiameterMm <= 0) {
    return PIPE_MIN_SCALE
  }
  return outerDiameterMm / 1000
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * portId が接続先ノード（AHU/DuctFitting/他の配管セグメント）のポートと対応しているかチェック
 */
function checkPipePortConnected(portId: string, nodes: Record<string, AnyNode>): boolean {
  for (const node of Object.values(nodes)) {
    if (node.type === 'ahu') {
      if (node.ports.some((p) => p.id === portId)) return true
    }
    if (node.type === 'pipe_segment') {
      if (node.startPortId === portId || node.endPortId === portId) {
        // 別ノードのポートと一致する場合のみ（自分自身は除外）
        // 同じportIdを共有している他のpipe_segmentが存在すれば接続済み
      }
    }
  }
  // AHU以外にも、他のpipe_segmentのstartPortId/endPortIdと一致するかチェック
  const matchingSegments = Object.values(nodes).filter(
    (n) => n.type === 'pipe_segment' && (n.startPortId === portId || n.endPortId === portId),
  )
  // 2つ以上のセグメントが同じポートIDを持つ場合、接続済みとみなす
  if (matchingSegments.length >= 2) return true

  return false
}

// ============================================================================
// ビューワーシステムコンポーネント
// ============================================================================

export function PipeVisualSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes } = useScene.getState()
    if (dirtyNodes.size === 0) return

    // dirtyNodes に pipe_segment が含まれるか確認
    const hasDirtyPipes = Array.from(dirtyNodes).some(
      (id) => nodes[id as AnyNodeId]?.type === 'pipe_segment',
    )
    if (!hasDirtyPipes) return

    // 全配管セグメントのビジュアルを更新
    sceneRegistry.byType.pipe_segment.forEach((pipeId) => {
      const obj = sceneRegistry.nodes.get(pipeId)
      if (!obj) return

      const seg = nodes[pipeId as AnyNodeId]
      if (!seg || seg.type !== 'pipe_segment') return

      // 接続状態を判定
      const startConnected = checkPipePortConnected(seg.startPortId, nodes)
      const endConnected = checkPipePortConnected(seg.endPortId, nodes)

      // ビジュアル状態を決定
      const state = getPipeVisualState(seg.nominalSize, startConnected, endConnected)

      // メッシュのスケールを外径比例に更新 (REQ-1503)
      const scale = calcPipeMeshScale(seg.outerDiameter)
      obj.scale.set(scale, scale, obj.scale.z)

      // マテリアルカラーを状態に応じて更新 (REQ-1503)
      const colorHex = getPipeColor(state, seg.medium)
      obj.traverse((child) => {
        if ('material' in child) {
          const mat = (child as Mesh).material
          if (mat instanceof MeshStandardMaterial) {
            mat.color.setStyle(colorHex)
          }
        }
      })
    })
  })

  return null
}
