import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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
import { HvacZonePanel } from '../hvac-zone-panel'

// 【テストデータ定義】: 標準的なHvacZoneNodeのモックデータ
// 【データ理由】: requirements.mdの型定義に準拠した最小構成のテストノード
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
  perimeterSegments: [
    { orientation: 'S' as const, wallArea: 27.0, glazingRatio: 0.3 },
    { orientation: 'E' as const, wallArea: 27.0, glazingRatio: 0.2 },
  ],
  systemId: null,
  calcResult: null,
  parentId: null,
  children: [],
}

const mockUpdateNode = vi.fn()

beforeEach(() => {
  // 【テスト前準備】: デフォルトのモック状態を設定（HvacZoneノードが選択済み）
  // 【環境初期化】: 各テストで独立したモック状態を保証する
  vi.mocked(useViewer).mockImplementation((selector) => {
    const state = { selectedIds: ['hvac_zone_001'] }
    return selector ? selector(state as any) : state
  })
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = {
      nodes: { hvac_zone_001: mockHvacZoneNode },
      updateNode: mockUpdateNode,
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

describe('TASK-0016: HvacZonePanel', () => {
  it('テスト1: ゾーン基本情報が正しく表示される', () => {
    // 【テスト目的】: zoneName, usage, floorArea, ceilingHeight, occupantDensityが表示されることを確認
    // 【テスト内容】: REQ-203「HvacZoneNodeはゾーン名、用途、面積、天井高、在室密度を保持」の表示確認
    // 【期待される動作】: 各フィールドがパネルに表示される
    // 🔵 信頼性レベル: TASK-0016.md テスト1、requirements.md 2.1に明示

    // 【実際の処理実行】: HvacZonePanelをレンダリング
    render(<HvacZonePanel />)

    // 【結果検証】: ゾーン名が表示されていること
    expect(screen.getByDisplayValue('オフィスA')).toBeDefined() // 【確認内容】: zoneName入力フィールドに正しい値が設定 🔵

    // 【結果検証】: 床面積が表示されていること（読み取り専用）
    expect(screen.getByText('100.0')).toBeDefined() // 【確認内容】: floorAreaが小数点1桁で表示 🔵

    // 【結果検証】: 天井高が表示されていること
    expect(screen.getByDisplayValue('2.7')).toBeDefined() // 【確認内容】: ceilingHeight入力フィールドの値確認 🔵
  })

  it('テスト2: 用途selectに全5種類のオプションが存在する', () => {
    // 【テスト目的】: ZoneUsage列挙の全種類がselectオプションとして存在することを確認
    // 【テスト内容】: REQ-203の用途フィールド（5種類）の選択肢確認
    // 【期待される動作】: office_general/office_server/conference/reception/corridorの5オプションが存在
    // 🔵 信頼性レベル: requirements.md 2.1のZoneUsage定義、hvac-shared.tsのenum定義に明示

    render(<HvacZonePanel />)

    // 【結果検証】: 各用途オプションが存在することを確認
    expect(screen.getByText('一般オフィス')).toBeDefined() // 【確認内容】: office_generalのラベルが存在 🔵
    expect(screen.getByText('会議室')).toBeDefined() // 【確認内容】: conferenceのラベルが存在 🔵
    expect(screen.getByText('受付/ロビー')).toBeDefined() // 【確認内容】: receptionのラベルが存在 🔵
    expect(screen.getByText('サーバー室')).toBeDefined() // 【確認内容】: office_serverのラベルが存在 🔵
    expect(screen.getByText('廊下')).toBeDefined() // 【確認内容】: corridorのラベルが存在 🔵
  })

  it('テスト3: 用途変更でupdateNodeが呼ばれる', () => {
    // 【テスト目的】: usage変更時にupdateNode(id, {usage: 'conference'})が呼ばれることを確認
    // 【テスト内容】: TASK-0016.md テスト2「用途変更時のupdateNode呼び出し」
    // 【期待される動作】: selectを変更するとuseScene.updateNodeが正しい引数で呼ばれる
    // 🔵 信頼性レベル: TASK-0016.md テスト2に明示

    render(<HvacZonePanel />)

    // 【実際の処理実行】: usageセレクトを変更する
    // 【処理内容】: selectフィールドのchange イベントをトリガー
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'conference' } })

    // 【結果検証】: updateNodeが正しい引数で呼ばれたこと
    expect(mockUpdateNode).toHaveBeenCalledWith('hvac_zone_001', { usage: 'conference' }) // 【確認内容】: updateNodeにid と usageが渡されること 🔵
  })

  it('テスト4: ゾーン名変更でupdateNodeが呼ばれる', () => {
    // 【テスト目的】: zoneName変更時にupdateNodeが正しく呼ばれることを確認
    // 【テスト内容】: REQ-203の編集可能フィールド「ゾーン名」の変更ハンドリング確認
    // 【期待される動作】: input変更するとupdateNode(id, {zoneName: '...'})が呼ばれる
    // 🔵 信頼性レベル: requirements.md 2.1、TASK-0016.md 実装詳細に明示

    render(<HvacZonePanel />)

    // 【実際の処理実行】: zoneName入力を変更する
    const input = screen.getByDisplayValue('オフィスA')
    fireEvent.change(input, { target: { value: 'サーバー室B' } })

    // 【結果検証】: updateNodeが正しい引数で呼ばれたこと
    expect(mockUpdateNode).toHaveBeenCalledWith('hvac_zone_001', { zoneName: 'サーバー室B' }) // 【確認内容】: zoneName変更がupdateNodeに反映されること 🔵
  })

  it('テスト5: 設計条件（冷房設定温度）が表示される', () => {
    // 【テスト目的】: designConditions.coolingSetpointが入力フィールドに表示されることを確認
    // 【テスト内容】: REQ-204「HvacZoneNodeは設計条件を保持」の表示確認
    // 【期待される動作】: 冷房設定温度26°Cがフィールドに表示される
    // 🔵 信頼性レベル: requirements.md 2.1のdesignConditions定義に明示

    render(<HvacZonePanel />)

    // 【結果検証】: 冷房設定温度が表示されていること
    expect(screen.getByDisplayValue('26')).toBeDefined() // 【確認内容】: coolingSetpoint=26が入力フィールドに表示 🔵
  })

  it('テスト6: 設計条件（暖房設定温度）変更でupdateNodeが呼ばれる', () => {
    // 【テスト目的】: designConditions.heatingSetpoint変更でupdateNodeが呼ばれることを確認
    // 【テスト内容】: REQ-204の設計条件編集操作のハンドリング確認
    // 【期待される動作】: 暖房設定温度を変更するとupdateNode(id, {designConditions: {...}})が呼ばれる
    // 🔵 信頼性レベル: requirements.md 2.1のdesignConditions定義に明示

    render(<HvacZonePanel />)

    // 【実際の処理実行】: 暖房設定温度のinputを変更する
    // 【処理内容】: 22°Cのフィールドを20°Cに変更
    const heatingInput = screen.getByDisplayValue('22')
    fireEvent.change(heatingInput, { target: { value: '20' } })

    // 【結果検証】: updateNodeがdesignConditionsを正しく更新すること
    expect(mockUpdateNode).toHaveBeenCalledWith('hvac_zone_001', {
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 20,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
    }) // 【確認内容】: designConditionsが既存値を保持しつつheatingSetpointのみ更新 🔵
  })

  it('テスト7: perimeterSegments一覧がテーブル表示される', () => {
    // 【テスト目的】: perimeterSegmentsが方位・壁面積・ガラス面積比でテーブル表示されることを確認
    // 【テスト内容】: REQ-205「HvacZoneNodeはペリメータセグメントの配列を保持」の表示確認
    // 【期待される動作】: 各セグメントが方位・壁面積・ガラス面積比のテーブル行で表示される
    // 🔵 信頼性レベル: requirements.md 2.2、TASK-0016.md 実装詳細4に明示

    render(<HvacZonePanel />)

    // 【結果検証】: テーブルヘッダーが表示されていること
    expect(screen.getByText('方位')).toBeDefined() // 【確認内容】: 方位ヘッダーが存在 🔵
    expect(screen.getByText('壁面積 (m²)')).toBeDefined() // 【確認内容】: 壁面積ヘッダーが存在 🔵
    expect(screen.getByText('ガラス面積比')).toBeDefined() // 【確認内容】: ガラス面積比ヘッダーが存在 🔵

    // 【結果検証】: セグメントデータが表示されていること
    expect(screen.getByText('S')).toBeDefined() // 【確認内容】: 南方位セグメントが行表示 🔵
    // 【修正】: モックデータでS/E両方のwallAreaが27.0のため getAllByText を使用（意図は同じ）
    expect(screen.getAllByText('27.0').length).toBeGreaterThan(0) // 【確認内容】: 壁面積27.0m²が表示 🔵
    expect(screen.getByText('30%')).toBeDefined() // 【確認内容】: glazingRatio 0.3 → 30%表示 🔵
  })

  it('テスト8: perimeterSegments空配列時に誘導メッセージ表示', () => {
    // 【テスト目的】: perimeterSegmentsが空配列のとき誘導メッセージが表示されることを確認
    // 【テスト内容】: requirements.md エッジ3「perimeterSegments空配列時のメッセージ」確認
    // 【期待される動作】: 「未設定（PerimeterEditToolで入力してください）」が表示される
    // 🔵 信頼性レベル: requirements.md エッジ3に明示

    // 【テストデータ準備】: perimeterSegmentsが空のノード
    const nodeWithEmptySegments = { ...mockHvacZoneNode, perimeterSegments: [] }
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: { hvac_zone_001: nodeWithEmptySegments },
        updateNode: mockUpdateNode,
      }
      return selector ? selector(state as any) : state
    })

    render(<HvacZonePanel />)

    // 【結果検証】: 誘導メッセージが表示されていること
    expect(screen.getByText('未設定（PerimeterEditToolで入力してください）')).toBeDefined() // 【確認内容】: 外皮未設定時の誘導メッセージが表示 🔵
  })

  it('テスト9: 非HvacZoneノード選択時はnullを返す', () => {
    // 【テスト目的】: type !== 'hvac_zone'のノード選択時にnullが返されることを確認
    // 【テスト内容】: requirements.md エッジ1「非HvacZoneノード選択時の挙動」確認
    // 【期待される動作】: wallノードが選択されている場合、パネルは何も表示しない
    // 🔵 信頼性レベル: requirements.md エッジ1に明示

    // 【テストデータ準備】: wallノードを選択中の状態
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

    const { container } = render(<HvacZonePanel />)

    // 【結果検証】: 何もレンダリングされないこと
    expect(container.firstChild).toBeNull() // 【確認内容】: 非HvacZoneノードでパネルが非表示 🔵
  })

  it('テスト10: selectedIds空配列時はnullを返す', () => {
    // 【テスト目的】: selectedIdsが空配列のとき何も表示されないことを確認
    // 【テスト内容】: requirements.md エッジ4「選択IDなし時の挙動」確認
    // 【期待される動作】: 選択がない場合、パネルは何も表示しない（null返却）
    // 🔵 信頼性レベル: requirements.md エッジ4に明示

    // 【テストデータ準備】: 選択なしの状態
    vi.mocked(useViewer).mockImplementation((selector) => {
      const state = { selectedIds: [] }
      return selector ? selector(state as any) : state
    })

    const { container } = render(<HvacZonePanel />)

    // 【結果検証】: 何もレンダリングされないこと
    expect(container.firstChild).toBeNull() // 【確認内容】: 選択なしでパネルが非表示 🔵
  })

  it('テスト11: 在室密度（occupantDensity）変更でupdateNodeが呼ばれる', () => {
    // 【テスト目的】: occupantDensity変更でupdateNodeが正しく呼ばれることを確認
    // 【テスト内容】: REQ-203の在室密度フィールドの編集ハンドリング確認
    // 【期待される動作】: step=0.01の数値inputで変更するとupdateNode(id, {occupantDensity: value})が呼ばれる
    // 🔵 信頼性レベル: requirements.md 2.1の在室密度定義に明示

    render(<HvacZonePanel />)

    // 【実際の処理実行】: 在室密度のinputを変更する（0.15 → 0.20）
    const densityInput = screen.getByDisplayValue('0.15')
    fireEvent.change(densityInput, { target: { value: '0.20' } })

    // 【結果検証】: updateNodeが呼ばれたこと
    expect(mockUpdateNode).toHaveBeenCalledWith('hvac_zone_001', { occupantDensity: 0.20 }) // 【確認内容】: occupantDensityがupdateNodeに渡されること 🔵
  })
})
