import { describe, expect, it } from 'vitest'
import { WallNode } from '../schema/nodes/wall'

describe('vitest setup verification', () => {
  it('基本的なアサーションが動作する', () => {
    expect(1 + 1).toBe(2)
  })

  it('Zodスキーマのインポートが動作する', () => {
    const wall = WallNode.parse({
      start: [0, 0],
      end: [1, 0],
    })
    expect(wall.type).toBe('wall')
  })
})
