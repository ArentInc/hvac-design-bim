/**
 * TASK-0040: WarningListPanel 単体テスト
 *
 * 【テスト対象】: warning-list-panel.tsx の WarningListPanel コンポーネント
 * 【テストフレームワーク】: Vitest + @testing-library/react
 * 🔵 信頼性レベル: REQ-1202, REQ-1203, REQ-1404
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useValidation: vi.fn(),
  useScene: vi.fn(),
}))

import { useScene, useValidation } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { WarningListPanel } from '../warning-list-panel'

const mockWarnings = [
  {
    id: 'w1',
    nodeId: 'ahu_001',
    nodeType: 'ahu',
    severity: 'error' as const,
    code: 'unconnected_port' as const,
    message: 'ポート未接続',
  },
  {
    id: 'w2',
    nodeId: 'duct_001',
    nodeType: 'duct_segment',
    severity: 'warning' as const,
    code: 'velocity_exceeded' as const,
    message: '風速超過',
  },
  {
    id: 'w3',
    nodeId: 'zone_001',
    nodeType: 'hvac_zone',
    severity: 'info' as const,
    code: 'zone_no_system' as const,
    message: '系統未割当',
  },
]

const mockNodes = {
  ahu_001: { id: 'ahu_001', type: 'ahu', name: 'AHU-1', children: [], parentId: null },
  duct_001: {
    id: 'duct_001',
    type: 'duct_segment',
    name: 'ダクト-1',
    children: [],
    parentId: null,
  },
}

const mockSetSelection = vi.fn()

beforeEach(() => {
  vi.mocked(useValidation).mockImplementation((selector: any) => {
    const state = { warnings: mockWarnings, setWarnings: vi.fn() }
    return selector ? selector(state) : state
  })
  vi.mocked(useScene).mockImplementation((selector: any) => {
    const state = { nodes: mockNodes }
    return selector ? selector(state) : state
  })
  vi.mocked(useViewer).mockImplementation((selector: any) => {
    const state = { setSelection: mockSetSelection }
    return selector ? selector(state) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0040: WarningListPanel', () => {
  it('テスト1: 3件の警告がseverity順（error→warning→info）で表示される', () => {
    // 【テスト目的】: warnings が severity 重要度順にソートされて表示されることを確認
    // 🔵 信頼性レベル: REQ-1202

    render(<WarningListPanel />)

    const messages = ['ポート未接続', '風速超過', '系統未割当']
    for (const msg of messages) {
      expect(screen.getByText(msg)).toBeDefined()
    }

    // error が最初に来ることを確認
    const allText = document.body.textContent ?? ''
    const errorIdx = allText.indexOf('ポート未接続')
    const warningIdx = allText.indexOf('風速超過')
    const infoIdx = allText.indexOf('系統未割当')
    expect(errorIdx).toBeLessThan(warningIdx)
    expect(warningIdx).toBeLessThan(infoIdx)
  })

  it('テスト2: 警告行クリックでuseViewer.selectedIdsが["ahu_001"]に更新される', () => {
    // 【テスト目的】: 警告行クリック時に setSelection が正しく呼ばれることを確認
    // 🔵 信頼性レベル: REQ-1203

    render(<WarningListPanel />)

    // 「ポート未接続」の行全体をクリック（親要素）
    const msgEl = screen.getByText('ポート未接続')
    fireEvent.click(msgEl)

    expect(mockSetSelection).toHaveBeenCalledWith({ selectedIds: ['ahu_001'] })
  })

  it('テスト3: 警告0件時に「警告なし」のプレースホルダーが表示される', () => {
    // 【テスト目的】: warnings が空のとき「警告なし」が表示されることを確認
    // 🔵 信頼性レベル: REQ-1202

    vi.mocked(useValidation).mockImplementation((selector: any) => {
      const state = { warnings: [], setWarnings: vi.fn() }
      return selector ? selector(state) : state
    })

    render(<WarningListPanel />)

    expect(screen.getByText('警告なし')).toBeDefined()
  })

  it('テスト4: ノードに name がある場合、ノード名が警告行に表示される', () => {
    // 【テスト目的】: nodes[nodeId].name が存在する場合に表示されることを確認
    // 🔵 信頼性レベル: REQ-1202

    render(<WarningListPanel />)

    expect(screen.getByText('AHU-1')).toBeDefined()
  })

  it('テスト5: WarningCodeフィルタを有効にすると該当警告のみ表示される', () => {
    // 【テスト目的】: フィルタ適用で一致コードの警告のみ表示されることを確認
    // 🟡 信頼性レベル: UX推論

    render(<WarningListPanel />)

    // 「エラーのみ」フィルタボタンをクリック（aria-label="filter-error"）
    const filterBtn = screen.getByLabelText('filter-error')
    fireEvent.click(filterBtn)

    // error の警告だけ表示される
    expect(screen.getByText('ポート未接続')).toBeDefined()
    expect(screen.queryByText('風速超過')).toBeNull()
    expect(screen.queryByText('系統未割当')).toBeNull()
  })
})
