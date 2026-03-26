import { describe, expect, it } from 'vitest'
import { calculatePolygonArea } from '../polygon-area'

describe('TASK-0013: calculatePolygonArea (Shoelace formula)', () => {
  it('テスト1: 正方形 10m x 10m → 100 m²', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(calculatePolygonArea(vertices)).toBe(100)
  })

  it('テスト2: 三角形 底辺10m 高さ5m → 25 m²', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
    ]
    expect(calculatePolygonArea(vertices)).toBe(25)
  })

  it('テスト3: 頂点不足（2頂点） → 0', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(calculatePolygonArea(vertices)).toBe(0)
  })

  it('テスト4: EDGE-001 一直線上の3頂点 → 0（面積なし）', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(calculatePolygonArea(vertices)).toBe(0)
  })

  it('テスト5: 空配列 → 0', () => {
    expect(calculatePolygonArea([])).toBe(0)
  })

  it('テスト6: 1頂点のみ → 0', () => {
    expect(calculatePolygonArea([{ x: 5, y: 5 }])).toBe(0)
  })

  it('テスト7: L字型ポリゴン（6頂点）の面積が正しい', () => {
    // L字型: 10x10から5x5を切り取った形
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ]
    // 全体100 - 右上25 = 75
    expect(calculatePolygonArea(vertices)).toBe(75)
  })

  it('テスト8: 反時計回り頂点順でも同じ面積（絶対値）', () => {
    const cw = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const ccw = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ]
    expect(calculatePolygonArea(cw)).toBe(calculatePolygonArea(ccw))
    expect(calculatePolygonArea(ccw)).toBe(100)
  })

  it('テスト9: 小数座標の精度', () => {
    // 2.5m x 4.0m = 10.0 m²
    const vertices = [
      { x: 0, y: 0 },
      { x: 2.5, y: 0 },
      { x: 2.5, y: 4 },
      { x: 0, y: 4 },
    ]
    expect(calculatePolygonArea(vertices)).toBeCloseTo(10, 10)
  })
})
