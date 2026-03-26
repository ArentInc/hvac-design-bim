import { render } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// Mock @react-three/fiber to avoid WebGL errors
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ gl: {}, scene: {}, camera: {} })),
}))

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}))

// Mock three
vi.mock('three', () => ({
  Shape: vi.fn(() => ({ moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn() })),
  DoubleSide: 2,
  Color: vi.fn(),
  BufferGeometry: vi.fn(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
  })),
  Float32BufferAttribute: vi.fn(),
}))

// Mock three/tsl
vi.mock('three/tsl', () => ({
  color: vi.fn(),
  float: vi.fn(() => ({
    mul: vi.fn(() => ({ mul: vi.fn(), sub: vi.fn(() => ({})) })),
    sub: vi.fn(),
  })),
  uniform: vi.fn(() => ({})),
  uv: vi.fn(() => ({ y: 0 })),
}))

// Mock three/webgpu
vi.mock('three/webgpu', () => ({
  MeshBasicNodeMaterial: vi.fn(() => ({})),
}))

// Test node IDs with proper prefixes
const HVAC_TEST_NODES: Record<string, { type: string }> = {
  hvac_zone_test0000000001: { type: 'hvac_zone' },
  system_test0000000000001: { type: 'system' },
  ahu_test00000000000000001: { type: 'ahu' },
  diffuser_test0000000000001: { type: 'diffuser' },
  duct_seg_test000000000001: { type: 'duct_segment' },
  duct_fit_test000000000001: { type: 'duct_fitting' },
  pipe_seg_test000000000001: { type: 'pipe_segment' },
}

// Mock @pascal-app/core
vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn((selector: Function) =>
    selector({
      nodes: {
        ...HVAC_TEST_NODES,
        wall_test0000000000001: { type: 'wall', start: [0, 0], end: [5, 0] },
      },
    }),
  ),
  useRegistry: vi.fn(),
  sceneRegistry: {
    nodes: new Map(),
    byType: {},
    clear: vi.fn(),
  },
}))

// Mock viewer store
vi.mock('../../../store/use-viewer', () => ({
  default: vi.fn((selector: Function) => selector({ cameraDragging: false })),
}))

// Mock all existing renderers
vi.mock('../site/site-renderer', () => ({ SiteRenderer: () => null }))
vi.mock('../building/building-renderer', () => ({ BuildingRenderer: () => null }))
vi.mock('../ceiling/ceiling-renderer', () => ({ CeilingRenderer: () => null }))
vi.mock('../door/door-renderer', () => ({ DoorRenderer: () => null }))
vi.mock('../guide/guide-renderer', () => ({ GuideRenderer: () => null }))
vi.mock('../item/item-renderer', () => ({ ItemRenderer: () => null }))
vi.mock('../level/level-renderer', () => ({ LevelRenderer: () => null }))
vi.mock('../roof/roof-renderer', () => ({ RoofRenderer: () => null }))
vi.mock('../roof-segment/roof-segment-renderer', () => ({ RoofSegmentRenderer: () => null }))
vi.mock('../scan/scan-renderer', () => ({ ScanRenderer: () => null }))
vi.mock('../slab/slab-renderer', () => ({ SlabRenderer: () => null }))
vi.mock('../wall/wall-renderer', () => ({ WallRenderer: () => null }))
vi.mock('../window/window-renderer', () => ({ WindowRenderer: () => null }))
vi.mock('../zone/zone-renderer', () => ({ ZoneRenderer: () => null }))

import { NodeRenderer } from '../node-renderer'

describe('NodeRenderer HVAC分岐', () => {
  it('テスト7: hvac_zoneタイプのノードでNodeRendererがエラーなくレンダリング', () => {
    expect(() => {
      render(
        React.createElement(NodeRenderer, {
          nodeId: 'hvac_zone_test0000000001' as Parameters<typeof NodeRenderer>[0]['nodeId'],
        }),
      )
    }).not.toThrow()
  })

  it('テスト8: 全7HVACタイプでエラーなし', () => {
    const hvacIds = Object.keys(HVAC_TEST_NODES) as Parameters<typeof NodeRenderer>[0]['nodeId'][]
    for (const nodeId of hvacIds) {
      expect(() => {
        render(React.createElement(NodeRenderer, { nodeId }))
      }).not.toThrow()
    }
  })

  it('テスト9: wallタイプで既存WallRendererの後方互換性維持', () => {
    expect(() => {
      render(
        React.createElement(NodeRenderer, {
          nodeId: 'wall_test0000000000001' as Parameters<typeof NodeRenderer>[0]['nodeId'],
        }),
      )
    }).not.toThrow()
  })
})
