import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: {
    getState: vi.fn(() => ({
      selection: { buildingId: null, levelId: null },
      resetSelection: vi.fn(),
      setSelection: vi.fn(),
    })),
  },
}))

vi.mock('@pascal-app/core', () => ({
  useScene: {
    getState: vi.fn(() => ({
      rootNodeIds: [],
      nodes: {},
    })),
  },
}))

import useEditor from '../../../store/use-editor'
import { ModeSwitcher, PhaseTabs } from '../mode-switcher'

beforeEach(() => {
  useEditor.setState({
    editorMode: 'architecture',
    phase: 'site',
    mode: 'select',
    tool: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('ModeSwitcher', () => {
  it('テスト1: 建築/HVACボタンが表示される', () => {
    render(<ModeSwitcher />)
    expect(screen.getByText('建築')).toBeDefined()
    expect(screen.getByText('HVAC')).toBeDefined()
  })

  it('テスト2: 建築ボタンクリックでsetEditorMode(architecture)が呼ばれる', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    render(<ModeSwitcher />)
    const archBtn = screen.getByText('建築').closest('button')
    fireEvent.click(archBtn!)
    expect(useEditor.getState().editorMode).toBe('architecture')
  })

  it('テスト3: HVACボタンクリックでsetEditorMode(hvac)が呼ばれる', () => {
    render(<ModeSwitcher />)
    const hvacBtn = screen.getByText('HVAC').closest('button')
    fireEvent.click(hvacBtn!)
    expect(useEditor.getState().editorMode).toBe('hvac')
  })

  it('テスト4: HVACモードでHVACボタンにdata-active="true"が付与される', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    render(<ModeSwitcher />)
    const hvacBtn = screen.getByText('HVAC').closest('button')
    expect(hvacBtn?.getAttribute('data-active')).toBe('true')
  })
})

describe('PhaseTabs', () => {
  it('テスト5: HVACモードでZone/Equip/Route/Calcタブが表示される', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    render(<PhaseTabs />)
    expect(screen.getByText('Zone')).toBeDefined()
    expect(screen.getByText('Equip')).toBeDefined()
    expect(screen.getByText('Route')).toBeDefined()
    expect(screen.getByText('Calc')).toBeDefined()
  })

  it('テスト6: 建築モードでSite/Structure/Furnishタブが表示される', () => {
    render(<PhaseTabs />)
    expect(screen.getByText('Site')).toBeDefined()
    expect(screen.getByText('Structure')).toBeDefined()
    expect(screen.getByText('Furnish')).toBeDefined()
  })
})
