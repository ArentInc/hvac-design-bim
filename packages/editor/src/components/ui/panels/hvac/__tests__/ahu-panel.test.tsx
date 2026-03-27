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
import { AhuPanel } from '../ahu-panel'

const mockPorts = [
  {
    id: 'port_1',
    label: '給気口',
    medium: 'supply_air' as const,
    position: [0, 0, 0] as [number, number, number],
    direction: [1, 0, 0] as [number, number, number],
    connectedSegmentId: null,
  },
  {
    id: 'port_2',
    label: '還気口',
    medium: 'return_air' as const,
    position: [0, 0, 1] as [number, number, number],
    direction: [-1, 0, 0] as [number, number, number],
    connectedSegmentId: null,
  },
  {
    id: 'port_3',
    label: '冷水入口',
    medium: 'chilled_water' as const,
    position: [0, 0, 2] as [number, number, number],
    direction: [0, 1, 0] as [number, number, number],
    connectedSegmentId: 'pipe_001',
  },
  {
    id: 'port_4',
    label: '冷水出口',
    medium: 'chilled_water' as const,
    position: [0, 0, 3] as [number, number, number],
    direction: [0, -1, 0] as [number, number, number],
    connectedSegmentId: null,
  },
]

const mockAhuNode = {
  id: 'ahu_001',
  type: 'ahu' as const,
  tag: 'AHU-01',
  equipmentName: '型式A-80',
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  dimensions: { width: 1.2, height: 0.8, depth: 2.0 },
  ports: mockPorts,
  airflowRate: 15000,
  coolingCapacity: 80,
  heatingCapacity: 70,
  staticPressure: 150,
  systemId: 'system_001',
  parentId: null,
  children: [],
}

const mockUpdateNode = vi.fn()

beforeEach(() => {
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selectedIds: ['ahu_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { ahu_001: mockAhuNode },
      updateNode: mockUpdateNode,
    }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0026: AhuPanel', () => {
  it('テスト3: タグ・機種名・4ポート一覧が表示される', () => {
    render(<AhuPanel nodeId="ahu_001" />)

    expect(screen.getByTestId('ahu-panel')).toBeDefined()
    expect(screen.getByDisplayValue('AHU-01')).toBeDefined()
    expect(screen.getByText('型式A-80')).toBeDefined()
    expect(screen.getByText('給気口')).toBeDefined()
    expect(screen.getByText('還気口')).toBeDefined()
    expect(screen.getByText('冷水入口')).toBeDefined()
    expect(screen.getByText('冷水出口')).toBeDefined()
  })

  it('テスト4: 定格値（冷房・暖房・風量）が表示される', () => {
    render(<AhuPanel nodeId="ahu_001" />)

    expect(screen.getByText('冷房')).toBeDefined()
    expect(screen.getByText('80.0kW')).toBeDefined()
    expect(screen.getByText('暖房')).toBeDefined()
    expect(screen.getByText('70.0kW')).toBeDefined()
    expect(screen.getByText('風量')).toBeDefined()
    expect(screen.getByText('15000m3/h')).toBeDefined()
  })

  it('タグ変更でupdateNodeが呼ばれる', () => {
    render(<AhuPanel nodeId="ahu_001" />)

    const input = screen.getByDisplayValue('AHU-01')
    fireEvent.change(input, { target: { value: 'AHU-02' } })

    expect(mockUpdateNode).toHaveBeenCalledWith('ahu_001', { tag: 'AHU-02' })
  })

  it('非ahuノードの場合はnullを返す', () => {
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { wall_001: { id: 'wall_001', type: 'wall' } },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })

    const { container } = render(<AhuPanel nodeId="wall_001" />)
    expect(container.firstChild).toBeNull()
  })
})
