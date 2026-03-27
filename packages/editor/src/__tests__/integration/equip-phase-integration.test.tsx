/**
 * UI統合テスト: Equipフェーズ — プリセットStage 2実データによるパネル表示検証
 *
 * 【テスト目的】: SystemTreePanel, SystemPanel, AhuPanel, DiffuserPanel, EquipmentCatalogPanel
 *   がプリセット実データで正しく表示されるか検証
 * 【使用プリセット】: Stage 2 (buildPresetStage02()) — 系統構成・機器配置済み
 * 【テストフレームワーク】: Vitest + @testing-library/react (happy-dom)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const mockSetSelection = vi.hoisted(() => vi.fn())

vi.mock('@pascal-app/viewer', () => ({
  useViewer: Object.assign(
    vi.fn((selector?: (state: any) => any) => {
      const state = { selection: { selectedIds: [] }, selectedIds: [] }
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
import { SystemTreePanel } from '../../components/ui/panels/hvac/system-tree-panel'
import { SystemPanel } from '../../components/ui/panels/hvac/system-panel'
import { AhuPanel } from '../../components/ui/panels/hvac/ahu-panel'
import { DiffuserPanel } from '../../components/ui/panels/hvac/diffuser-panel'
import { EquipmentCatalogPanel } from '../../components/ui/panels/hvac/equipment-catalog-panel'
import { getPresetNodes, filterNodesByType } from './helpers/preset-fixtures'

const stage2Nodes = getPresetNodes(2)

function setupScene(nodes = stage2Nodes) {
  vi.mocked(useScene).mockImplementation((selector?: (state: any) => any) => {
    const state = { nodes, updateNode: vi.fn() }
    return selector ? selector(state) : state
  })
}

function setupViewer(selectedIds: string[] = []) {
  vi.mocked(useViewer).mockImplementation((selector?: (state: any) => any) => {
    const state = { selectedIds, selection: { selectedIds }, setSelection: mockSetSelection }
    return selector ? selector(state) : state
  })
}

beforeEach(() => {
  setupScene()
  setupViewer()
  mockSetSelection.mockClear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UI統合テスト: Equipフェーズ (Stage 2)', () => {
  it('テスト1: SystemTreePanelに系統階層（系統→ゾーン→AHU）が表示される', () => {
    // 【テスト目的】: プリセットStage 2の系統ツリーが正しく階層表示されるか
    render(<SystemTreePanel />)

    // Stage 2には系統ノードが存在する
    const systems = filterNodesByType(stage2Nodes, 'system')
    expect(systems.length).toBeGreaterThan(0)

    // 各系統名が表示される
    for (const sys of systems) {
      expect(screen.getByText(sys.systemName)).toBeDefined()
    }

    // ゾーン名が表示される
    const zones = filterNodesByType(stage2Nodes, 'hvac_zone')
    for (const zone of zones) {
      expect(screen.getByText(zone.zoneName)).toBeDefined()
    }
  })

  it('テスト2: SystemPanelが系統の集約負荷（totalCoolingLoad, totalAirflow）を表示', () => {
    // 【テスト目的】: プリセットの系統集約負荷値がSystemPanelに正しく表示されるか
    // SystemPanelはnodeIdプロップを受け取る
    const systems = filterNodesByType(stage2Nodes, 'system')
    const targetSystem = systems[0]!

    render(<SystemPanel nodeId={targetSystem.id} />)

    // 系統名が表示される
    expect(screen.getByDisplayValue(targetSystem.systemName)).toBeDefined()

    // servedZoneIdsの数がテキスト内に含まれる
    const container = document.body.textContent || ''
    expect(container).toContain(targetSystem.servedZoneIds.length.toString())
  })

  it('テスト3: AhuPanelがAHUのtag, equipmentName, ポート一覧を表示', () => {
    // 【テスト目的】: プリセットのAHUノードデータがAhuPanelに正しく表示されるか
    // AhuPanelはnodeIdプロップを受け取る
    const ahus = filterNodesByType(stage2Nodes, 'ahu')
    expect(ahus.length).toBeGreaterThan(0)
    const targetAhu = ahus[0]!

    render(<AhuPanel nodeId={targetAhu.id} />)

    // tag入力フィールドが表示される
    expect(screen.getByDisplayValue(targetAhu.tag)).toBeDefined()

    // equipmentNameが表示される
    expect(screen.getByText(targetAhu.equipmentName)).toBeDefined()

    // ポート一覧が表示される（SA, RA, CHW_S, CHW_R等）
    for (const port of targetAhu.ports) {
      expect(screen.getByText(port.label)).toBeDefined()
    }
  })

  it('テスト4: DiffuserPanelが制気口のsubType, neckDiameter, airflowRateを表示', () => {
    // 【テスト目的】: プリセットの制気口データがDiffuserPanelに正しく表示されるか
    // DiffuserPanelはnodeIdプロップを受け取る
    const diffusers = filterNodesByType(stage2Nodes, 'diffuser')
    expect(diffusers.length).toBeGreaterThan(0)
    const targetDiffuser = diffusers[0]!

    render(<DiffuserPanel nodeId={targetDiffuser.id} />)

    // tag入力フィールドが表示される
    expect(screen.getByDisplayValue(targetDiffuser.tag)).toBeDefined()

    // neckDiameterが「XXXmm」形式で表示される（テキストが分割されている場合を考慮）
    const neckText = screen.getByText(/ネック径/)
    expect(neckText).toBeDefined()
    const container = document.body.textContent || ''
    expect(container).toContain(`${targetDiffuser.neckDiameter}`)
  })

  it('テスト5: EquipmentCatalogPanelがカタログ機器一覧を表示', () => {
    // 【テスト目的】: 機器カタログパネルがAHUカタログを正しくモデル名で一覧表示するか
    render(<EquipmentCatalogPanel />)

    // AHUカタログのモデル名が表示される
    expect(screen.getByText('小型AHU 2000')).toBeDefined()
    expect(screen.getByText('中小型AHU 5000')).toBeDefined()
    expect(screen.getByText('中型AHU 10000')).toBeDefined()
    expect(screen.getByText('大型AHU 20000')).toBeDefined()
    expect(screen.getByText('特大型AHU 30000')).toBeDefined()
  })
})
