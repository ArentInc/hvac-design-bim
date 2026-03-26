/**
 * TASK-0037: DuctPanel 単体テスト
 *
 * 【テスト対象】: duct-panel.tsx の DuctPanel コンポーネント
 * 【テストフレームワーク】: Vitest + @testing-library/react (packages/editor/vitest.config.ts)
 * 🔵 信頼性レベル: REQ-1403（ダクトプロパティパネル）に明示
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
import { DuctPanel } from '../duct-panel'

// 【テストデータ定義】: 標準的なDuctSegmentNodeのモックデータ
const mockDuctNode = {
  id: 'duct_seg_001',
  type: 'duct_segment' as const,
  start: [0, 0, 0] as [number, number, number],
  end: [5, 0, 0] as [number, number, number],
  medium: 'supply_air' as const,
  shape: 'rectangular' as const,
  width: 400,
  height: 300,
  diameter: null,
  ductMaterial: 'galvanized_steel' as const,
  airflowRate: 600,
  startPortId: 'port_a',
  endPortId: 'port_b',
  systemId: 'system_001',
  calcResult: null,
  parentId: null,
  children: [],
}

const mockUpdateNode = vi.fn()

beforeEach(() => {
  // 【テスト前準備】: デフォルトのモック状態を設定（DuctSegmentノードが選択済み）
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selectedIds: ['duct_seg_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { duct_seg_001: mockDuctNode },
      updateNode: mockUpdateNode,
    }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0037: DuctPanel', () => {
  it('テスト1: 基本表示 — 寸法400×300、風量600 m³/h、材質亜鉛鉄板が表示される', () => {
    // 【テスト目的】: width, height, airflowRate, ductMaterial が表示されることを確認
    // 【期待される動作】: 各フィールドがパネルに表示される
    // 🔵 信頼性レベル: REQ-1403 テスト1に明示

    render(<DuctPanel />)

    // 【結果検証】: width=400 が入力フィールドに表示されていること
    expect(screen.getByDisplayValue('400')).toBeDefined()

    // 【結果検証】: height=300 が入力フィールドに表示されていること
    expect(screen.getByDisplayValue('300')).toBeDefined()

    // 【結果検証】: 風量 600 が表示されていること
    expect(screen.getByText('600')).toBeDefined()

    // 【結果検証】: 材質「亜鉛鉄板」が表示されていること
    expect(screen.getByText('亜鉛鉄板')).toBeDefined()
  })

  it('テスト2: width入力変更 → updateNode(id, {width: 500})が呼ばれる', () => {
    // 【テスト目的】: width 変更時に updateNode が正しく呼ばれることを確認
    // 【期待される動作】: input 変更するとupdateNode(id, {width: 500})が呼ばれる
    // 🔵 信頼性レベル: REQ-1403 テスト2に明示

    render(<DuctPanel />)

    // 【実際の処理実行】: width 入力を変更する
    const widthInput = screen.getByDisplayValue('400')
    fireEvent.change(widthInput, { target: { value: '500' } })

    // 【結果検証】: updateNode が正しい引数で呼ばれたこと
    expect(mockUpdateNode).toHaveBeenCalledWith('duct_seg_001', { width: 500 })
  })

  it('テスト3: 材質ドロップダウン変更 → updateNode(id, {ductMaterial: "flexible"})が呼ばれる', () => {
    // 【テスト目的】: 材質変更時に updateNode が正しく呼ばれることを確認
    // 【期待される動作】: select 変更するとupdateNode(id, {ductMaterial: 'flexible'})が呼ばれる
    // 🔵 信頼性レベル: REQ-1403 テスト3に明示

    render(<DuctPanel />)

    // 【実際の処理実行】: 材質セレクトを変更する
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'flexible' } })

    // 【結果検証】: updateNode が正しい引数で呼ばれたこと
    expect(mockUpdateNode).toHaveBeenCalledWith('duct_seg_001', { ductMaterial: 'flexible' })
  })

  it('テスト4: 非duct_segmentノード選択時はnullを返す', () => {
    // 【テスト目的】: type !== 'duct_segment'のノード選択時に何もレンダリングされないことを確認
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

    const { container } = render(<DuctPanel />)

    // 【結果検証】: 何もレンダリングされないこと
    expect(container.firstChild).toBeNull()
  })

  it('テスト5: calcResult=nullの場合、圧損が"未計算"と表示される', () => {
    // 【テスト目的】: calcResult が null の場合に「未計算」が表示されることを確認
    // 【期待される動作】: 圧損フィールドに「未計算」が表示される
    // 🔵 信頼性レベル: REQ-1403 テスト5に明示

    render(<DuctPanel />)

    // 【結果検証】: 「未計算」が表示されていること（calcResult=nullのため）
    expect(screen.getAllByText('未計算').length).toBeGreaterThan(0)
  })
})
