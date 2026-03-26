import { describe, expect, it } from 'vitest'
import { DuctSegmentNode } from '../duct-segment'

const baseRectDuct = {
  start: [0, 3, 0] as [number, number, number],
  end: [5, 3, 0] as [number, number, number],
  medium: 'supply_air' as const,
  shape: 'rectangular' as const,
  width: 400,
  height: 300,
  diameter: null,
  ductMaterial: 'galvanized_steel' as const,
  airflowRate: null,
  startPortId: 'port_start_001',
  endPortId: 'port_end_001',
  systemId: 'system_aaa',
  calcResult: null,
}

describe('DuctSegmentNode', () => {
  it('テスト1: 矩形ダクト正常パース', () => {
    const result = DuctSegmentNode.parse(baseRectDuct)

    expect(result.type).toBe('duct_segment')
    expect(result.shape).toBe('rectangular')
    expect(result.width).toBe(400)
    expect(result.height).toBe(300)
    expect(result.diameter).toBeNull()
  })

  it('テスト2: 丸ダクト正常パース', () => {
    const result = DuctSegmentNode.parse({
      ...baseRectDuct,
      shape: 'round',
      width: null,
      height: null,
      diameter: 350,
    })

    expect(result.shape).toBe('round')
    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
    expect(result.diameter).toBe(350)
  })

  it('テスト3: DuctMaterial enum 全4値バリデーション', () => {
    const materials = ['galvanized_steel', 'stainless_steel', 'aluminum', 'flexible'] as const
    for (const ductMaterial of materials) {
      const result = DuctSegmentNode.parse({ ...baseRectDuct, ductMaterial })
      expect(result.ductMaterial).toBe(ductMaterial)
    }
  })

  it('テスト4: calcResult null許容', () => {
    const result = DuctSegmentNode.parse({ ...baseRectDuct, calcResult: null })
    expect(result.calcResult).toBeNull()
  })

  it('テスト5: airflowRate null許容', () => {
    const result = DuctSegmentNode.parse({ ...baseRectDuct, airflowRate: null })
    expect(result.airflowRate).toBeNull()
  })
})
