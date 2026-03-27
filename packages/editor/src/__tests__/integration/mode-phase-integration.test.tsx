/**
 * UI統合テスト: モード切替 + フェーズ遷移
 *
 * 【テスト目的】: 建築↔HVACモード切替、zone/equip/route/calcフェーズ遷移がUI上で正しく動作することを検証
 * 【テストフレームワーク】: Vitest + @testing-library/react (happy-dom)
 */

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

import useEditor from '../../store/use-editor'
import { ModeSwitcher, PhaseTabs } from '../../components/ui/mode-switcher'

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

describe('UI統合テスト: モード切替 + フェーズ遷移', () => {
  it('テスト1: 建築→HVACモード切替でphaseがzoneに遷移しZone/Equip/Route/Calcタブが表示される', () => {
    render(<><ModeSwitcher /><PhaseTabs /></>)

    // 初期状態: 建築モード
    expect(useEditor.getState().editorMode).toBe('architecture')

    // HVACボタンクリック
    const hvacBtn = screen.getByText('HVAC').closest('button')
    fireEvent.click(hvacBtn!)

    // HVACモードに遷移
    expect(useEditor.getState().editorMode).toBe('hvac')
    expect(useEditor.getState().phase).toBe('zone')

    // PhaseTabs再レンダリング
    cleanup()
    render(<PhaseTabs />)
    expect(screen.getByText('Zone')).toBeDefined()
    expect(screen.getByText('Equip')).toBeDefined()
    expect(screen.getByText('Route')).toBeDefined()
    expect(screen.getByText('Calc')).toBeDefined()
  })

  it('テスト2: HVACモードでzone→equip→route→calcの全フェーズ遷移が成功する', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone', mode: 'select', tool: null })
    render(<PhaseTabs />)

    // zone → equip
    fireEvent.click(screen.getByText('Equip'))
    expect(useEditor.getState().phase).toBe('equip')

    // equip → route
    fireEvent.click(screen.getByText('Route'))
    expect(useEditor.getState().phase).toBe('route')

    // route → calc
    fireEvent.click(screen.getByText('Calc'))
    expect(useEditor.getState().phase).toBe('calc')
  })

  it('テスト3: HVAC→建築モード復帰でphaseがsiteに戻りSite/Structure/Furnishタブが表示される', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone', mode: 'select', tool: null })
    render(<><ModeSwitcher /><PhaseTabs /></>)

    // 建築ボタンクリック
    const archBtn = screen.getByText('建築').closest('button')
    fireEvent.click(archBtn!)

    expect(useEditor.getState().editorMode).toBe('architecture')
    expect(useEditor.getState().phase).toBe('site')

    // PhaseTabs再レンダリング
    cleanup()
    render(<PhaseTabs />)
    expect(screen.getByText('Site')).toBeDefined()
    expect(screen.getByText('Structure')).toBeDefined()
    expect(screen.getByText('Furnish')).toBeDefined()
  })

  it('テスト4: HVACモードでEquipフェーズからZoneフェーズに戻れる', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'equip', mode: 'select', tool: null })
    render(<PhaseTabs />)

    fireEvent.click(screen.getByText('Zone'))
    expect(useEditor.getState().phase).toBe('zone')
  })

  it('テスト5: selectモードでのフェーズ遷移時にtoolがクリアされる', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone', mode: 'select', tool: 'zone_draw' })
    render(<PhaseTabs />)

    fireEvent.click(screen.getByText('Equip'))

    expect(useEditor.getState().phase).toBe('equip')
    expect(useEditor.getState().mode).toBe('select')
    expect(useEditor.getState().tool).toBeNull()
  })
})
