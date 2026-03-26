import { describe, expect, it } from 'vitest'
import { DuctFittingNode } from '../duct-fitting'

const basePort = {
  id: 'port_a',
  label: 'A',
  medium: 'supply_air' as const,
  position: [0, 0, 0] as [number, number, number],
  direction: [1, 0, 0] as [number, number, number],
  connectedSegmentId: null,
}

const baseFitting = {
  fittingType: 'elbow' as const,
  position: [2, 3, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  ports: [
    basePort,
    { ...basePort, id: 'port_b', label: 'B', direction: [0, 1, 0] as [number, number, number] },
  ],
  localLossCoefficient: 0.3,
  systemId: 'system_aaa',
}

describe('DuctFittingNode', () => {
  it('テスト6: エルボ正常パース', () => {
    const result = DuctFittingNode.parse(baseFitting)

    expect(result.type).toBe('duct_fitting')
    expect(result.fittingType).toBe('elbow')
    expect(result.ports).toHaveLength(2)
    expect(result.localLossCoefficient).toBe(0.3)
  })

  it('テスト7: FittingType enum 全6値パース成功', () => {
    const fittingTypes = ['elbow', 'tee', 'wye', 'cross', 'reducer', 'cap'] as const
    for (const fittingType of fittingTypes) {
      const result = DuctFittingNode.parse({ ...baseFitting, fittingType })
      expect(result.fittingType).toBe(fittingType)
    }
  })

  it('テスト8: FittingType 不正値バリデーション', () => {
    expect(() => DuctFittingNode.parse({ ...baseFitting, fittingType: 'invalid' })).toThrow()
  })
})
