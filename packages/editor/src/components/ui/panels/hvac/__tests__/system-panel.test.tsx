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
import { SystemPanel } from '../system-panel'

const mockSystemNode = {
  id: 'system_001',
  type: 'system' as const,
  systemName: 'AHU系統-1',
  servedZoneIds: ['hvac_zone_001', 'hvac_zone_002', 'hvac_zone_003'],
  ahuId: 'ahu_001',
  aggregatedLoad: {
    totalCoolingLoad: 45,
    totalHeatingLoad: 36,
    totalAirflow: 4500,
  },
  status: 'draft' as const,
  selectionMargin: 1.1,
  equipmentCandidates: [],
  selectionStatus: 'pending' as const,
  recommendedEquipmentId: null,
  parentId: null,
  children: [],
}

const mockAhuNode = {
  id: 'ahu_001',
  type: 'ahu' as const,
  tag: 'AHU-01',
  equipmentName: '型式A-80',
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  dimensions: { width: 1.2, height: 0.8, depth: 2.0 },
  ports: [],
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
    const state = { selectedIds: ['system_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { system_001: mockSystemNode, ahu_001: mockAhuNode },
      updateNode: mockUpdateNode,
    }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0026: SystemPanel', () => {
  it('テスト1: 系統名と3ゾーン一覧が表示される', () => {
    render(<SystemPanel nodeId="system_001" />)

    expect(screen.getByDisplayValue('AHU系統-1')).toBeDefined()
    expect(screen.getByText('hvac_zone_001')).toBeDefined()
    expect(screen.getByText('hvac_zone_002')).toBeDefined()
    expect(screen.getByText('hvac_zone_003')).toBeDefined()
  })

  it('テスト2: aggregatedLoadが正しく表示される', () => {
    render(<SystemPanel nodeId="system_001" />)

    expect(screen.getByText('冷房: 45.0kW')).toBeDefined()
    expect(screen.getByText('暖房: 36.0kW')).toBeDefined()
    expect(screen.getByText('風量: 4500m3/h')).toBeDefined()
  })

  it('テスト3: 紐付きAHU情報が表示される', () => {
    render(<SystemPanel nodeId="system_001" />)

    expect(screen.getByText('型式A-80')).toBeDefined()
  })

  it('テスト6: systemName変更でupdateNodeが呼ばれる', () => {
    render(<SystemPanel nodeId="system_001" />)

    const input = screen.getByDisplayValue('AHU系統-1')
    fireEvent.change(input, { target: { value: 'AHU系統-2' } })

    expect(mockUpdateNode).toHaveBeenCalledWith('system_001', { systemName: 'AHU系統-2' })
  })

  it('テスト7: 非systemノードの場合はnullを返す', () => {
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { wall_001: { id: 'wall_001', type: 'wall' } },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })

    const { container } = render(<SystemPanel nodeId="wall_001" />)
    expect(container.firstChild).toBeNull()
  })
})
