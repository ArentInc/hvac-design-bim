import { describe, expect, it } from 'vitest'
import { PerimeterSegment } from '../hvac-shared'
import { HvacZoneNode } from '../hvac-zone'

const baseZone = {
  zoneName: 'ゾーンA',
  usage: 'office_general' as const,
  floorArea: 50,
  boundary: [
    [0, 0],
    [5, 0],
    [5, 10],
    [0, 10],
  ] as [number, number][],
  perimeterSegments: [{ orientation: 'S' as const, wallArea: 15, glazingRatio: 0.4 }],
}

describe('HvacZoneNode', () => {
  it('テスト1: 正常データパース', () => {
    const result = HvacZoneNode.parse({
      ...baseZone,
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 22,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
      systemId: null,
      calcResult: null,
    })

    expect(result.type).toBe('hvac_zone')
    expect(result.zoneName).toBe('ゾーンA')
    expect(result.usage).toBe('office_general')
    expect(result.floorArea).toBe(50)
    expect(result.perimeterSegments).toHaveLength(1)
    expect(result.systemId).toBeNull()
    expect(result.calcResult).toBeNull()
  })

  it('テスト2: デフォルト値適用', () => {
    const result = HvacZoneNode.parse({
      ...baseZone,
      systemId: null,
      calcResult: null,
    })

    expect(result.ceilingHeight).toBe(2.7)
    expect(result.occupantDensity).toBe(0.15)
    expect(result.designConditions.coolingSetpoint).toBe(26)
    expect(result.designConditions.heatingSetpoint).toBe(22)
    expect(result.designConditions.relativeHumidity).toBe(50)
    expect(result.designConditions.supplyAirTempDiff).toBe(10)
  })

  it('テスト3: glazingRatio 範囲外バリデーション', () => {
    expect(() =>
      HvacZoneNode.parse({
        ...baseZone,
        perimeterSegments: [{ orientation: 'S', wallArea: 15, glazingRatio: 1.5 }],
        systemId: null,
        calcResult: null,
      }),
    ).toThrow()
  })

  it('テスト4: glazingRatio 境界値（0.0, 1.0）パース成功', () => {
    expect(() =>
      HvacZoneNode.parse({
        ...baseZone,
        perimeterSegments: [
          { orientation: 'S', wallArea: 15, glazingRatio: 0.0 },
          { orientation: 'N', wallArea: 10, glazingRatio: 1.0 },
        ],
        systemId: null,
        calcResult: null,
      }),
    ).not.toThrow()
  })

  it('テスト5: ZoneUsage 不正値バリデーション', () => {
    expect(() =>
      HvacZoneNode.parse({
        ...baseZone,
        usage: 'invalid_usage',
        systemId: null,
        calcResult: null,
      }),
    ).toThrow()
  })

  it('テスト6: Orientation enum 全8方位バリデーション', () => {
    const orientations = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
    for (const orientation of orientations) {
      expect(() =>
        PerimeterSegment.parse({ orientation, wallArea: 10, glazingRatio: 0.3 }),
      ).not.toThrow()
    }
  })
})
