import { describe, expect, it, vi } from 'vitest'

vi.mock('three', () => ({
  Group: class {},
  DoubleSide: 2,
}))
vi.mock('../../../hooks/use-node-events', () => ({
  useNodeEvents: vi.fn(() => ({})),
}))
vi.mock('@pascal-app/core', () => ({
  useRegistry: vi.fn(),
  useScene: vi.fn(),
}))

import { getDiffuserColor, getFaceSize, getNeckRadius } from '../diffuser-renderer'

describe('getDiffuserColor', () => {
  it('returns blue for supply_air', () => {
    expect(getDiffuserColor('supply_air')).toBe('#42A5F5')
  })

  it('returns red for return_air', () => {
    expect(getDiffuserColor('return_air')).toBe('#EF5350')
  })

  it('returns grey for exhaust_air', () => {
    expect(getDiffuserColor('exhaust_air')).toBe('#9E9E9E')
  })

  it('returns grey for unknown medium', () => {
    expect(getDiffuserColor('unknown')).toBe('#9E9E9E')
  })
})

describe('getFaceSize', () => {
  it('returns 1.5x the neckDiameter in meters for neckDiameter=300', () => {
    // 300mm / 1000 * 1.5 = 0.45
    expect(getFaceSize(300)).toBeCloseTo(0.45)
  })

  it('returns larger face size for larger neckDiameter', () => {
    expect(getFaceSize(600)).toBeGreaterThan(getFaceSize(250))
  })

  it('converts mm to meters correctly for neckDiameter=200', () => {
    // 200mm / 1000 * 1.5 = 0.3
    expect(getFaceSize(200)).toBeCloseTo(0.3)
  })
})

describe('getNeckRadius', () => {
  it('returns half the neckDiameter in meters for neckDiameter=300', () => {
    // 300 / 2 / 1000 = 0.15
    expect(getNeckRadius(300)).toBeCloseTo(0.15)
  })

  it('returns larger radius for larger neckDiameter', () => {
    expect(getNeckRadius(600)).toBeGreaterThan(getNeckRadius(250))
  })

  it('converts mm to meters correctly for neckDiameter=200', () => {
    // 200 / 2 / 1000 = 0.1
    expect(getNeckRadius(200)).toBeCloseTo(0.1)
  })
})
