import { describe, expect, it, vi } from 'vitest'

// Mock Three.js Shape for testing createZoneShape
vi.mock('three', () => {
  class MockShape {
    points: { x: number; y: number }[] = []
    moveTo(x: number, y: number) {
      this.points.push({ x, y })
    }
    lineTo(x: number, y: number) {
      this.points.push({ x, y })
    }
    closePath() {}
  }
  return {
    Shape: MockShape,
    DoubleSide: 2,
    Mesh: class {},
  }
})

// Mock useRegistry and useNodeEvents to avoid React context issues
vi.mock('../../../hooks/use-node-events', () => ({
  useNodeEvents: vi.fn(() => ({})),
}))
vi.mock('@pascal-app/core', () => ({
  useRegistry: vi.fn(),
  useScene: vi.fn(),
}))

import type { HvacZoneNode } from '@pascal-app/core'
import { createZoneShape, getZoneColor } from '../hvac/hvac-zone-renderer'

function makeHvacZoneNode(overrides: Partial<HvacZoneNode> = {}): HvacZoneNode {
  return {
    id: 'hvac_zone_0000000000001',
    type: 'hvac_zone',
    parentId: null,
    children: [],
    zoneName: 'Test Zone',
    usage: 'office_general',
    floorArea: 100,
    ceilingHeight: 2.7,
    occupantDensity: 0.15,
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    designConditions: {
      coolingSetpoint: 26,
      heatingSetpoint: 22,
      relativeHumidity: 50,
      supplyAirTempDiff: 10,
    },
    perimeterSegments: [],
    systemId: null,
    calcResult: null,
    ...overrides,
  } as HvacZoneNode
}

describe('createZoneShape', () => {
  it('generates a shape with correct points for a 4-vertex boundary', () => {
    const boundary: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const shape = createZoneShape(boundary)
    // Shape should have 4 points (moveTo + 3 lineTo)
    expect((shape as any).points).toHaveLength(4)
    expect((shape as any).points[0]).toEqual({ x: 0, y: -0 })
    expect((shape as any).points[1]).toEqual({ x: 10, y: -0 })
  })

  it('returns an empty shape for fewer than 3 vertices', () => {
    const boundary: [number, number][] = [
      [0, 0],
      [10, 0],
    ]
    const shape = createZoneShape(boundary)
    // With less than 3 points, moveTo/lineTo should not be called
    expect((shape as any).points).toHaveLength(0)
  })
})

describe('getZoneColor', () => {
  it('returns office_general color #42A5F5 for usage office_general', () => {
    const node = makeHvacZoneNode({ usage: 'office_general', calcResult: null })
    // When calcResult is not set, should return default grey regardless of usage
    // When calcResult IS set, should return usage color
    const nodeWithCalc = makeHvacZoneNode({
      usage: 'office_general',
      calcResult: {
        coolingLoad: 1000,
        heatingLoad: 800,
        requiredAirflow: 500,
        internalLoad: 200,
        envelopeLoad: 300,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })
    expect(getZoneColor(nodeWithCalc)).toBe('#42A5F5')
  })

  it('returns default color #9E9E9E for unknown usage (with calcResult set)', () => {
    const nodeWithCalc = makeHvacZoneNode({
      usage: 'corridor',
      calcResult: {
        coolingLoad: 100,
        heatingLoad: 80,
        requiredAirflow: 50,
        internalLoad: 20,
        envelopeLoad: 30,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })
    // override usage to unknown type after construction
    const node = { ...nodeWithCalc, usage: 'unknown_type' as any }
    expect(getZoneColor(node)).toBe('#9E9E9E')
  })

  it('returns default color #9E9E9E when calcResult is null', () => {
    const node = makeHvacZoneNode({ usage: 'office_general', calcResult: null })
    expect(getZoneColor(node)).toBe('#9E9E9E')
  })

  it('returns conference color #FFA726 for usage conference with calcResult', () => {
    const node = makeHvacZoneNode({
      usage: 'conference',
      calcResult: {
        coolingLoad: 500,
        heatingLoad: 400,
        requiredAirflow: 200,
        internalLoad: 100,
        envelopeLoad: 150,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })
    expect(getZoneColor(node)).toBe('#FFA726')
  })
})
