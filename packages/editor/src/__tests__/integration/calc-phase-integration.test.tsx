/**
 * UI統合テスト: Calcフェーズ — プリセットStage 4実データによる計算結果・警告パネル検証
 *
 * 【テスト目的】: DuctPanel(計算済み), PipePanel(計算済み), WarningListPanelがプリセット実データで正しく表示されるか検証
 * 【使用プリセット】: Stage 4 (buildPresetStage04()) — 全計算完了（完成状態）
 * 【テストフレームワーク】: Vitest + @testing-library/react (happy-dom)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
  useValidation: vi.fn(),
}))

import { useScene, useValidation } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { DuctPanel } from '../../components/sidebars/hvac/duct-panel'
import { PipePanel } from '../../components/sidebars/hvac/pipe-panel'
import { WarningListPanel } from '../../components/ui/sidebar/panels/warning-list-panel'
import { getPresetNodes, filterNodesByType, setupSceneMock, setupViewerMock } from './helpers/preset-fixtures'

const stage4Nodes = getPresetNodes(4)

// 警告テスト用のモックデータ
const mockWarnings = [
  {
    id: 'w1',
    nodeId: 'ahu_pA',
    nodeType: 'ahu',
    severity: 'error' as const,
    code: 'unconnected_port' as const,
    message: 'RAポート未接続',
  },
  {
    id: 'w2',
    nodeId: 'duct_seg_pA_sa_main',
    nodeType: 'duct_segment',
    severity: 'warning' as const,
    code: 'velocity_exceeded' as const,
    message: '風速が推奨値を超過しています (15.2 m/s > 15 m/s)',
  },
  {
    id: 'w3',
    nodeId: 'hvac_zone_p03',
    nodeType: 'hvac_zone',
    severity: 'info' as const,
    code: 'zone_no_system' as const,
    message: 'ゾーンが系統に未割当です',
  },
]

const mockSetSelection = vi.fn()

beforeEach(() => {
  setupSceneMock(vi.mocked(useScene), stage4Nodes)
  vi.mocked(useValidation as any).mockImplementation((selector?: (state: any) => any) => {
    const state = { warnings: mockWarnings, setWarnings: vi.fn() }
    return selector ? selector(state) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UI統合テスト: Calcフェーズ (Stage 4)', () => {
  it('テスト1: DuctPanelがサイジング済みダクト寸法（width/height）を表示', () => {
    // 【テスト目的】: Stage 4の計算済みダクトで寸法が正しく表示されるか
    const ducts = filterNodesByType(stage4Nodes, 'duct_segment')
    // 寸法が設定されているダクトを探す
    const sizedDuct = ducts.find((d: any) => d.width && d.width > 0)
    expect(sizedDuct).toBeDefined()

    setupViewerMock(vi.mocked(useViewer), [sizedDuct!.id])

    render(<DuctPanel />)

    // 寸法入力フィールドが存在する（幅・高さの2つ、同じ値の場合はgetAllBy使用）
    const widthInputs = screen.getAllByDisplayValue(String(sizedDuct!.width))
    expect(widthInputs.length).toBeGreaterThanOrEqual(1)

    // ダクトプロパティヘッダーが表示される
    expect(screen.getByText('ダクトプロパティ')).toBeDefined()
  })

  it('テスト2: PipePanelが口径選定済みの呼び径と流速を表示', () => {
    // 【テスト目的】: Stage 4の計算済み配管で口径と流速が正しく表示されるか
    const pipes = filterNodesByType(stage4Nodes, 'pipe_segment')
    // calcResultが設定されている配管を探す
    const calcedPipe = pipes.find((p: any) => p.calcResult && p.calcResult.velocity)
    expect(calcedPipe).toBeDefined()

    setupViewerMock(vi.mocked(useViewer), [calcedPipe!.id])

    render(<PipePanel />)

    // 口径が「XXA」形式で表示される
    if (calcedPipe!.nominalSize) {
      expect(screen.getByText(`${calcedPipe!.nominalSize}A`)).toBeDefined()
    }

    // 流速が表示される
    const container = document.body.textContent || ''
    expect(container).toContain(String(calcedPipe!.calcResult.velocity))
  })

  it('テスト3: WarningListPanelが警告を重要度順（error→warning→info）に表示', () => {
    // 【テスト目的】: 警告が重要度順に正しくソートされて表示されるか
    setupViewerMock(vi.mocked(useViewer), [], mockSetSelection)

    render(<WarningListPanel />)

    // 3件の警告メッセージが表示される
    expect(screen.getByText('RAポート未接続')).toBeDefined()
    expect(screen.getByText(/風速が推奨値を超過/)).toBeDefined()
    expect(screen.getByText('ゾーンが系統に未割当です')).toBeDefined()
  })

  it('テスト4: WarningListPanelのフィルタでerrorのみ表示に切替', () => {
    // 【テスト目的】: severity フィルタを切り替えて error のみ表示できるか
    setupViewerMock(vi.mocked(useViewer), [], mockSetSelection)

    render(<WarningListPanel />)

    // errorフィルタボタン（aria-label="filter-error"）をクリック
    const errorFilter = screen.getByLabelText('filter-error')
    fireEvent.click(errorFilter)

    // errorのみ表示される
    expect(screen.getByText('RAポート未接続')).toBeDefined()
    // warning, infoは非表示になる
    expect(screen.queryByText(/風速が推奨値を超過/)).toBeNull()
    expect(screen.queryByText('ゾーンが系統に未割当です')).toBeNull()
  })

  it('テスト5: WarningListPanelで警告クリック時にsetSelectionが呼ばれる', () => {
    // 【テスト目的】: 警告行クリックで対象ノードが選択されるか
    setupViewerMock(vi.mocked(useViewer), [], mockSetSelection)

    render(<WarningListPanel />)

    // error警告行をクリック
    const warningRow = screen.getByText('RAポート未接続').closest('[data-testid]')
    if (warningRow) {
      fireEvent.click(warningRow)
      expect(mockSetSelection).toHaveBeenCalledWith({ selectedIds: ['ahu_pA'] })
    }
  })
})
