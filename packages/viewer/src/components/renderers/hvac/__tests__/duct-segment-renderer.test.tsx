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
    clone() {
      return new (this.constructor as new (x: number, y: number, z: number) => typeof this)(
        this.x,
        this.y,
        this.z,
      )
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
  BufferGeometry: class {
    setFromPoints() {
      return this
    }
    computeLineDistances() {
      return this
    }
  },
  Line: class {
    constructor(
      public geometry: unknown,
      public material: unknown,
    ) {}
  },
  LineDashedMaterial: class {
    constructor(public opts: unknown) {}
  },
}))

vi.mock('@pascal-app/core', () => ({
  useRegistry: vi.fn(),
  useScene: vi.fn(),
}))

vi.mock('../../../../hooks/use-node-events', () => ({
  useNodeEvents: vi.fn(() => ({})),
}))

import {
  getSegmentLength,
  getSegmentMidpoint,
  isDuctSizeDetermined,
} from '../duct-segment-renderer'

describe('isDuctSizeDetermined', () => {
  it('テスト4: width/heightが正値のとき true を返す（寸法確定）', () => {
    expect(isDuctSizeDetermined(0.4, 0.3)).toBe(true)
  })

  it('テスト3: width=0のとき false を返す（寸法未確定）', () => {
    expect(isDuctSizeDetermined(0, 0.3)).toBe(false)
  })

  it('テスト3: height=0のとき false を返す（寸法未確定）', () => {
    expect(isDuctSizeDetermined(0.4, 0)).toBe(false)
  })

  it('テスト3: widthがnullのとき false を返す（寸法未確定）', () => {
    expect(isDuctSizeDetermined(null, 0.3)).toBe(false)
  })

  it('テスト3: heightがnullのとき false を返す（寸法未確定）', () => {
    expect(isDuctSizeDetermined(0.4, null)).toBe(false)
  })
})

describe('getSegmentMidpoint', () => {
  it('テスト1: start=[0,0,0], end=[5,0,0] の中点が [2.5, 0, 0]', () => {
    expect(getSegmentMidpoint([0, 0, 0], [5, 0, 0])).toEqual([2.5, 0, 0])
  })

  it('テスト2: start=[0,0,0], end=[0,0,10] の中点が [0, 0, 5]', () => {
    expect(getSegmentMidpoint([0, 0, 0], [0, 0, 10])).toEqual([0, 0, 5])
  })

  it('任意の2点の中点を正しく返す', () => {
    const mid = getSegmentMidpoint([1, 2, 3], [3, 4, 5])
    expect(mid).toEqual([2, 3, 4])
  })
})

describe('getSegmentLength', () => {
  it('テスト2: Z軸方向に長さ10のセグメントの長さが10', () => {
    expect(getSegmentLength([0, 0, 0], [0, 0, 10])).toBeCloseTo(10)
  })

  it('X軸方向に長さ5のセグメントの長さが5', () => {
    expect(getSegmentLength([0, 0, 0], [5, 0, 0])).toBeCloseTo(5)
  })

  it('3Dベクトルの長さを正しく計算する', () => {
    // 3-4-5 triangle
    expect(getSegmentLength([0, 0, 0], [3, 4, 0])).toBeCloseTo(5)
  })
})
