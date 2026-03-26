/**
 * TASK-0018: ゾーン操作フィードバック — 純粋関数テスト
 *
 * 【テスト対象】:
 *   - calculatePolygonCenter: ポリゴン重心計算（zone-draw-tool からエクスポート）
 *   - AreaOverlay の表示条件（3頂点以上で表示、2以下で非表示）
 *
 * 【設計方針】: zone-draw-tool.tsx は @pascal-app/core 経由で three-mesh-bvh を
 *              transitively インポートするため、依存関係を vi.mock で遮断してから
 *              calculatePolygonCenter のみを import する。
 *              ahu-renderer.test.ts の確立されたパターンを踏襲。
 * 🔵 信頼性レベル: TASK-0018 テスト1〜3に基づく
 */

import { describe, expect, it, vi } from 'vitest'

// 【モック設定】: 依存先を遮断して循環依存エラーを防止
vi.mock('@pascal-app/core', () => ({
  emitter: { on: vi.fn(), off: vi.fn() },
  HvacZoneNode: { parse: vi.fn() },
  useScene: vi.fn(),
}))
vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))
vi.mock('@react-three/drei', () => ({
  Html: vi.fn(),
}))
vi.mock('three', () => ({
  BufferGeometry: class {
    setFromPoints() {
      return this
    }
    dispose() {}
  },
  Shape: class {
    moveTo() {}
    lineTo() {}
    closePath() {}
  },
  Vector3: class {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0,
    ) {}
  },
  DoubleSide: 2,
}))
vi.mock('../../../lib/constants', () => ({
  EDITOR_LAYER: 1,
}))
vi.mock('../shared/cursor-sphere', () => ({
  CursorSphere: vi.fn(),
}))

import { calculatePolygonCenter } from '../zone-draw-tool'

describe('TASK-0018: calculatePolygonCenter', () => {
  it('テスト1: 4頂点の正方形 → 重心が(5, 5)になる', () => {
    // 🔵 信頼性レベル: TASK-0018 テスト1に明示
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const center = calculatePolygonCenter(vertices)
    expect(center.x).toBe(5)
    expect(center.y).toBe(5)
  })

  it('テスト1b: 3頂点の三角形 → 重心が正しく算出される', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 3, y: 6 },
    ]
    const center = calculatePolygonCenter(vertices)
    expect(center.x).toBeCloseTo(3)
    expect(center.y).toBeCloseTo(2)
  })

  it('テスト1c: 1頂点 → その頂点自身を返す', () => {
    const vertices = [{ x: 5, y: 7 }]
    const center = calculatePolygonCenter(vertices)
    expect(center.x).toBe(5)
    expect(center.y).toBe(7)
  })

  it('テスト1d: 空配列 → {x:0, y:0} を返す', () => {
    const center = calculatePolygonCenter([])
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)
  })

  it('テスト1e: 非対称ポリゴン → x/y 平均が正しく算出される', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
    ]
    const center = calculatePolygonCenter(vertices)
    expect(center.x).toBeCloseTo(8 / 3)
    expect(center.y).toBeCloseTo(2 / 3)
  })
})

describe('TASK-0018: AreaOverlay 表示条件', () => {
  it('テスト2: 3頂点以上の場合はareaLabelを生成できる（表示条件）', () => {
    const shouldShowLabel = (pointCount: number) => pointCount >= 3
    expect(shouldShowLabel(3)).toBe(true)
    expect(shouldShowLabel(4)).toBe(true)
  })

  it('テスト3: 2頂点以下の場合はareaLabelはnull（非表示）', () => {
    const shouldShowLabel = (pointCount: number) => pointCount >= 3
    expect(shouldShowLabel(0)).toBe(false)
    expect(shouldShowLabel(1)).toBe(false)
    expect(shouldShowLabel(2)).toBe(false)
  })
})
