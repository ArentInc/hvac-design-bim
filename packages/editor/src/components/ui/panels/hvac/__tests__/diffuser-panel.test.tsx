import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { DiffuserPanel } from '../diffuser-panel'

const mockDiffuserNode = {
  id: 'diffuser_001',
  type: 'diffuser' as const,
  tag: 'SA-01',
  subType: 'anemostat' as const,
  position: [0, 3, 0] as [number, number, number],
  neckDiameter: 300,
  airflowRate: 1000,
  port: {
    id: 'port_d1',
    label: '接続口',
    medium: 'supply_air' as const,
    position: [0, 3, 0] as [number, number, number],
    direction: [0, 1, 0] as [number, number, number],
    connectedSegmentId: null,
  },
  hostDuctId: null,
  systemId: 'system_001',
  zoneId: 'hvac_zone_001',
  parentId: null,
  children: [],
}

const mockUpdateNode = vi.fn()

beforeEach(() => {
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selectedIds: ['diffuser_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { diffuser_001: mockDiffuserNode },
      updateNode: mockUpdateNode,
    }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0026: DiffuserPanel', () => {
  it('テスト5: タグ・タイプ「給気」・ネック径300mm・風量1000m3/hが表示される', () => {
    render(<DiffuserPanel nodeId="diffuser_001" />)

    expect(screen.getByDisplayValue('SA-01')).toBeDefined()
    expect(screen.getByText('給気')).toBeDefined()
    expect(screen.getByText('300mm')).toBeDefined()
    expect(screen.getByText('1000m3/h')).toBeDefined()
  })

  it('未接続ダクトの場合「未接続」が表示される', () => {
    render(<DiffuserPanel nodeId="diffuser_001" />)

    expect(screen.getByText('未接続')).toBeDefined()
  })

  it('接続済みダクトの場合そのIDが表示される', () => {
    const nodeWithDuct = { ...mockDiffuserNode, hostDuctId: 'duct_001' }
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { diffuser_001: nodeWithDuct },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })

    render(<DiffuserPanel nodeId="diffuser_001" />)
    expect(screen.getByText('duct_001')).toBeDefined()
  })

  it('タグ変更でupdateNodeが呼ばれる', () => {
    render(<DiffuserPanel nodeId="diffuser_001" />)

    const input = screen.getByDisplayValue('SA-01')
    fireEvent.change(input, { target: { value: 'SA-02' } })

    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_001', { tag: 'SA-02' })
  })

  it('非diffuserノードの場合はnullを返す', () => {
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { wall_001: { id: 'wall_001', type: 'wall' } },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })

    const { container } = render(<DiffuserPanel nodeId="wall_001" />)
    expect(container.firstChild).toBeNull()
  })
})
