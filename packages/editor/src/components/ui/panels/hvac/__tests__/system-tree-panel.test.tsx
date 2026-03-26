/**
 * TASK-0027: SystemTreePanel — 系統ツリー表示テスト
 *
 * 【テスト対象】: SystemTreePanel コンポーネント
 *   - 系統→ゾーン→AHU のツリー構造表示
 *   - ゾーン負荷情報（冷房kW, 風量m3/h）の表示
 *   - AHU情報の表示
 *   - ツリーノードクリックでビューア選択連動
 *   - ビューア選択→ツリーハイライト連動
 *   - 空の系統ツリー状態
 * 🔵 信頼性レベル: TASK-0027 要件定義（REQ-1404）に明示
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// vi.hoisted を使い、vi.mock ファクトリから参照できる変数を定義する
const mockSetSelection = vi.hoisted(() => vi.fn())

vi.mock('@pascal-app/viewer', () => ({
  useViewer: Object.assign(
    vi.fn((selector?: (state: any) => any) => {
      const state = { selection: { selectedIds: [] } }
      return selector ? selector(state) : state
    }),
    {
      getState: () => ({ setSelection: mockSetSelection }),
    },
  ),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { SystemTreePanel } from '../system-tree-panel'

// --- テストデータ定義 ---

const mockHvacZoneNode1 = {
  id: 'hvac_zone_001',
  type: 'hvac_zone' as const,
  zoneName: 'ゾーンA',
  calcResult: {
    coolingLoad: 15.0,
    heatingLoad: 10.0,
    requiredAirflow: 1500,
    internalLoad: 5.0,
    envelopeLoad: 10.0,
    perimeterLoadBreakdown: [],
    status: 'success' as const,
  },
  systemId: 'system_001',
  parentId: null,
  children: [],
}

const mockHvacZoneNode2 = {
  id: 'hvac_zone_002',
  type: 'hvac_zone' as const,
  zoneName: 'ゾーンB',
  calcResult: {
    coolingLoad: 20.0,
    heatingLoad: 15.0,
    requiredAirflow: 2000,
    internalLoad: 8.0,
    envelopeLoad: 12.0,
    perimeterLoadBreakdown: [],
    status: 'success' as const,
  },
  systemId: 'system_001',
  parentId: null,
  children: [],
}

const mockHvacZoneNode3 = {
  id: 'hvac_zone_003',
  type: 'hvac_zone' as const,
  zoneName: 'ゾーンC',
  calcResult: null,
  systemId: 'system_002',
  parentId: null,
  children: [],
}

const mockHvacZoneNode4 = {
  id: 'hvac_zone_004',
  type: 'hvac_zone' as const,
  zoneName: 'ゾーンD',
  calcResult: null,
  systemId: 'system_002',
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

const mockSystemNode1 = {
  id: 'system_001',
  type: 'system' as const,
  systemName: 'AHU系統-1',
  servedZoneIds: ['hvac_zone_001', 'hvac_zone_002'],
  ahuId: 'ahu_001',
  aggregatedLoad: { totalCoolingLoad: 35, totalHeatingLoad: 25, totalAirflow: 3500 },
  status: 'draft' as const,
  selectionMargin: 1.1,
  equipmentCandidates: [],
  selectionStatus: 'pending' as const,
  recommendedEquipmentId: null,
  parentId: null,
  children: [],
}

const mockSystemNode2 = {
  id: 'system_002',
  type: 'system' as const,
  systemName: 'AHU系統-2',
  servedZoneIds: ['hvac_zone_003', 'hvac_zone_004'],
  ahuId: null,
  aggregatedLoad: null,
  status: 'draft' as const,
  selectionMargin: 1.1,
  equipmentCandidates: [],
  selectionStatus: 'pending' as const,
  recommendedEquipmentId: null,
  parentId: null,
  children: [],
}

const defaultNodes = {
  system_001: mockSystemNode1,
  system_002: mockSystemNode2,
  hvac_zone_001: mockHvacZoneNode1,
  hvac_zone_002: mockHvacZoneNode2,
  hvac_zone_003: mockHvacZoneNode3,
  hvac_zone_004: mockHvacZoneNode4,
  ahu_001: mockAhuNode,
}

// --- セットアップ/クリーンアップ ---

beforeEach(() => {
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = { nodes: defaultNodes }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selection: { selectedIds: [] } }
    return selector ? selector(state as any) : state
  })
  mockSetSelection.mockClear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// --- テスト ---

describe('TASK-0027: SystemTreePanel', () => {
  it('テスト1: 2つの系統ルートと各4ゾーンがツリー表示される', () => {
    // 【テスト目的】: 2 SystemNode、各2ゾーンのツリー構造が正しく表示されることを確認
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト1」に明示
    render(<SystemTreePanel />)

    // 系統名が表示される
    expect(screen.getByText('AHU系統-1')).toBeDefined()
    expect(screen.getByText('AHU系統-2')).toBeDefined()

    // ゾーン名が表示される（合計4ゾーン）
    expect(screen.getByText('ゾーンA')).toBeDefined()
    expect(screen.getByText('ゾーンB')).toBeDefined()
    expect(screen.getByText('ゾーンC')).toBeDefined()
    expect(screen.getByText('ゾーンD')).toBeDefined()
  })

  it('テスト2: ゾーン負荷情報（冷房15kW, 風量1500m3/h）が表示される', () => {
    // 【テスト目的】: ゾーンのcoolingLoadとrequiredAirflowが正しく表示されることを確認
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト2」に明示
    render(<SystemTreePanel />)

    expect(screen.getByText(/冷房: 15kW/)).toBeDefined()
    expect(screen.getByText(/風量: 1500m3\/h/)).toBeDefined()
  })

  it('テスト3: ahuId設定済みの系統でAHU情報が表示される', () => {
    // 【テスト目的】: SystemNodeにahuId='ahu_001'が設定されていれば AHUの機種名が表示される
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト3」に明示
    render(<SystemTreePanel />)

    expect(screen.getByText('型式A-80')).toBeDefined()
  })

  it('テスト6: ツリーノードクリックでuseViewer.setSelectionが呼ばれる', () => {
    // 【テスト目的】: ゾーンAをクリックするとuseViewer.setSelectionが正しい引数で呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト6」に明示
    render(<SystemTreePanel />)

    const zoneA = screen.getByText('ゾーンA')
    fireEvent.click(zoneA)

    expect(mockSetSelection).toHaveBeenCalledWith({ selectedIds: ['hvac_zone_001'] })
  })

  it('テスト7: ビューアでAHU-01が選択されているとツリー内でハイライト表示される', () => {
    // 【テスト目的】: selectedIdsにahu_001が含まれる場合、AHUアイテムがハイライト表示される
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト7」に明示
    vi.mocked(useViewer).mockImplementation((selector) => {
      const state = { selection: { selectedIds: ['ahu_001'] } }
      return selector ? selector(state as any) : state
    })

    render(<SystemTreePanel />)

    // ハイライト状態: data-selected="true" 属性またはアクティブクラスを確認
    const ahuItem = screen.getByTestId('tree-item-ahu_001')
    expect(ahuItem.getAttribute('data-selected')).toBe('true')
  })

  it('テスト8: SystemNodeが0個の場合は空状態メッセージが表示される', () => {
    // 【テスト目的】: 系統が存在しない場合に適切な空状態メッセージが表示されることを確認
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト8」に明示
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = { nodes: {} }
      return selector ? selector(state as any) : state
    })

    render(<SystemTreePanel />)

    expect(screen.getByText('系統が登録されていません')).toBeDefined()
  })
})
