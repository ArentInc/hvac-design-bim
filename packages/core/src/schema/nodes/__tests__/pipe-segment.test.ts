import { describe, expect, it } from 'vitest'
import { PipeSegmentNode } from '../pipe-segment'

const basePipe = {
  start: [0, 3, 0] as [number, number, number],
  end: [5, 3, 0] as [number, number, number],
  medium: 'chilled_water' as const,
  nominalSize: null,
  outerDiameter: null,
  startPortId: 'port_start_001',
  endPortId: 'port_end_001',
  systemId: 'system_aaa',
  calcResult: null,
}

describe('PipeSegmentNode', () => {
  it('テスト9: 正常パース（全フィールド含む）', () => {
    const result = PipeSegmentNode.parse({
      ...basePipe,
      nominalSize: 25,
      outerDiameter: 34.0,
      calcResult: { velocity: 1.5, pressureDrop: 0.3 },
    })

    expect(result.type).toBe('pipe_segment')
    expect(result.medium).toBe('chilled_water')
    expect(result.nominalSize).toBe(25)
    expect(result.outerDiameter).toBe(34.0)
    expect(result.calcResult?.velocity).toBe(1.5)
  })

  it('テスト10: PipeMedium enum 全3値バリデーション', () => {
    const mediums = ['chilled_water', 'hot_water', 'condensate'] as const
    for (const medium of mediums) {
      const result = PipeSegmentNode.parse({ ...basePipe, medium })
      expect(result.medium).toBe(medium)
    }
  })

  it('テスト11: nominalSize / outerDiameter null許容', () => {
    const result = PipeSegmentNode.parse({ ...basePipe, nominalSize: null, outerDiameter: null })
    expect(result.nominalSize).toBeNull()
    expect(result.outerDiameter).toBeNull()
  })
})
