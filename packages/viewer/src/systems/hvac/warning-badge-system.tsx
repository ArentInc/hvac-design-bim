/**
 * TASK-0039: WarningBadgeSystem — ノード上警告バッジ表示
 *
 * 【機能概要】: useFrame内でuseValidationのwarnings配列を参照し、
 *             sceneRegistryのObject3DにCanvasTexture製Spriteバッジを付与する
 * 【設計方針】:
 *   - Viewerシステムパターン: renderはnull、useFrame内で処理
 *   - sceneRegistry経由でノードのObject3Dを読み取り専用で参照
 *   - 純粋ヘルパー関数をエクスポートしてテスタビリティを確保
 * 【Viewer 隔離】: @pascal-app/editor への依存禁止
 * 【対応要件】: REQ-1202（ノード上警告バッジ）
 * 🔵 信頼性レベル: TASK-0039 architecture.md viewerシステムパターンに準拠
 */

import type { Warning } from '@pascal-app/core'
import { sceneRegistry, useValidation } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Sprite, SpriteMaterial } from 'three'

// ============================================================================
// 定数
// ============================================================================

/** バッジ用Canvas解像度 */
const BADGE_CANVAS_SIZE = 64

/** バッジの赤丸カラー (REQ-1202) */
export const BADGE_COLOR = '#E53935'

/** バッジの文字カラー */
export const BADGE_TEXT_COLOR = '#FFFFFF'

/** バッジのノード上方オフセット (Three.js単位) */
export const BADGE_Y_OFFSET = 0.5

/** バッジのSprite表示スケール (Three.js単位) */
export const BADGE_SCALE = 0.3

/** バッジSpriteに付与するユーザーデータキー */
const BADGE_USER_DATA_KEY = '__warningBadge'

// ============================================================================
// モジュールレベルのバッジSprite管理Map
// ============================================================================

/** nodeId → Spriteのマップ（バッジのライフサイクル管理用） */
const badgeMap = new Map<string, Sprite>()

// ============================================================================
// 純粋ヘルパー関数（テスト可能）
// ============================================================================

/**
 * CanvasTextureで赤丸+白数字のバッジテクスチャを生成する (REQ-1202)
 * @param count - 表示する警告件数
 * @returns CanvasTexture
 */
export function createBadgeTexture(count: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = BADGE_CANVAS_SIZE
  canvas.height = BADGE_CANVAS_SIZE

  const ctx = canvas.getContext('2d')
  if (ctx) {
    // 赤丸を描画
    const cx = BADGE_CANVAS_SIZE / 2
    const cy = BADGE_CANVAS_SIZE / 2
    const radius = BADGE_CANVAS_SIZE / 2 - 2

    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = BADGE_COLOR
    ctx.fill()

    // 白文字で件数を描画
    ctx.fillStyle = BADGE_TEXT_COLOR
    ctx.font = `bold ${BADGE_CANVAS_SIZE * 0.45}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(count > 99 ? '99+' : count), cx, cy)
  }

  return new CanvasTexture(canvas)
}

/**
 * warnings配列をnodeId別にグループ化してカウントを返す
 * @param warnings - Warning配列
 * @returns Map<nodeId, 警告件数>
 */
export function getBadgeCountByNode(warnings: Warning[]): Map<string, number> {
  const countMap = new Map<string, number>()
  for (const warning of warnings) {
    countMap.set(warning.nodeId, (countMap.get(warning.nodeId) ?? 0) + 1)
  }
  return countMap
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * 既存バッジSpriteをObject3Dから除去してdisposeする
 */
function removeBadge(nodeId: string): void {
  const sprite = badgeMap.get(nodeId)
  if (!sprite) return

  sprite.parent?.remove(sprite)
  if (sprite.material instanceof SpriteMaterial) {
    sprite.material.map?.dispose()
    sprite.material.dispose()
  }
  badgeMap.delete(nodeId)
}

/**
 * Object3DにバッジSpriteを追加・更新する
 */
function addOrUpdateBadge(nodeId: string, count: number): void {
  const obj = sceneRegistry.nodes.get(nodeId)
  if (!obj) return

  // 既存バッジを除去
  removeBadge(nodeId)

  // テクスチャ・マテリアル・Spriteを生成
  const texture = createBadgeTexture(count)
  const material = new SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new Sprite(material)

  // ノード上部にオフセット配置
  sprite.position.set(0, BADGE_Y_OFFSET, 0)
  sprite.scale.set(BADGE_SCALE, BADGE_SCALE, BADGE_SCALE)

  // EDITOR_LAYER (1) に配置してシーンジオメトリと分離
  sprite.layers.set(1)

  // ユーザーデータにマーキング（識別用）
  sprite.userData[BADGE_USER_DATA_KEY] = true

  obj.add(sprite)
  badgeMap.set(nodeId, sprite)
}

// ============================================================================
// ビューワーシステムコンポーネント
// ============================================================================

/**
 * WarningBadgeSystem — 警告のあるHVACノードの3Dメッシュ上にバッジを表示する
 * Viewerシステムパターン: renderはnull、useFrame内で処理
 */
export function WarningBadgeSystem() {
  useFrame(() => {
    const warnings = useValidation.getState().warnings

    // nodeId別の警告件数マップを構築
    const countByNode = getBadgeCountByNode(warnings)

    // 警告のあるノードにバッジを追加・更新
    for (const [nodeId, count] of countByNode) {
      const existing = badgeMap.get(nodeId)

      // 既存バッジの件数と同じなら更新不要
      if (existing) {
        // Spriteのユーザーデータにキャッシュされた件数をチェック
        const cachedCount = existing.userData['__badgeCount'] as number | undefined
        if (cachedCount === count) continue
        existing.userData['__badgeCount'] = count
      }

      addOrUpdateBadge(nodeId, count)
      // 件数をキャッシュ
      const sprite = badgeMap.get(nodeId)
      if (sprite) {
        sprite.userData['__badgeCount'] = count
      }
    }

    // 警告が解消されたノードのバッジを除去
    for (const nodeId of Array.from(badgeMap.keys())) {
      if (!countByNode.has(nodeId)) {
        removeBadge(nodeId)
      }
    }
  })

  return null
}
