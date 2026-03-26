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

import { getPortColor } from '../ahu-renderer'

describe('getPortColor', () => {
  it('returns blue for supply_air', () => {
    expect(getPortColor('supply_air')).toBe('#42A5F5')
  })

  it('returns red for return_air', () => {
    expect(getPortColor('return_air')).toBe('#EF5350')
  })

  it('returns cyan for chilled_water', () => {
    expect(getPortColor('chilled_water')).toBe('#80DEEA')
  })

  it('returns orange for hot_water', () => {
    expect(getPortColor('hot_water')).toBe('#FFA726')
  })

  it('returns purple for refrigerant', () => {
    expect(getPortColor('refrigerant')).toBe('#CE93D8')
  })

  it('returns grey for unknown medium', () => {
    expect(getPortColor('unknown')).toBe('#9E9E9E')
  })
})
