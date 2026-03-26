/**
 * TASK-0013: ZoneDrawTool — ゾーン境界描画ツール 確定ロジックテスト
 *
 * 【テスト対象】: ZoneDrawTool の confirmZone ロジック
 *   - calculatePolygonArea（../polygon-area からインポート）
 *   - EDGE-001: 面積0以下の確定拒否
 *   - boundary 座標変換（XZ → XY 平面）
 *
 * 【設計方針】: @pascal-app/core や Three.js への依存を避け、純粋なロジックのみをテストする。
 *              HvacZoneNode.parse は vi.fn() で完全にモック化し、
 *              ノード生成の結果ではなく「正しい引数で呼ばれること」を検証する。
 * 🔵 信頼性レベル: TASK-0013 要件定義セクション7（テスト対象の分離）に明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculatePolygonArea } from '../polygon-area'

// --- Mocks ---

const mockCreateNode = vi.fn()
const mockGetLevelId = vi.fn(() => 'level_abc123')

/**
 * 【モック設計】: HvacZoneNode.parse を vi.fn() でモック化する。
 * @pascal-app/core 全体をインポートすると three-mesh-bvh の循環依存が発生するため、
 * editor パッケージのテストでは HvacZoneNode を直接モックとして定義する。
 * 🟡 信頼性レベル: three-mesh-bvh 循環依存の制約から、この設計パターンを採用
 */
const mockHvacZoneNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: 'hvac_zone_mock123',
  type: 'hvac_zone',
  object: 'node',
  parentId: null,
  visible: true,
  ...input,
}))

const HvacZoneNodeMock = {
  parse: mockHvacZoneNodeParse,
}

describe('TASK-0013: ZoneDrawTool 確定ロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * 【ヘルパー関数】: confirmZone ロジックのユニットテスト用インライン実装
   * 【単一責任】: 実際のコンポーネントではなく、確定処理の純粋ロジックをテストする
   * 【再利用性】: 各テストケースで共通して使用する確定処理ロジックを集約
   * 🔵 信頼性レベル: TASK-0013 要件定義セクション7のロジック仕様に準拠
   */
  function confirmZone(vertices: { x: number; y: number }[]) {
    // 【入力検証】: 頂点数不足の場合は早期リターン（ポリゴン未完成）
    if (vertices.length < 3) return false

    // 【面積算出】: Shoelace formula で面積を計算
    const floorArea = calculatePolygonArea(vertices)

    // 【EDGE-001】: 面積0以下（コリニアや縮退ポリゴン）は確定を拒否
    if (floorArea <= 0) return false

    // 【座標変換】: ツール内部座標 {x, y} → HvacZoneNode boundary [x, y][] 形式
    const boundary: [number, number][] = vertices.map((v) => [v.x, v.y])

    // 【ノード生成】: HvacZoneNode.parse でスキーマ検証済みノードを生成
    const node = HvacZoneNodeMock.parse({
      zoneName: 'HVACゾーン',
      boundary,
      floorArea,
      usage: 'office_general',
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
    })

    // 【シーン登録】: createNode でシーンストアに追加（levelId に紐づけ）
    const levelId = mockGetLevelId()
    mockCreateNode(node, levelId)
    return true
  }

  it('テスト5: 有効な4頂点 → HvacZoneNode.parse + createNode 呼び出し', () => {
    // 【テスト目的】: 正常フローで parse と createNode が正しく呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0013 要件定義セクション4.1に明示
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]

    const result = confirmZone(vertices)

    expect(result).toBe(true)
    expect(mockHvacZoneNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        boundary: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        floorArea: 100,
        usage: 'office_general',
        systemId: null,
        calcResult: null,
      }),
    )
    expect(mockCreateNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hvac_zone' }),
      'level_abc123',
    )
  })

  it('テスト6: 頂点2つ（不足） → 確定拒否、createNode呼ばれない', () => {
    // 【テスト目的】: 頂点不足（< 3）の場合の早期リターンを確認
    // 🔵 信頼性レベル: TASK-0013 要件定義セクション4.5「頂点不足」に明示
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]

    const result = confirmZone(vertices)

    expect(result).toBe(false)
    expect(mockCreateNode).not.toHaveBeenCalled()
  })

  it('テスト7: EDGE-001 面積0ポリゴン → 確定拒否', () => {
    // 【テスト目的】: 一直線上の頂点（面積0）の確定拒否を確認（EDGE-001）
    // 🔵 信頼性レベル: TASK-0013 EDGE-001「ゾーン面積が 0 以下の場合、作成を拒否」に明示
    const vertices = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]

    const result = confirmZone(vertices)

    expect(result).toBe(false)
    expect(mockCreateNode).not.toHaveBeenCalled()
  })

  it('テスト8: boundary座標がXY平面に変換されている', () => {
    // 【テスト目的】: vertices {x,y} → boundary [x,y][] の変換を確認
    // 🔵 信頼性レベル: TASK-0013 要件定義「座標変換の注意」に明示
    const vertices = [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 5 },
      { x: 1, y: 5 },
    ]

    confirmZone(vertices)

    expect(mockHvacZoneNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        boundary: [
          [1, 2],
          [3, 2],
          [3, 5],
          [1, 5],
        ],
      }),
    )
  })

  it('テスト9: デフォルト用途は office_general', () => {
    // 【テスト目的】: デフォルト usage が 'office_general' であることを確認（REQ-203）
    // 🔵 信頼性レベル: REQ-203 HvacZoneNode デフォルト値に明示
    const vertices = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ]

    confirmZone(vertices)

    expect(mockHvacZoneNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: 'office_general',
      }),
    )
  })

  it('テスト10: floorArea が Shoelace formula の算出値と一致', () => {
    // 【テスト目的】: parse に渡される floorArea が Shoelace formula の算出値と一致することを確認
    // 🔵 信頼性レベル: REQ-1601「面積リアルタイム表示」、TASK-0013 実装詳細セクション3に明示
    const vertices = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 8 },
      { x: 0, y: 8 },
    ]

    confirmZone(vertices)

    expect(mockHvacZoneNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        floorArea: 48,
      }),
    )
  })

  it('テスト11: 空配列 → 確定拒否', () => {
    // 【テスト目的】: 空配列（描画前）の場合に確定処理を無視することを確認
    // 🔵 信頼性レベル: 頂点不足チェック（length < 3）の一般ケース
    const result = confirmZone([])

    expect(result).toBe(false)
    expect(mockCreateNode).not.toHaveBeenCalled()
  })
})
