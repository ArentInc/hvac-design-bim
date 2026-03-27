import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../store/use-editor', () => ({
  default: vi.fn(),
}))

vi.mock('../zone-list-panel', () => ({
  ZoneListPanel: () => <div data-testid="zone-list-panel" />,
}))

vi.mock('../warning-list-panel', () => ({
  WarningListPanel: () => <div data-testid="warning-list-panel" />,
}))

vi.mock('../../../panels/hvac/system-tree-panel', () => ({
  SystemTreePanel: () => <div data-testid="system-tree-panel" />,
}))

vi.mock('../../../panels/hvac/equipment-catalog-panel', () => ({
  EquipmentCatalogPanel: () => <div data-testid="equipment-catalog-panel" />,
}))

import useEditor from '../../../../../store/use-editor'
import { HvacSidebarContent } from '../hvac-sidebar-content'

function mockEditorPhase(phase: 'zone' | 'equip' | 'route' | 'calc') {
  vi.mocked(useEditor).mockImplementation((selector?: (state: any) => any) => {
    const state = { phase }
    return selector ? selector(state) : state
  })
}

beforeEach(() => {
  mockEditorPhase('zone')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HvacSidebarContent', () => {
  it('zone phase renders the zone list only', () => {
    mockEditorPhase('zone')

    render(<HvacSidebarContent />)

    expect(screen.getByTestId('hvac-sidebar-zone')).toBeDefined()
    expect(screen.getByTestId('zone-list-panel')).toBeDefined()
    expect(screen.queryByTestId('system-tree-panel')).toBeNull()
    expect(screen.queryByTestId('equipment-catalog-panel')).toBeNull()
    expect(screen.queryByTestId('warning-list-panel')).toBeNull()
  })

  it('equip phase renders both system tree and equipment catalog', () => {
    mockEditorPhase('equip')

    render(<HvacSidebarContent />)

    expect(screen.getByTestId('hvac-sidebar-system-tree')).toBeDefined()
    expect(screen.getByTestId('hvac-sidebar-equipment-catalog')).toBeDefined()
    expect(screen.getByTestId('system-tree-panel')).toBeDefined()
    expect(screen.getByTestId('equipment-catalog-panel')).toBeDefined()
  })

  it('route phase renders the system tree only', () => {
    mockEditorPhase('route')

    render(<HvacSidebarContent />)

    expect(screen.getByTestId('hvac-sidebar-route')).toBeDefined()
    expect(screen.getByTestId('system-tree-panel')).toBeDefined()
    expect(screen.queryByTestId('equipment-catalog-panel')).toBeNull()
    expect(screen.queryByTestId('warning-list-panel')).toBeNull()
  })

  it('calc phase renders the warning list only', () => {
    mockEditorPhase('calc')

    render(<HvacSidebarContent />)

    expect(screen.getByTestId('hvac-sidebar-calc')).toBeDefined()
    expect(screen.getByTestId('warning-list-panel')).toBeDefined()
    expect(screen.queryByTestId('system-tree-panel')).toBeNull()
    expect(screen.queryByTestId('equipment-catalog-panel')).toBeNull()
  })
})
