/**
 * TASK-0033: DuctVisualSystem — ダクト太さ・色・ラベル更新システム
 *
 * 【機能概要】: 寸法確定後のダクトメッシュの断面比例太さ更新、
 *             接続状態・寸法確定状態に応じたカラー変更、風量+寸法ラベルの表示を行う
 * 【設計方針】:
 *   - Viewer システムとして実装（useFrame 内で dirtyNodes を監視）
 *   - sceneRegistry 経由でレンダラーが作成したメッシュを読み取り専用で参照・更新
 *   - 純粋ヘルパー関数をエクスポートしてテスタビリティを確保
 * 【Viewer 隔離】: @pascal-app/editor への依存禁止
 * 【対応要件】: REQ-1502（ダクト3Dビジュアル）
 * 🔵 信頼性レベル: TASK-0033 architecture.md viewerシステムパターンに準拠
 */

import type { AnyNode } from '@pascal-app/core'
import { sceneRegistry, useScene } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { MeshStandardMaterial } from 'three'

// ============================================================================
// 定数: ダクト状態カラー (REQ-1502)
// ============================================================================

/** 寸法確定 + 両端接続済み — 正常状態 */
export const DUCT_COLOR_CONNECTED = '#90CAF9'

/** 寸法確定 + 片端未接続 — 接続不完全 */
export const DUCT_COLOR_PARTIAL = '#FFA726'

/** 寸法未確定 — サイジング待ち */
export const DUCT_COLOR_UNSIZED = '#BDBDBD'

/** エラー状態（圧損超過等） */
export const DUCT_COLOR_ERROR = '#EF5350'

/** 寸法未確定時の最小表示スケール (m) */
export const DUCT_MIN_SCALE = 0.05

// ============================================================================
// 型定義
// ============================================================================

export type DuctVisualState = 'connected' | 'partial' | 'unsized' | 'error'

// ============================================================================
// 純粋ヘルパー関数（テスト可能）
// ============================================================================

/**
 * ダクトの接続・寸法状態からビジュアル状態を決定する
 * @param width - ダクト幅 (mm、0 または null は未確定)
 * @param height - ダクト高さ (mm、0 または null は未確定)
 * @param startConnected - 始端が接続済みか
 * @param endConnected - 終端が接続済みか
 */
export function getDuctVisualState(
  width: number | null,
  height: number | null,
  startConnected: boolean,
  endConnected: boolean,
): DuctVisualState {
  if (!width || !height || width <= 0 || height <= 0) {
    return 'unsized'
  }
  if (!startConnected || !endConnected) {
    return 'partial'
  }
  return 'connected'
}

/**
 * ビジュアル状態に対応するカラーコードを返す (REQ-1502)
 */
export function getDuctColor(state: DuctVisualState): string {
  switch (state) {
    case 'connected':
      return DUCT_COLOR_CONNECTED
    case 'partial':
      return DUCT_COLOR_PARTIAL
    case 'unsized':
      return DUCT_COLOR_UNSIZED
    case 'error':
      return DUCT_COLOR_ERROR
  }
}

/**
 * 風量ラベルのフォーマット (REQ-1502)
 * @param airflowRateM3h - 風量 (m³/h)
 * @returns フォーマット済みラベル文字列（例: "600 m³/h"）
 */
export function formatAirflowLabel(airflowRateM3h: number): string {
  return `${Math.round(airflowRateM3h)} m³/h`
}

/**
 * 寸法ラベルのフォーマット (REQ-1502)
 * @param widthMm - 幅 (mm)
 * @param heightMm - 高さ (mm)
 * @returns フォーマット済みラベル文字列（例: "400×300"）
 */
export function formatDimensionLabel(widthMm: number, heightMm: number): string {
  return `${widthMm}×${heightMm}`
}

/**
 * 断面比例スケールを計算する（mm → Three.js スケール値）(REQ-1502)
 * @param widthMm - ダクト幅 (mm)
 * @param heightMm - ダクト高さ (mm)
 * @returns {x, y} スケール値（m 単位）
 */
export function calcDuctMeshScale(
  widthMm: number | null,
  heightMm: number | null,
): { x: number; y: number } {
  const x = widthMm && widthMm > 0 ? widthMm / 1000 : DUCT_MIN_SCALE
  const y = heightMm && heightMm > 0 ? heightMm / 1000 : DUCT_MIN_SCALE
  return { x, y }
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * portId が接続先ノード（AHU/Diffuser/DuctFitting）のポートと対応しているかチェック
 */
function checkPortConnected(portId: string, nodes: Record<string, AnyNode>): boolean {
  for (const node of Object.values(nodes)) {
    if (node.type === 'ahu' || node.type === 'duct_fitting') {
      if (node.ports.some((p) => p.id === portId)) return true
    }
    if (node.type === 'diffuser') {
      if (node.port.id === portId) return true
    }
  }
  return false
}

// ============================================================================
// ビューワーシステムコンポーネント
// ============================================================================

export function DuctVisualSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes } = useScene.getState()
    if (dirtyNodes.size === 0) return

    // dirtyNodes に duct_segment が含まれるか確認
    const hasDirtyDucts = Array.from(dirtyNodes).some(
      (id) => nodes[id]?.type === 'duct_segment',
    )
    if (!hasDirtyDucts) return

    // 全ダクトセグメントのビジュアルを更新
    sceneRegistry.byType.duct_segment.forEach((ductId) => {
      const obj = sceneRegistry.nodes.get(ductId)
      if (!obj) return

      const seg = nodes[ductId]
      if (!seg || seg.type !== 'duct_segment') return

      // 接続状態を判定
      const startConnected = checkPortConnected(seg.startPortId, nodes)
      const endConnected = checkPortConnected(seg.endPortId, nodes)

      // ビジュアル状態を決定
      const state = getDuctVisualState(seg.width, seg.height, startConnected, endConnected)

      // メッシュのスケールを断面比例に更新 (REQ-1502)
      const scale = calcDuctMeshScale(seg.width, seg.height)
      obj.scale.set(scale.x, scale.y, obj.scale.z)

      // マテリアルカラーを状態に応じて更新 (REQ-1502)
      const colorHex = getDuctColor(state)
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
