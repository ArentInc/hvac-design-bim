import { describe, expect, it } from 'vitest'
import { DiffuserNode } from '../diffuser'
import { Port } from '../hvac-shared'

const basePort = {
  id: 'port_in',
  label: 'IN',
  medium: 'supply_air' as const,
  position: [0, 0, 0] as [number, number, number],
  direction: [0, -1, 0] as [number, number, number],
  connectedSegmentId: null,
}

const baseDiffuser = {
  tag: 'SA-1-01',
  subType: 'anemostat' as const,
  position: [3, 2.5, 4] as [number, number, number],
  neckDiameter: 150,
  airflowRate: 200,
  port: basePort,
  hostDuctId: null,
  systemId: 'system_aaa',
  zoneId: 'hvac_zone_xxx',
}

describe('DiffuserNode', () => {
  it('テスト6: 正常データパース', () => {
    const result = DiffuserNode.parse(baseDiffuser)

    expect(result.type).toBe('diffuser')
    expect(result.tag).toBe('SA-1-01')
    expect(result.subType).toBe('anemostat')
    expect(result.neckDiameter).toBe(150)
    expect(result.port.medium).toBe('supply_air')
  })

  it('テスト7: DiffuserSubType enum 全5値パース成功', () => {
    const subTypes = ['anemostat', 'line', 'universal', 'nozzle', 'return_grille'] as const
    for (const subType of subTypes) {
      const result = DiffuserNode.parse({ ...baseDiffuser, subType })
      expect(result.subType).toBe(subType)
    }
  })

  it('テスト8: DiffuserSubType 不正値バリデーション', () => {
    expect(() => DiffuserNode.parse({ ...baseDiffuser, subType: 'invalid_type' })).toThrow()
  })

  it('テスト9: hostDuctId null許容', () => {
    const result = DiffuserNode.parse({ ...baseDiffuser, hostDuctId: null })
    expect(result.hostDuctId).toBeNull()
  })

  it('テスト10: PortMedium 全5値バリデーション', () => {
    const mediums = [
      'supply_air',
      'return_air',
      'chilled_water',
      'hot_water',
      'refrigerant',
    ] as const
    for (const medium of mediums) {
      const result = Port.parse({ ...basePort, medium })
      expect(result.medium).toBe(medium)
    }
  })
})
