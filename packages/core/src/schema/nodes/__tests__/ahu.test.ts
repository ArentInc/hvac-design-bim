import { describe, expect, it } from 'vitest'
import { AhuNode } from '../ahu'
import { Port } from '../hvac-shared'

const makePort = (label: string, medium: string) => ({
  id: `port_${label.toLowerCase()}`,
  label,
  medium,
  position: [0, 0, 0] as [number, number, number],
  direction: [1, 0, 0] as [number, number, number],
  connectedSegmentId: null,
})

const basePorts = [
  makePort('SA', 'supply_air'),
  makePort('RA', 'return_air'),
  makePort('CHW_S', 'chilled_water'),
  makePort('CHW_R', 'chilled_water'),
]

const baseAhu = {
  tag: 'AHU-1',
  equipmentName: 'AHU-S-5000',
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  dimensions: { width: 1.2, height: 1.8, depth: 2.4 },
  ports: basePorts,
  airflowRate: 5000,
  coolingCapacity: 30000,
  heatingCapacity: 20000,
  staticPressure: 150,
  systemId: 'system_aaa',
}

describe('AhuNode', () => {
  it('テスト1: 正常データパース（4ポート）', () => {
    const result = AhuNode.parse(baseAhu)

    expect(result.type).toBe('ahu')
    expect(result.tag).toBe('AHU-1')
    expect(result.ports).toHaveLength(4)
    expect(result.airflowRate).toBe(5000)
    expect(result.systemId).toBe('system_aaa')
  })

  it('テスト2: AhuNode ポート空配列許容（ポート数制約はビジネスロジック）', () => {
    const result = AhuNode.parse({ ...baseAhu, ports: [] })
    expect(result.ports).toHaveLength(0)
  })

  it('テスト3: Port型 不正なmedium値バリデーション', () => {
    expect(() =>
      Port.parse({
        id: 'port_x',
        label: 'X',
        medium: 'invalid_medium',
        position: [0, 0, 0],
        direction: [1, 0, 0],
        connectedSegmentId: null,
      }),
    ).toThrow()
  })

  it('テスト4: Port connectedSegmentId null許容', () => {
    const result = Port.parse(makePort('SA', 'supply_air'))
    expect(result.connectedSegmentId).toBeNull()
  })

  it('テスト5: AhuDimensions 正値バリデーション', () => {
    const result = AhuNode.parse(baseAhu)
    expect(result.dimensions.width).toBe(1.2)
    expect(result.dimensions.height).toBe(1.8)
    expect(result.dimensions.depth).toBe(2.4)
  })
})
