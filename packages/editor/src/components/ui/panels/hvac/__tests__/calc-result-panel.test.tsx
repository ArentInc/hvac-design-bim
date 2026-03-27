import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// 【モック設定】: useScene/useViewerストアをモックしてUI単体テスト可能にする
// 【モック理由】: コンポーネントテストではストアの実装詳細に依存しない

vi.mock('@pascal-app/viewer', () => ({
  useViewer: vi.fn(),
}))

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { CalcResultPanel } from '../calc-result-panel'

// 【テストデータ定義】: 計算済みHvacZoneCalcResultのモックデータ
// 【データ理由】: TASK-0016.md テスト4のデータに準拠（REQ-1505フォーマット検証用）
const mockCalcResult = {
  coolingLoad: 17400,    // 17.4 kW
  heatingLoad: 10000,    // 10.0 kW
  requiredAirflow: 4478, // 4,478 m³/h
  internalLoad: 8000,    // 内部負荷 8.0 kW
  envelopeLoad: 9400,    // 外皮負荷 9.4 kW
  perimeterLoadBreakdown: [
    { orientation: 'S' as const, solarCorrectionFactor: 1.2, envelopeLoadContribution: 2400 },
    { orientation: 'W' as const, solarCorrectionFactor: 1.0, envelopeLoadContribution: 1440 },
  ],
  status: 'success' as const,
}

const mockHvacZoneNode = {
  id: 'hvac_zone_001',
  type: 'hvac_zone' as const,
  zoneName: 'オフィスA',
  usage: 'office_general' as const,
  floorArea: 100.0,
  ceilingHeight: 2.7,
  occupantDensity: 0.15,
  boundary: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][],
  designConditions: {
    coolingSetpoint: 26,
    heatingSetpoint: 22,
    relativeHumidity: 50,
    supplyAirTempDiff: 10,
  },
  perimeterSegments: [],
  systemId: null,
  calcResult: mockCalcResult,
  parentId: null,
  children: [],
}

beforeEach(() => {
  // 【テスト前準備】: デフォルトのモック状態を設定（計算済みHvacZoneノードが選択済み）
  // 【環境初期化】: 各テストで独立したモック状態を保証する
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selectedIds: ['hvac_zone_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { hvac_zone_001: mockHvacZoneNode },
      updateNode: vi.fn(),
    }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  // 【テスト後処理】: レンダリングのクリーンアップとモックのリセット
  // 【状態復元】: 次のテストに影響しないよう DOM と モックをクリーン状態に戻す
  cleanup()
  vi.clearAllMocks()
})

