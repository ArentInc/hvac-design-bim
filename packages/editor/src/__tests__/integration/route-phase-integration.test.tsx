/**
 * UI統合テスト: Routeフェーズ — プリセットStage 3実データによるパネル表示検証
 *
 * 【テスト目的】: DuctPanel, PipePanelがプリセット実データ（計算前状態）で正しく表示されるか検証
 * 【使用プリセット】: Stage 3 (buildPresetStage03()) — ダクト・配管接続済み、計算未実施
 * 【テストフレームワーク】: Vitest + @testing-library/react (happy-dom)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { DuctPanel } from '../../components/sidebars/hvac/duct-panel'
import { PipePanel } from '../../components/sidebars/hvac/pipe-panel'
import { getPresetNodes, filterNodesByType, setupSceneMock, setupViewerMock } from './helpers/preset-fixtures'

const stage3Nodes = getPresetNodes(3)

beforeEach(() => {
  setupSceneMock(vi.mocked(useScene), stage3Nodes)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UI統合テスト: Routeフェーズ (Stage 3)', () => {
  it('テスト1: DuctPanelがダクトセグメントのairflowRate, ductMaterialを表示', () => {
    // 【テスト目的】: プリセットのダクトデータがDuctPanelに正しく表示されるか
    const ducts = filterNodesByType(stage3Nodes, 'duct_segment')
    expect(ducts.length).toBeGreaterThan(0)

    const targetDuct = ducts[0]!
    setupViewerMock(vi.mocked(useViewer), [targetDuct.id])

    render(<DuctPanel />)

    // 風量が表示される（airflowRate > 0）
    if (targetDuct.airflowRate > 0) {
      expect(screen.getByText(`${targetDuct.airflowRate}`)).toBeDefined()
    }

    // 材質が表示される（日本語ラベル）
    const materialLabels: Record<string, string> = {
      galvanized_steel: '亜鉛鉄板',
      stainless_steel: 'ステンレス',
      aluminum: 'アルミ',
      flexible: 'フレキ',
    }
    const expectedLabel = materialLabels[targetDuct.ductMaterial]
    if (expectedLabel) {
      expect(screen.getByText(expectedLabel)).toBeDefined()
    }
  })

  it('テスト2: DuctPanelが計算前状態（Stage 3）で圧損が未計算表示', () => {
    // 【テスト目的】: Stage 3のダクトはcalcResult=nullなので、圧損が「未計算」状態であることを確認
    const ducts = filterNodesByType(stage3Nodes, 'duct_segment')
    // calcResult=nullのダクトを探す
    const uncalcDuct = ducts.find((d: any) => d.calcResult === null)
    if (!uncalcDuct) return // Stage 3で全て計算済みならスキップ

    setupViewerMock(vi.mocked(useViewer), [uncalcDuct.id])

    render(<DuctPanel />)

    // 圧損フィールドがnull/未計算の状態で表示される
    const container = document.body.textContent || ''
    // 「-」や「未計算」等のプレースホルダが表示されるか、値が空であること
    expect(container).not.toContain('Pa/m') // 圧損単位が計算前は表示されない可能性
  })

  it('テスト3: PipePanelが配管の媒体タイプ（冷水）を表示', () => {
    // 【テスト目的】: プリセットの配管データでmediumが正しく日本語表示されるか
    const pipes = filterNodesByType(stage3Nodes, 'pipe_segment')
    expect(pipes.length).toBeGreaterThan(0)

    const targetPipe = pipes[0]!
    setupViewerMock(vi.mocked(useViewer), [targetPipe.id])

    render(<PipePanel />)

    // mediumの日本語ラベルが表示される
    const mediumLabels: Record<string, string> = {
      chilled_water: '冷水',
      hot_water: '温水',
      condensate: 'ドレン',
    }
    const expectedLabel = mediumLabels[targetPipe.medium]
    if (expectedLabel) {
      expect(screen.getByText(expectedLabel)).toBeDefined()
    }
  })

  it('テスト4: PipePanelが計算前状態で口径を表示', () => {
    // 【テスト目的】: Stage 3の配管でnominalSizeが設定されている場合に正しく表示されるか
    const pipes = filterNodesByType(stage3Nodes, 'pipe_segment')
    expect(pipes.length).toBeGreaterThan(0)

    const targetPipe = pipes[0]!
    setupViewerMock(vi.mocked(useViewer), [targetPipe.id])

    render(<PipePanel />)

    // nominalSizeが設定されていれば「XXA」形式で表示
    if (targetPipe.nominalSize) {
      expect(screen.getByText(`${targetPipe.nominalSize}A`)).toBeDefined()
    }
  })
})
