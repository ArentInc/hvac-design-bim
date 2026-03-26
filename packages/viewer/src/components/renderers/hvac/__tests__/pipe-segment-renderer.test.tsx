import { describe, expect, it, vi } from 'vitest'

vi.mock('three', () => ({
  Vector3: class {
    x: number
    y: number
    z: number
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    normalize() {
      const len = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2)
      if (len > 0) {
        this.x /= len
        this.y /= len
        this.z /= len
      }
      return this
    }
  },
  Quaternion: class {
    setFromUnitVectors() {
      return this
    }
  },
  Euler: class {
    x = 0
    y = 0
    z = 0
    setFromQuaternion() {
      return this
    }
  },
}))

vi.mock('@pascal-app/core', () => ({
  useRegistry: vi.fn(),
  useScene: vi.fn(),
}))

vi.mock('../../../../hooks/use-node-events', () => ({
  useNodeEvents: vi.fn(() => ({})),
}))

import { getPipeColor, getPipeRadius } from '../pipe-segment-renderer'

describe('getPipeColor', () => {
  it('テスト2: chilled_water → #0288D1', () => {
    expect(getPipeColor('chilled_water')).toBe('#0288D1')
  })

  it('テスト3: hot_water → #E53935', () => {
    expect(getPipeColor('hot_water')).toBe('#E53935')
  })

  it('condensate → #78909C', () => {
    expect(getPipeColor('condensate')).toBe('#78909C')
  })

  it('未知の媒体 → デフォルト色 #78909C', () => {
    expect(getPipeColor('unknown_medium')).toBe('#78909C')
  })
})

describe('getPipeRadius', () => {
  it('テスト4: outerDiameter=0.05m のとき radius=0.025m', () => {
    expect(getPipeRadius(0.05)).toBeCloseTo(0.025)
  })

  it('outerDiameter=0.1m のとき radius=0.05m', () => {
    expect(getPipeRadius(0.1)).toBeCloseTo(0.05)
  })

  it('outerDiameter=null のとき最小半径 0.02m を返す', () => {
    expect(getPipeRadius(null)).toBe(0.02)
  })

  it('outerDiameter=0 のとき最小半径 0.02m を返す', () => {
    expect(getPipeRadius(0)).toBe(0.02)
  })

  it('極端に小さい口径 (0.001m) でも最小半径 0.02m を返す', () => {
    expect(getPipeRadius(0.001)).toBe(0.02)
  })
})