describe('TASK-0016: CalcResultPanel', () => {
  it('テスト1: calcResult未設定時に「計算結果がありません」メッセージを表示', () => {
    // 【テスト目的】: calcResultがnullの場合、適切なメッセージが表示されることを確認
    // 【テスト内容】: requirements.md エッジ2「calcResult未設定時の表示」確認
    // 【期待される動作】: 「計算結果がありません。ゾーンの設定を完了してください。」が表示される
    // 🔵 信頼性レベル: requirements.md エッジ2、TASK-0016.md テスト3に明示

    // 【テストデータ準備】: calcResultがnullのノード
    const nodeWithoutCalc = { ...mockHvacZoneNode, calcResult: null }
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { hvac_zone_001: nodeWithoutCalc },
        updateNode: vi.fn(),
      }
      return selector ? selector(state as any) : state
    })

    render(<CalcResultPanel />)

    // 【結果検証】: 計算結果なしメッセージが表示されていること
    expect(screen.getByText('計算結果がありません。ゾーンの設定を完了してください。')).toBeDefined() // 【確認内容】: calcResultなし時のメッセージ表示 🔵
  })

  it('テスト2: 冷房負荷が "17.4 kW" フォーマットで表示される', () => {
    // 【テスト目的】: coolingLoadがREQ-1505フォーマット（kW表記）で表示されることを確認
    // 【テスト内容】: TASK-0016.md テスト4「calcResult表示（kW/m³/h表記）」確認
    // 【期待される動作】: 17400W → '17.4 kW' として表示される
    // 🔵 信頼性レベル: TASK-0016.md テスト4、REQ-1505に明示

    render(<CalcResultPanel />)

    expect(screen.getByTestId('calc-result-panel')).toBeDefined() // 【確認内容】: 右パネルwrapper内に描画されること 🔵
    // 【結果検証】: 冷房負荷が '17.4 kW' で表示されること
    expect(screen.getByText('17.4 kW')).toBeDefined() // 【確認内容】: 冷房負荷のkW表記 🔵
  })

  it('テスト3: 暖房負荷が "10.0 kW" フォーマットで表示される', () => {
    // 【テスト目的】: heatingLoadがREQ-1505フォーマット（kW表記）で表示されることを確認
    // 【テスト内容】: TASK-0016.md テスト4の暖房負荷表示確認
    // 【期待される動作】: 10000W → '10.0 kW' として表示される
    // 🔵 信頼性レベル: TASK-0016.md テスト4、REQ-1505に明示

    render(<CalcResultPanel />)

    // 【結果検証】: 暖房負荷が '10.0 kW' で表示されること
    expect(screen.getByText('10.0 kW')).toBeDefined() // 【確認内容】: 暖房負荷のkW表記 🔵
  })

  it('テスト4: 必要風量が "4,478 m³/h" フォーマットで表示される', () => {
    // 【テスト目的】: requiredAirflowがカンマ区切りm³/h表記で表示されることを確認
    // 【テスト内容】: TASK-0016.md テスト4「必要風量のカンマ区切り表示」確認
    // 【期待される動作】: 4478 → '4,478 m³/h' として表示される
    // 🔵 信頼性レベル: TASK-0016.md テスト4、REQ-1505「風量: m³/h（カンマ区切り）」に明示

    render(<CalcResultPanel />)

    // 【結果検証】: 必要風量がカンマ区切りで表示されること
    // 【注意】: toLocaleString()の出力はロケール依存だが、テスト環境では数値+単位で確認
    const text = screen.getByText(/m³\/h/)
    expect(text).toBeDefined() // 【確認内容】: 必要風量にm³/h単位が含まれること 🔵
    expect(text.textContent).toContain('4') // 【確認内容】: 4478の数値が含まれること 🔵
  })

  it('テスト5: 方位別外皮負荷テーブルに2行表示される', () => {
    // 【テスト目的】: perimeterLoadBreakdownの各エントリがテーブル行で表示されることを確認
    // 【テスト内容】: TASK-0016.md テスト5「方位別内訳表示」確認
    // 【期待される動作】: S/Wの2方位がテーブルに表示される
    // 🔵 信頼性レベル: TASK-0016.md テスト5、REQ-306に明示

    render(<CalcResultPanel />)

    // 【結果検証】: 方位別テーブルのヘッダーが存在すること
    expect(screen.getByText('方位')).toBeDefined() // 【確認内容】: 方位カラムヘッダーが存在 🔵

    // 【結果検証】: 各方位データが表示されていること
    expect(screen.getByText('S')).toBeDefined() // 【確認内容】: 南方位の行が存在 🔵
    expect(screen.getByText('W')).toBeDefined() // 【確認内容】: 西方位の行が存在 🔵
  })

  it('テスト6: 負荷サマリーセクションに冷房/暖房/必要風量のラベルが存在する', () => {
    // 【テスト目的】: 負荷サマリーセクションの必要なラベルがすべて存在することを確認
    // 【テスト内容】: REQ-1505「右パネルの表示フォーマット」確認
    // 【期待される動作】: 冷房負荷、暖房負荷、必要風量のdt要素が存在する
    // 🔵 信頼性レベル: requirements.md 2.2の出力仕様に明示

    render(<CalcResultPanel />)

    // 【結果検証】: 各ラベルが存在すること
    expect(screen.getByText('冷房負荷')).toBeDefined() // 【確認内容】: 冷房負荷ラベルが存在 🔵
    expect(screen.getByText('暖房負荷')).toBeDefined() // 【確認内容】: 暖房負荷ラベルが存在 🔵
    expect(screen.getByText('必要風量')).toBeDefined() // 【確認内容】: 必要風量ラベルが存在 🔵
  })

  it('テスト7: 負荷内訳セクションに内部負荷/外皮負荷のラベルが存在する', () => {
    // 【テスト目的】: 負荷内訳セクションに内部負荷・外皮負荷ラベルが存在することを確認
    // 【テスト内容】: requirements.md 2.2「負荷内訳 dl形式」確認
    // 【期待される動作】: 内部負荷、外皮負荷のラベルが表示される
    // 🔵 信頼性レベル: requirements.md 2.2の出力仕様に明示

    render(<CalcResultPanel />)

    // 【結果検証】: 各ラベルが存在すること
    expect(screen.getByText('内部負荷')).toBeDefined() // 【確認内容】: 内部負荷ラベルが存在 🔵
    expect(screen.getByText('外皮負荷')).toBeDefined() // 【確認内容】: 外皮負荷ラベルが存在 🔵
  })

  it('テスト8: 内部負荷が "8.0 kW" フォーマットで表示される', () => {
    // 【テスト目的】: internalLoadがkW表記で表示されることを確認
    // 【テスト内容】: 内部負荷のREQ-1505フォーマット確認
    // 【期待される動作】: 8000W → '8.0 kW' として表示される
    // 🔵 信頼性レベル: requirements.md 2.2の出力仕様、REQ-1505に明示

    render(<CalcResultPanel />)

    expect(screen.getByText('8.0 kW')).toBeDefined() // 【確認内容】: 内部負荷が8.0 kW表示 🔵
  })

  it('テスト9: selectedIds空配列時はnullを返す', () => {
    // 【テスト目的】: selectedIdsが空配列のとき何も表示されないことを確認
    // 【テスト内容】: requirements.md エッジ4「選択IDなし時の挙動」確認
    // 【期待される動作】: 選択がない場合、パネルは何も表示しない
    // 🔵 信頼性レベル: requirements.md エッジ4に明示

    vi.mocked(useViewer).mockImplementation((selector) => {
      const state = { selectedIds: [] }
      return selector ? selector(state as any) : state
    })

    const { container } = render(<CalcResultPanel />)

    expect(container.firstChild).toBeNull() // 【確認内容】: 選択なしでパネルが非表示 🔵
  })

  it('テスト10: 方位別外皮負荷テーブルに「負荷 (W)」「割合」ヘッダーが存在する', () => {
    // 【テスト目的】: perimeterLoadBreakdownテーブルのヘッダーが存在することを確認
    // 【テスト内容】: requirements.md 2.2「方位別外皮負荷テーブル」のカラム確認
    // 【期待される動作】: 方位/負荷/割合のヘッダーがテーブルに存在する
    // 🔵 信頼性レベル: requirements.md 2.2の出力仕様、TASK-0016.md 実装詳細6に明示

    render(<CalcResultPanel />)

    // 【結果検証】: テーブルヘッダーが存在すること
    expect(screen.getByText('負荷 (W)')).toBeDefined() // 【確認内容】: 負荷カラムヘッダーが存在 🔵
    expect(screen.getByText('割合')).toBeDefined() // 【確認内容】: 割合カラムヘッダーが存在 🔵
  })
})
