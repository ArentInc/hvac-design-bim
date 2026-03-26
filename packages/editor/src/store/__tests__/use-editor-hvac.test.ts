import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: {
    getState: () => ({
      selection: { buildingId: null, levelId: null },
      resetSelection: vi.fn(),
      setSelection: vi.fn(),
    }),
  },
}))

vi.mock('@pascal-app/core', () => ({
  useScene: {
    getState: () => ({
      rootNodeIds: [],
      nodes: {},
    }),
  },
}))

import useEditor, { phasesByEditorMode, toolsByPhase } from '../use-editor'

beforeEach(() => {
  useEditor.setState({
    editorMode: 'architecture',
    phase: 'site',
    mode: 'select',
    tool: null,
  })
})

describe('TASK-0007: useEditor HVAC extensions', () => {
  it('テスト1: 初期状態で editorMode が architecture', () => {
    const { editorMode } = useEditor.getState()
    expect(editorMode).toBe('architecture')
  })

  it('テスト2: setEditorMode(hvac) で phase が zone に切替', () => {
    const { setEditorMode } = useEditor.getState()
    setEditorMode('hvac')
    const state = useEditor.getState()
    expect(state.editorMode).toBe('hvac')
    expect(state.phase).toBe('zone')
    expect(state.mode).toBe('select')
  })

  it('テスト3: setEditorMode(architecture) で phase が site に切替', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    const { setEditorMode } = useEditor.getState()
    setEditorMode('architecture')
    const state = useEditor.getState()
    expect(state.editorMode).toBe('architecture')
    expect(state.phase).toBe('site')
    expect(state.mode).toBe('select')
  })

  it('テスト4: HVACモードで建築フェーズ設定不可', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    const { setPhase } = useEditor.getState()
    setPhase('structure')
    const { phase } = useEditor.getState()
    expect(phase).toBe('zone')
  })

  it('テスト5: 建築モードでHVACフェーズ設定不可', () => {
    const { setPhase } = useEditor.getState()
    setPhase('equip')
    const { phase } = useEditor.getState()
    expect(phase).toBe('site')
  })

  it('テスト6: HVACモードで有効なフェーズ切替', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    const { setPhase } = useEditor.getState()
    setPhase('equip')
    const { phase } = useEditor.getState()
    expect(phase).toBe('equip')
  })

  it('テスト7: phasesByEditorMode の完全性', () => {
    expect(phasesByEditorMode.architecture).toContain('site')
    expect(phasesByEditorMode.architecture).toContain('structure')
    expect(phasesByEditorMode.architecture).toContain('furnish')
  })

  it('テスト8: toolsByPhase の完全性', () => {
    expect(toolsByPhase.zone).toHaveLength(2)
    expect(toolsByPhase.equip).toHaveLength(3)
    expect(toolsByPhase.route).toHaveLength(4)
    expect(toolsByPhase.calc).toHaveLength(1)
  })

  it('テスト9: モード切替でactiveToolがリセット', () => {
    useEditor.setState({ tool: 'wall' })
    const { setEditorMode } = useEditor.getState()
    setEditorMode('hvac')
    const { tool } = useEditor.getState()
    expect(tool).toBeNull()
  })

  it('テスト10: 全HvacPhaseへの正常切替', () => {
    useEditor.setState({ editorMode: 'hvac', phase: 'zone' })
    const store = useEditor.getState()
    store.setPhase('equip')
    expect(useEditor.getState().phase).toBe('equip')
    store.setPhase('route')
    expect(useEditor.getState().phase).toBe('route')
    store.setPhase('calc')
    expect(useEditor.getState().phase).toBe('calc')
    store.setPhase('zone')
    expect(useEditor.getState().phase).toBe('zone')
  })
})
