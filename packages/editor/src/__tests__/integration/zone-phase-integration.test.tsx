/**
 * UI統合テスト: Zoneフェーズ — プリセットStage 1実データによるパネル表示検証
 *
 * 【テスト目的】: ZoneListPanel, HvacZonePanel, CalcResultPanelがプリセット実データで正しく表示されるか検証
 * 【使用プリセット】: Stage 1 (preset-01-zones.json) — 3ゾーン作成・負荷計算済み
 * 【テストフレームワーク】: Vitest + @testing-library/react (happy-dom)
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
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
import { CalcResultPanel } from '../../components/ui/panels/hvac/calc-result-panel'
import { HvacZonePanel } from '../../components/ui/panels/hvac/hvac-zone-panel'
import { ZoneListPanel } from '../../components/ui/sidebar/panels/zone-list-panel'
import { getPresetNodes, setupSceneMock, setupViewerMock } from './helpers/preset-fixtures'

const stage1Nodes = getPresetNodes(1)

beforeEach(() => {
  setupSceneMock(vi.mocked(useScene), stage1Nodes)
  setupViewerMock(vi.mocked(useViewer), ['hvac_zone_p01'])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UI統合テスト: Zoneフェーズ (Stage 1)', () => {
  it('テスト1: ZoneListPanelに3ゾーン一覧表示（1F事務室, 1F会議室, 2Fサーバー室）', () => {
    // 【テスト目的】: プリセット実データの3ゾーンがZoneListPanelに正しく一覧表示されるか
    render(<ZoneListPanel />)

    expect(screen.getByText('1F 事務室')).toBeDefined()
    expect(screen.getByText('1F 会議室')).toBeDefined()
    expect(screen.getByText('2F サーバー室')).toBeDefined()
  })

  it('テスト2: HvacZonePanelが「1F 事務室」のfloorArea=100.0, ceilingHeight=2.7を表示', () => {
    // 【テスト目的】: プリセットのゾーン基本情報が正しく表示されるか
    render(<HvacZonePanel />)

    // ゾーン名は入力フィールド
    expect(screen.getByDisplayValue('1F 事務室')).toBeDefined()
    // 床面積はテキスト表示（100.0 m²）
    expect(screen.getByText('100.0')).toBeDefined()
    // 天井高は入力フィールド
    expect(screen.getByDisplayValue('2.7')).toBeDefined()
  })

  it('テスト3: CalcResultPanelが冷房負荷18.5kW, 暖房負荷9.2kWをフォーマット表示', () => {
    // 【テスト目的】: プリセットの計算結果がkWフォーマットで正しく表示されるか
    // hvac_zone_p01: coolingLoad=18500, heatingLoad=9200
    render(<CalcResultPanel />)

    expect(screen.getByText('18.5 kW')).toBeDefined()
    expect(screen.getByText('9.2 kW')).toBeDefined()
  })

  it('テスト4: CalcResultPanelが外皮負荷内訳（S面, W面）を表示', () => {
    // 【テスト目的】: 方位別外皮負荷の内訳がテーブルに表示されるか
    // hvac_zone_p01: perimeterLoadBreakdown = [{S, 4200W}, {W, 2300W}]
    render(<CalcResultPanel />)

    expect(screen.getByText('S')).toBeDefined()
    expect(screen.getByText('W')).toBeDefined()
    // 外皮負荷の方位ヘッダーが存在すること
    expect(screen.getByText('方位')).toBeDefined()
  })

  it('テスト5: 会議室ゾーン選択で用途「conference」が表示される', () => {
    // 【テスト目的】: 会議室ゾーンの用途ラベルが正しく表示されるか
    setupViewerMock(vi.mocked(useViewer), ['hvac_zone_p02'])

    render(<HvacZonePanel />)

    expect(screen.getByDisplayValue('1F 会議室')).toBeDefined()
    // conferenceは「会議室」ラベルとして表示される
    expect(screen.getByText('会議室')).toBeDefined()
  })

  it('テスト6: サーバー室の設計条件が冷房24℃/暖房18℃で表示される', () => {
    // 【テスト目的】: サーバー室ゾーンの特殊な設計条件値が正しく表示されるか
    // hvac_zone_p03: coolingSetpoint=24, heatingSetpoint=18
    setupViewerMock(vi.mocked(useViewer), ['hvac_zone_p03'])

    render(<HvacZonePanel />)

    expect(screen.getByDisplayValue('2F サーバー室')).toBeDefined()
    expect(screen.getByDisplayValue('24')).toBeDefined()
    expect(screen.getByDisplayValue('18')).toBeDefined()
  })
})
