/**
 * TASK-0037: PipePanel 単体テスト
 *
 * 【テスト対象】: pipe-panel.tsx の PipePanel コンポーネント
 * 【テストフレームワーク】: Vitest + @testing-library/react (packages/editor/vitest.config.ts)
 * 🔵 信頼性レベル: REQ-1403（配管プロパティパネル）に明示
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 【モック設定】: useScene/useViewerストアをモックしてUI単体テスト可能にする
vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { PipePanel } from '../pipe-panel'

// 【テストデータ定義】: 標準的なPipeSegmentNodeのモックデータ
const mockPipeNode = {
  id: 'pipe_seg_001',
  type: 'pipe_segment' as const,
  start: [0, 0, 0] as [number, number, number],
  end: [3, 0, 0] as [number, number, number],
  medium: 'chilled_water' as const,
  nominalSize: 50,
  outerDiameter: 60.5,
  startPortId: 'port_a',
  endPortId: 'port_b',
  systemId: 'system_001',
  calcResult: { velocity: 1.22, pressureDrop: 1.5 },
  parentId: null,
  children: [],
}

const mockUpdateNode = vi.fn()

beforeEach(() => {
  // 【テスト前準備】: デフォルトのモック状態を設定（PipeSegmentノードが選択済み）
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selectedIds: ['pipe_seg_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { pipe_seg_001: mockPipeNode },
      updateNode: mockUpdateNode,
    }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0037: PipePanel', () => {
  it('テスト1: 基本表示 — 口径50A、媒体冷水が表示される', () => {
    // 【テスト目的】: nominalSize, medium が表示されることを確認
    // 【期待される動作】: 口径「50A」、媒体「冷水」がパネルに表示される
    // 🔵 信頼性レベル: REQ-1403 テスト1に明示

    render(<PipePanel />)

    expect(screen.getByTestId('pipe-panel')).toBeDefined()
    // 【結果検証】: 口径「50A」が表示されていること
    expect(screen.getByText('50A')).toBeDefined()

    // 【結果検証】: 媒体「冷水」が表示されていること
    expect(screen.getByText('冷水')).toBeDefined()
  })

  it('テスト2: 流速calcResult.velocity=1.22が表示される', () => {
    // 【テスト目的】: calcResult.velocity が表示されることを確認
    // 【期待される動作】: 流速「1.22」がパネルに表示される
    // 🔵 信頼性レベル: REQ-1403 テスト2に明示

    render(<PipePanel />)

    // 【結果検証】: 流速が表示されていること
    expect(screen.getByText('1.22')).toBeDefined()
  })

  it('テスト3: calcResult=nullの場合、流速が"未計算"と表示される', () => {
    // 【テスト目的】: calcResult が null の場合に「未計算」が表示されることを確認
    // 【期待される動作】: 流速・圧損フィールドに「未計算」が表示される
    // 🔵 信頼性レベル: REQ-1403 テスト3に明示

    const nodeWithoutCalc = { ...mockPipeNode, calcResult: null }
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { pipe_seg_001: nodeWithoutCalc },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })

    render(<PipePanel />)

    // 【結果検証】: 「未計算」が表示されていること（流速・圧損の両方）
    expect(screen.getAllByText('未計算').length).toBeGreaterThan(0)
  })

  it('テスト4: 非pipe_segmentノード選択時はnullを返す', () => {
    // 【テスト目的】: type !== 'pipe_segment'のノード選択時に何もレンダリングされないことを確認
    // 【期待される動作】: 壁ノードが選択されている場合、パネルは何も表示しない
    // 🔵 信頼性レベル: REQ-1403 エッジケースに明示

    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { wall_001: { id: 'wall_001', type: 'wall' } },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })
    vi.mocked(useViewer).mockImplementation((selector) => {
      const state = { selectedIds: ['wall_001'] }
      return selector ? selector(state as any) : state
    })

    const { container } = render(<PipePanel />)

    // 【結果検証】: 何もレンダリングされないこと
    expect(container.firstChild).toBeNull()
  })
})
