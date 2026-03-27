/**
 * UI統合テスト: 全フェーズ横断データ整合性 — Stage 4完成データによるパネル間データ検証
 *
 * 【テスト目的】: プリセットStage 4の全データで、パネル間のデータ整合性を検証
 *   - ゾーン負荷合算 ↔ 系統集約負荷の一致
 *   - 系統→ゾーン対応の整合性
 *   - AHUポート接続 → ダクトセグメント実在の整合性
 *   - 全HVACノードタイプの表示互換性
 * 【使用プリセット】: Stage 4 (buildPresetStage04()) — 全計算・バリデーション済み
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

vi.mock('../../components/ui/panels/hvac/format-load', () => ({
  formatLoad: (watts: number) => {
    if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`
    return `${Math.round(watts)} W`
  },
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { SystemTreePanel } from '../../components/ui/panels/hvac/system-tree-panel'
import { SystemPanel } from '../../components/ui/panels/hvac/system-panel'
import { HvacZonePanel } from '../../components/ui/panels/hvac/hvac-zone-panel'
import { AhuPanel } from '../../components/ui/panels/hvac/ahu-panel'
import { DiffuserPanel } from '../../components/ui/panels/hvac/diffuser-panel'
import { CalcResultPanel } from '../../components/ui/panels/hvac/calc-result-panel'
import { DuctPanel } from '../../components/sidebars/hvac/duct-panel'
import { PipePanel } from '../../components/sidebars/hvac/pipe-panel'
import { getPresetNodes, filterNodesByType } from './helpers/preset-fixtures'

const stage4Nodes = getPresetNodes(4)

function setupScene(nodes = stage4Nodes) {
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

describe('UI統合テスト: 全フェーズ横断データ整合性 (Stage 4)', () => {
  it('テスト1: ゾーン冷房負荷合算がSystemNodeのaggregatedLoad.totalCoolingLoadと一致', () => {
    // 【テスト目的】: ゾーンレベルの負荷合算値と系統集約値のデータ整合性を検証
    const systems = filterNodesByType(stage4Nodes, 'system')
    const zones = filterNodesByType(stage4Nodes, 'hvac_zone')

    for (const sys of systems) {
      if (!sys.aggregatedLoad) continue

      // 系統に所属するゾーンの冷房負荷を合算
      const servedZones = zones.filter((z: any) => sys.servedZoneIds.includes(z.id))
      const expectedCooling = servedZones.reduce(
        (sum: number, z: any) => sum + (z.calcResult?.coolingLoad || 0),
        0,
      )

      // 系統集約値と一致（浮動小数点誤差考慮）
      expect(Math.abs(sys.aggregatedLoad.totalCoolingLoad - expectedCooling)).toBeLessThan(1)
    }
  })

  it('テスト2: 系統のservedZoneIdsの数がSystemTreePanelの子ゾーン数と一致', () => {
    // 【テスト目的】: SystemTreePanel表示のゾーン数が系統データの参照数と整合するか
    render(<SystemTreePanel />)

    const systems = filterNodesByType(stage4Nodes, 'system')
    const zones = filterNodesByType(stage4Nodes, 'hvac_zone')

    // 各系統の参照ゾーンが全てツリーに表示される
    for (const sys of systems) {
      for (const zoneId of sys.servedZoneIds) {
        const zone = stage4Nodes[zoneId]
        if (zone && zone.zoneName) {
          expect(screen.getByText(zone.zoneName)).toBeDefined()
        }
      }
    }
  })

  it('テスト3: AHUポートのconnectedSegmentIdが実在するダクトセグメントIDである', () => {
    // 【テスト目的】: AHUポート接続が壊れていない（参照整合性）ことをデータレベルで検証
    const ahus = filterNodesByType(stage4Nodes, 'ahu')
    const ductIds = new Set(filterNodesByType(stage4Nodes, 'duct_segment').map((d: any) => d.id))
    const pipeIds = new Set(filterNodesByType(stage4Nodes, 'pipe_segment').map((p: any) => p.id))

    for (const ahu of ahus) {
      for (const port of ahu.ports) {
        if (port.connectedSegmentId) {
          // 接続先がダクトまたは配管のいずれかに実在すること
          const exists = ductIds.has(port.connectedSegmentId) || pipeIds.has(port.connectedSegmentId)
          expect(exists).toBe(true)
        }
      }
    }
  })

  it('テスト4: 全HVACノードタイプがそれぞれの対応パネルでエラーなくレンダリング可能', () => {
    // 【テスト目的】: プリセットの全ノードタイプを対応パネルに表示してクラッシュしないことを検証
    const testCases: Array<{ type: string; panel: React.FC }> = [
      { type: 'hvac_zone', panel: HvacZonePanel },
      { type: 'ahu', panel: AhuPanel },
      { type: 'diffuser', panel: DiffuserPanel },
      { type: 'duct_segment', panel: DuctPanel },
      { type: 'pipe_segment', panel: PipePanel },
    ]

    for (const { type, panel: Panel } of testCases) {
      const nodesOfType = filterNodesByType(stage4Nodes, type)
      if (nodesOfType.length === 0) continue

      const targetNode = nodesOfType[0]!
      setupViewer([targetNode.id])

      // エラーなくレンダリングできること
      const { container } = render(<Panel />)
      expect(container).toBeDefined()
      cleanup()
    }
  })

  it('テスト5: ゾーン風量合計と系統のtotalAirflowが整合', () => {
    // 【テスト目的】: ゾーンの必要風量合計が系統のtotalAirflowと一致することを検証
    const systems = filterNodesByType(stage4Nodes, 'system')
    const zones = filterNodesByType(stage4Nodes, 'hvac_zone')

    for (const sys of systems) {
      if (!sys.aggregatedLoad) continue

      const servedZones = zones.filter((z: any) => sys.servedZoneIds.includes(z.id))
      const expectedAirflow = servedZones.reduce(
        (sum: number, z: any) => sum + (z.calcResult?.requiredAirflow || 0),
        0,
      )

      // 風量合計が整合（浮動小数点誤差考慮）
      expect(Math.abs(sys.aggregatedLoad.totalAirflow - expectedAirflow)).toBeLessThan(1)
    }
  })
})
