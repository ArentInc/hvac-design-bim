import { describe, expect, it, vi } from 'vitest'
import { emitter } from '../bus'

const mockPointerEvent = {} as PointerEvent

describe('TASK-0008: HVAC event bus extensions', () => {
  it('テスト1: hvac_zone:click イベントの発行・購読', () => {
    const listener = vi.fn()
    emitter.on('hvac_zone:click', listener)
    emitter.emit('hvac_zone:click', {
      node: { id: 'hvac_zone_1' } as never,
      position: [0, 0, 0],
      localPosition: [0, 0, 0],
      stopPropagation: vi.fn(),
      nativeEvent: mockPointerEvent as never,
    })
    emitter.off('hvac_zone:click', listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]?.node.id).toBe('hvac_zone_1')
  })

  it('テスト2: ahu:enter イベントの発行・購読', () => {
    const listener = vi.fn()
    emitter.on('ahu:enter', listener)
    emitter.emit('ahu:enter', {
      node: { id: 'ahu_1' } as never,
      position: [0, 0, 0],
      localPosition: [0, 0, 0],
      stopPropagation: vi.fn(),
      nativeEvent: mockPointerEvent as never,
    })
    emitter.off('ahu:enter', listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]?.node.id).toBe('ahu_1')
  })

  it('テスト3: duct_segment:click イベントの発行・購読', () => {
    const listener = vi.fn()
    emitter.on('duct_segment:click', listener)
    emitter.emit('duct_segment:click', {
      node: { id: 'duct_seg_1' } as never,
      position: [0, 0, 0],
      localPosition: [0, 0, 0],
      stopPropagation: vi.fn(),
      nativeEvent: mockPointerEvent as never,
    })
    emitter.off('duct_segment:click', listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]?.node.id).toBe('duct_seg_1')
  })

  it('テスト4: pipe_segment:leave イベントの発行・購読', () => {
    const listener = vi.fn()
    emitter.on('pipe_segment:leave', listener)
    emitter.emit('pipe_segment:leave', {
      node: { id: 'pipe_seg_1' } as never,
      position: [0, 0, 0],
      localPosition: [0, 0, 0],
      stopPropagation: vi.fn(),
      nativeEvent: mockPointerEvent as never,
    })
    emitter.off('pipe_segment:leave', listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]?.node.id).toBe('pipe_seg_1')
  })

  it('テスト5: 全7タイプのイベント発行が動作する', () => {
    const nodeTypes = [
      'hvac_zone',
      'system',
      'ahu',
      'diffuser',
      'duct_segment',
      'duct_fitting',
      'pipe_segment',
    ] as const
    for (const nodeType of nodeTypes) {
      const listener = vi.fn()
      const eventName = `${nodeType}:click` as Parameters<typeof emitter.emit>[0]
      emitter.on(eventName, listener)
      emitter.emit(eventName, {
        node: { id: `${nodeType}_1` } as never,
        position: [0, 0, 0],
        localPosition: [0, 0, 0],
        stopPropagation: vi.fn(),
        nativeEvent: mockPointerEvent as never,
      })
      emitter.off(eventName, listener)
      expect(listener).toHaveBeenCalledTimes(1)
    }
  })

  it('テスト6: 既存イベントの後方互換性', () => {
    const listener = vi.fn()
    emitter.on('wall:click', listener)
    emitter.emit('wall:click', {
      node: { id: 'wall_1' } as never,
      position: [0, 0, 0],
      localPosition: [0, 0, 0],
      stopPropagation: vi.fn(),
      nativeEvent: mockPointerEvent as never,
    })
    emitter.off('wall:click', listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('テスト7: イベントリスナーのクリーンアップ', () => {
    const listener = vi.fn()
    emitter.on('ahu:click', listener)
    emitter.off('ahu:click', listener)
    emitter.emit('ahu:click', {
      node: { id: 'ahu_1' } as never,
      position: [0, 0, 0],
      localPosition: [0, 0, 0],
      stopPropagation: vi.fn(),
      nativeEvent: mockPointerEvent as never,
    })
    expect(listener).not.toHaveBeenCalled()
  })
})
