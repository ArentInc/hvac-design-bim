import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

vi.mock('../../../../store/use-editor', () => ({
  default: vi.fn(),
}))

vi.mock('../hvac/phase-welcome-panel', () => ({
  HvacPhaseWelcomePanel: ({ phase }: { phase: string }) => (
    <div data-testid="welcome-panel">{phase}</div>
  ),
}))

vi.mock('../hvac/ahu-panel', () => ({
  AhuPanel: () => <div data-testid="ahu-panel" />,
}))

vi.mock('../hvac/calc-result-panel', () => ({
  CalcResultPanel: () => <div data-testid="calc-result-panel" />,
}))

vi.mock('../hvac/diffuser-panel', () => ({
  DiffuserPanel: () => <div data-testid="diffuser-panel" />,
}))

vi.mock('../../sidebars/hvac/duct-panel', () => ({
  DuctPanel: () => <div data-testid="duct-panel" />,
}))

vi.mock('../../sidebars/hvac/pipe-panel', () => ({
  PipePanel: () => <div data-testid="pipe-panel" />,
}))

vi.mock('../ceiling-panel', () => ({
  CeilingPanel: () => <div data-testid="ceiling-panel" />,
}))

vi.mock('../door-panel', () => ({
  DoorPanel: () => <div data-testid="door-panel" />,
}))

vi.mock('../hvac/hvac-zone-panel', () => ({
  HvacZonePanel: () => <div data-testid="hvac-zone-panel" />,
}))

vi.mock('../hvac/system-panel', () => ({
  SystemPanel: () => <div data-testid="system-panel" />,
}))

vi.mock('../item-panel', () => ({
  ItemPanel: () => <div data-testid="item-panel" />,
}))

vi.mock('../reference-panel', () => ({
  ReferencePanel: () => <div data-testid="reference-panel" />,
}))

vi.mock('../roof-panel', () => ({
  RoofPanel: () => <div data-testid="roof-panel" />,
}))

vi.mock('../roof-segment-panel', () => ({
  RoofSegmentPanel: () => <div data-testid="roof-segment-panel" />,
}))

vi.mock('../slab-panel', () => ({
  SlabPanel: () => <div data-testid="slab-panel" />,
}))

vi.mock('../wall-panel', () => ({
  WallPanel: () => <div data-testid="wall-panel" />,
}))

vi.mock('../window-panel', () => ({
  WindowPanel: () => <div data-testid="window-panel" />,
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import useEditor from '../../../../store/use-editor'
import { PanelManager } from '../panel-manager'

function mockEditorState(state: {
  editorMode: 'architecture' | 'hvac'
  phase: 'site' | 'structure' | 'furnish' | 'zone' | 'equip' | 'route' | 'calc'
  selectedReferenceId: string | null
}) {
  vi.mocked(useEditor).mockImplementation((selector?: (value: any) => any) =>
    selector ? selector(state) : state,
  )
}

function mockViewerSelectedIds(selectedIds: string[]) {
  vi.mocked(useViewer).mockImplementation((selector?: (value: any) => any) => {
    const state = { selection: { selectedIds } }
    return selector ? selector(state) : state
  })
}

function mockNodes(nodes: Record<string, { id: string; type: string }>) {
  vi.mocked(useScene).mockImplementation((selector?: (value: any) => any) => {
    const state = { nodes }
    return selector ? selector(state) : state
  })
}

beforeEach(() => {
  mockEditorState({ editorMode: 'hvac', phase: 'zone', selectedReferenceId: null })
  mockViewerSelectedIds([])
  mockNodes({})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PanelManager HVAC defaults', () => {
  it('renders the welcome panel in zone phase when nothing is selected', () => {
    render(<PanelManager />)

    expect(screen.getByTestId('welcome-panel')).toBeDefined()
    expect(screen.getByText('zone')).toBeDefined()
  })

  it('does not render a right-side default panel in equip phase', () => {
    mockEditorState({ editorMode: 'hvac', phase: 'equip', selectedReferenceId: null })

    const { container } = render(<PanelManager />)

    expect(container.firstChild).toBeNull()
  })

  it('renders the welcome panel in route phase when nothing is selected', () => {
    mockEditorState({ editorMode: 'hvac', phase: 'route', selectedReferenceId: null })

    render(<PanelManager />)

    expect(screen.getByTestId('welcome-panel')).toBeDefined()
    expect(screen.getByText('route')).toBeDefined()
  })

  it('does not render a right-side default panel in calc phase', () => {
    mockEditorState({ editorMode: 'hvac', phase: 'calc', selectedReferenceId: null })

    const { container } = render(<PanelManager />)

    expect(container.firstChild).toBeNull()
  })

  it('still renders detail panels when a node is selected', () => {
    mockEditorState({ editorMode: 'hvac', phase: 'equip', selectedReferenceId: null })
    mockViewerSelectedIds(['ahu_001'])
    mockNodes({
      ahu_001: { id: 'ahu_001', type: 'ahu' },
    })

    render(<PanelManager />)

    expect(screen.getByTestId('ahu-panel')).toBeDefined()
  })
})
