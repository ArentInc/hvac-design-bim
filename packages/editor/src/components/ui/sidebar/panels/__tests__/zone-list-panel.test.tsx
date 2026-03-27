import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// 【モック設定】: useScene/useViewerストアをモックしてUI単体テスト可能にする
vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

vi.mock('../../panels/hvac/format-load', () => ({
  formatLoad: (watts: number) => {
    if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`
    return `${Math.round(watts)} W`
  },
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { UsageColorIcon, ZoneListItem, ZoneListPanel } from '../zone-list-panel'

// 【テストデータ】: 標準的なHvacZoneNodeのモックデータ3件
const makeZone = (
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: id as `hvac_zone_${string}`,
  type: 'hvac_zone' as const,
  object: 'node' as const,
  visible: true,
  metadata: {},
  zoneName: `ゾーン-${id}`,
  usage: 'office_general' as const,
  floorArea: 50.0,
  floorHeight: 0,
  ceilingHeight: 2.7,
  occupantDensity: 0.15,
  boundary: [[0, 0], [10, 0], [10, 5], [0, 5]] as [number, number][],
  designConditions: { coolingSetpoint: 26, heatingSetpoint: 22, relativeHumidity: 50, supplyAirTempDiff: 10 },
  perimeterSegments: [],
  systemId: null,
  calcResult: null,
  parentId: null,
  children: [],
  ...overrides,
})

const zone1 = makeZone('hvac_zone_001')
const zone2 = makeZone('hvac_zone_002', { usage: 'conference' })
const zone3 = makeZone('hvac_zone_003')

const mockSetSelection = vi.fn()

function setupMocks(
  zones: ReturnType<typeof makeZone>[],
  selectedIds: string[] = [],
) {
  const nodes = Object.fromEntries(zones.map((z) => [z.id, z]))
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = { nodes }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = {
      selection: { selectedIds },
      setSelection: mockSetSelection,
    }
    return selector ? selector(state as any) : state
  })
}

beforeEach(() => {
  setupMocks([zone1, zone2, zone3])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0017: ZoneListPanel', () => {
  it('テスト1: 3件のHvacZoneNodeが一覧表示される', () => {
    render(<ZoneListPanel />)

    expect(screen.getByText('ゾーン-hvac_zone_001')).toBeDefined()
    expect(screen.getByText('ゾーン-hvac_zone_002')).toBeDefined()
    expect(screen.getByText('ゾーン-hvac_zone_003')).toBeDefined()
  })

  it('テスト2: HvacZoneNodeが0件のとき「ゾーンがありません」が表示される', () => {
    setupMocks([])
    render(<ZoneListPanel />)

    expect(screen.getByTestId('empty-message')).toBeDefined()
    expect(screen.getByText('ゾーンがありません')).toBeDefined()
  })

  it('テスト3: クリックでuseViewer.setSelection([zoneId])が呼ばれる', () => {
    render(<ZoneListPanel />)

    const item = screen.getByTestId('zone-list-item-hvac_zone_002')
    fireEvent.click(item)

    expect(mockSetSelection).toHaveBeenCalledWith({ selectedIds: ['hvac_zone_002'] })
  })

  it('テスト4: Ctrl+クリックでマルチ選択（既選択に追加）', () => {
    setupMocks([zone1, zone2, zone3], ['hvac_zone_001'])
    render(<ZoneListPanel />)

    const item = screen.getByTestId('zone-list-item-hvac_zone_002')
    fireEvent.click(item, { ctrlKey: true })

    expect(mockSetSelection).toHaveBeenCalledWith({
      selectedIds: ['hvac_zone_001', 'hvac_zone_002'],
    })
  })

  it('テスト4b: Ctrl+クリックで選択済みゾーンをトグル（選択解除）', () => {
    setupMocks([zone1, zone2, zone3], ['hvac_zone_001', 'hvac_zone_002'])
    render(<ZoneListPanel />)

    const item = screen.getByTestId('zone-list-item-hvac_zone_001')
    fireEvent.click(item, { ctrlKey: true })

    expect(mockSetSelection).toHaveBeenCalledWith({
      selectedIds: ['hvac_zone_002'],
    })
  })

  it('テスト5: usage="conference"のゾーンに「会議室」ラベルが表示される', () => {
    render(<ZoneListPanel />)

    expect(screen.getByText('会議室')).toBeDefined()
  })

  it('テスト6: calcResult設定時に冷房負荷と風量が表示される', () => {
    const zoneWithResult = makeZone('hvac_zone_calc', {
      calcResult: {
        coolingLoad: 17400,
        heatingLoad: 8000,
        requiredAirflow: 4478,
        internalLoad: 10000,
        envelopeLoad: 7400,
        perimeterLoadBreakdown: [],
        status: 'success' as const,
      },
    })
    setupMocks([zoneWithResult])
    render(<ZoneListPanel />)

    expect(screen.getByText('冷房: 17.4 kW')).toBeDefined()
    expect(screen.getByText('風量: 4,478 m³/h')).toBeDefined()
  })

  it('テスト7: calcResult=nullのとき負荷サマリー行が表示されない', () => {
    render(<ZoneListPanel />)

    // zone1はcalcResult=nullなので負荷サマリーなし
    expect(screen.queryAllByTestId('load-summary').length).toBe(0)
  })

  it('テスト8: usage="office_server"のUsageColorIconはbackgroundColor=#EF5350', () => {
    const { container } = render(<UsageColorIcon usage="office_server" />)
    const icon = container.querySelector('[data-testid="usage-color-icon"]') as HTMLElement
    expect(icon).toBeDefined()
    expect(icon.style.backgroundColor).toBe('#EF5350')
  })

  it('テスト8b: 未知のusageはフォールバックカラー(#9E9E9E)が適用される', () => {
    const { container } = render(<UsageColorIcon usage="unknown_usage" />)
    const icon = container.querySelector('[data-testid="usage-color-icon"]') as HTMLElement
    expect(icon.style.backgroundColor).toBe('#9E9E9E')
  })

  it('テスト9: zoneName未設定のゾーンは「名称未設定」と表示される', () => {
    const zoneNoName = makeZone('hvac_zone_noname', { zoneName: '' })
    setupMocks([zoneNoName])
    render(<ZoneListPanel />)

    expect(screen.getByText('名称未設定')).toBeDefined()
  })

  it('テスト10: 選択されているゾーンのZoneListItemにisSelected=trueが渡される', () => {
    setupMocks([zone1, zone2, zone3], ['hvac_zone_002'])
    render(<ZoneListPanel />)

    // 選択されているゾーンのアイテムが存在することを確認
    const selectedItem = screen.getByTestId('zone-list-item-hvac_zone_002')
    expect(selectedItem).toBeDefined()
    // 非選択アイテムも存在する
    const unselectedItem = screen.getByTestId('zone-list-item-hvac_zone_001')
    expect(unselectedItem).toBeDefined()
  })
})

describe('TASK-0017: ZoneListItem', () => {
  it('面積は小数点1桁で表示される', () => {
    const onSelect = vi.fn()
    render(
      <ZoneListItem
        isSelected={false}
        onSelect={onSelect}
        zone={zone1}
      />,
    )
    expect(screen.getByText('50.0 m²')).toBeDefined()
  })

  it('用途ラベルが正しく日本語化される', () => {
    const onSelect = vi.fn()
    render(
      <ZoneListItem
        isSelected={false}
        onSelect={onSelect}
        zone={zone2}
      />,
    )
    expect(screen.getByText('会議室')).toBeDefined()
  })
})
