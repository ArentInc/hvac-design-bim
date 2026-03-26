import { describe, expect, it, vi } from 'vitest'

vi.mock('three', () => ({}))

vi.mock('@pascal-app/core', () => ({
  useRegistry: vi.fn(),
  useScene: vi.fn(),
}))

vi.mock('../../../../hooks/use-node-events', () => ({
  useNodeEvents: vi.fn(() => ({})),
}))

import { getPortColor } from '../duct-fitting-renderer'

describe('getPortColor', () => {
  it('テスト4: connectedSegmentIdが設定されているとき 緑色 (#4CAF50) を返す', () => {
    expect(getPortColor('duct_seg_0000000000001')).toBe('#4CAF50')
  })

  it('テスト4: connectedSegmentIdがnullのとき 赤色 (#F44336) を返す', () => {
    expect(getPortColor(null)).toBe('#F44336')
  })

  it('テスト3: 接続済みポートは緑色', () => {
    expect(getPortColor('some_segment_id')).toBe('#4CAF50')
  })

  it('テスト3: 未接続ポートは赤色', () => {
    expect(getPortColor(null)).toBe('#F44336')
  })
})
