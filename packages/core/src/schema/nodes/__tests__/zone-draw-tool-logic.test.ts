/**
 * TASK-0013: ZoneDrawTool — ゾーン境界描画ツール
 * Redフェーズ: ゾーン描画ツールロジックのテスト
 *
 * テスト対象:
 *   - packages/core/src/utils/polygon-area.ts (未実装) の calculatePolygonArea
 *   - packages/core/src/schema/nodes/hvac-zone.ts の HvacZoneNode.parse (既存)
 *   - confirmZone ロジック (TASK-0013 確定処理)
 *
 * 信頼性レベルの凡例:
 *   🔵 青信号: 元の資料を参考にしてほぼ推測していない
 *   🟡 黄信号: 元の資料から妥当な推測
 *   🔴 赤信号: 元の資料にない推測
 */

import { describe, expect, it, vi } from 'vitest'
import { calculatePolygonArea } from '../../../utils/polygon-area'
import { HvacZoneNode } from '../hvac-zone'

// ─── テスト用定数 ────────────────────────────────────────────────

/** 有効な矩形ゾーン頂点（10m×10m、面積100m²） */
const VALID_SQUARE_VERTICES = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

/** 有効な矩形ゾーン boundary（HvacZoneNode 入力形式 [x, y][]） */
const VALID_SQUARE_BOUNDARY: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

/** 一直線上の3頂点（面積0 → EDGE-001 拒否対象） */
const COLLINEAR_VERTICES = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 10, y: 0 },
]

// ─── テスト1〜3: 座標変換（XZ平面 → XY平面）────────────────────

describe('ZoneDrawTool: 座標変換ロジック', () => {
  it('テスト1: グリッドイベント座標（XZ平面）をHvacZoneNode境界座標（XY平面）に変換できること', () => {
    // 【テスト目的】: Three.js のXZ平面座標を HvacZoneNode の XY boundary に変換する
    // 【テスト内容】: イベント座標 {x, z} を boundary 座標 [x, y] = [x, z] に変換する
    // 【期待される動作】: e.point.x → boundary[0], e.point.z → boundary[1]
    // 🔵 信頼性レベル: TASK-0013「座標変換の注意」に明示（XZ→XY変換）

    // 【テストデータ準備】: グリッドポインタイベントの模擬座標（Three.js XZ平面）
    const gridEventPoints = [
      { x: 0, y: 0.001, z: 0 }, // y は高さ（ほぼ0）、x/z が水平座標
      { x: 10, y: 0.001, z: 0 },
      { x: 10, y: 0.001, z: 10 },
      { x: 0, y: 0.001, z: 10 },
    ]

    // 【実際の処理実行】: XZ平面 → XY平面への変換
    // 変換ロジック: { x: event.point.x, y: event.point.z }
    const boundary: [number, number][] = gridEventPoints.map(
      (pt) => [pt.x, pt.z] as [number, number],
    )

    // 【結果検証】: boundary が正しく変換されていることを確認
    expect(boundary).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]) // 【確認内容】: XZ→XY変換後の boundary が期待通り
  })

  it('テスト2: 変換後の頂点列で calculatePolygonArea を呼び出せること', () => {
    // 【テスト目的】: XZ→XY変換後の頂点で面積算出が正しく動作することを確認
    // 【テスト内容】: グリッドイベント座標を変換してからShoelace formulaで面積算出
    // 【期待される動作】: 100.0 m² が返却される
    // 🔵 信頼性レベル: TASK-0013 データフロー（グリッドイベント→面積算出）に明示

    // 【テストデータ準備】: グリッドイベント座標（Three.js XZ平面、10m×10mゾーン）
    const gridEventPoints = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 10 },
    ]

    // 【実際の処理実行】: XZ→XY変換 → 面積算出
    const vertices = gridEventPoints.map((pt) => ({ x: pt.x, y: pt.z }))
    const area = calculatePolygonArea(vertices)

    // 【結果検証】: 面積が 100.0 m² であることを確認
    expect(area).toBeCloseTo(100.0, 5) // 【確認内容】: XZ→XY変換後の面積算出が正しい
  })
})

// ─── テスト3〜5: HvacZoneNode.parse 確定処理 ─────────────────────

describe('ZoneDrawTool: HvacZoneNode.parse による確定処理', () => {
  it('テスト3: 有効な境界で HvacZoneNode.parse が成功すること', () => {
    // 【テスト目的】: 確定処理で HvacZoneNode.parse が正しいパラメータで動作することを確認
    // 【テスト内容】: 有効な boundary・floorArea・usage を渡してパースする
    // 【期待される動作】: 正常にパースされ、type='hvac_zone' のノードが返る
    // 🔵 信頼性レベル: TASK-0013 単体テスト要件「テスト5」に明示

    // 【テストデータ準備】: 有効な確定処理パラメータ
    const floorArea = calculatePolygonArea(VALID_SQUARE_VERTICES)
    const input = {
      zoneName: 'HvacZone 1',
      boundary: VALID_SQUARE_BOUNDARY,
      floorArea,
      usage: 'office_general' as const,
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
    }

    // 【実際の処理実行】: HvacZoneNode.parse によるノード生成
    const result = HvacZoneNode.parse(input)

    // 【結果検証】: パースが成功し、正しいフィールドが設定されていることを確認
    expect(result.type).toBe('hvac_zone') // 【確認内容】: type フィールドが 'hvac_zone'
    expect(result.zoneName).toBe('HvacZone 1') // 【確認内容】: zoneName が正しく設定
    expect(result.floorArea).toBeCloseTo(100.0, 5) // 【確認内容】: floorArea が Shoelace 算出値
    expect(result.usage).toBe('office_general') // 【確認内容】: usage がデフォルト値
    expect(result.boundary).toEqual(VALID_SQUARE_BOUNDARY) // 【確認内容】: boundary が正しく格納
    expect(result.perimeterSegments).toEqual([]) // 【確認内容】: perimeterSegments が空配列
    expect(result.systemId).toBeNull() // 【確認内容】: systemId が null（未グルーピング）
    expect(result.calcResult).toBeNull() // 【確認内容】: calcResult が null（計算前）
  })

  it('テスト4: デフォルト値が HvacZoneNode スキーマ仕様通りに適用されること', () => {
    // 【テスト目的】: REQ-203〜207 のデフォルト値が確定処理後のノードに正しく設定されることを確認
    // 【テスト内容】: 最小限の入力で parse し、デフォルト値が補完されることを確認
    // 【期待される動作】: ceilingHeight=2.7, occupantDensity=0.15, designConditions のデフォルト
    // 🔵 信頼性レベル: REQ-203〜REQ-207 および hvac-zone.ts スキーマ定義に明示

    // 【テストデータ準備】: デフォルト値確認用の最小入力
    const input = {
      zoneName: 'テストゾーン',
      boundary: VALID_SQUARE_BOUNDARY,
      floorArea: 100,
      usage: 'office_general' as const,
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
    }

    // 【実際の処理実行】: デフォルト値適用確認
    const result = HvacZoneNode.parse(input)

    // 【結果検証】: 各デフォルト値が正しく適用されていることを確認
    expect(result.ceilingHeight).toBe(2.7) // 【確認内容】: REQ-203 ceilingHeight デフォルト 2.7m
    expect(result.occupantDensity).toBe(0.15) // 【確認内容】: REQ-203 occupantDensity デフォルト 0.15 人/m²
    expect(result.designConditions.coolingSetpoint).toBe(26) // 【確認内容】: REQ-204 冷房設定温度デフォルト
    expect(result.designConditions.heatingSetpoint).toBe(22) // 【確認内容】: REQ-204 暖房設定温度デフォルト
    expect(result.designConditions.relativeHumidity).toBe(50) // 【確認内容】: REQ-204 相対湿度デフォルト
    expect(result.designConditions.supplyAirTempDiff).toBe(10) // 【確認内容】: REQ-206 給気温度差デフォルト
  })

  it('テスト5: IDが "hvac_zone_" プレフィックスで自動生成されること', () => {
    // 【テスト目的】: フラットノードモデルのID自動生成ルールを確認
    // 【テスト内容】: HvacZoneNode.parse 後に id が "hvac_zone_" で始まることを確認
    // 【期待される動作】: id フィールドが "hvac_zone_xxxxxxxxxxxxxxxx" 形式
    // 🔵 信頼性レベル: CLAUDE.md フラットノードモデル（ID prefix ルール）に明示

    // 【テストデータ準備】: ID生成確認用の入力
    const input = {
      zoneName: 'IDテストゾーン',
      boundary: VALID_SQUARE_BOUNDARY,
      floorArea: 100,
      usage: 'office_general' as const,
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
    }

    // 【実際の処理実行】: HvacZoneNode.parse でID自動生成
    const result = HvacZoneNode.parse(input)

    // 【結果検証】: ID が "hvac_zone_" プレフィックスで始まることを確認
    expect(result.id).toMatch(/^hvac_zone_/) // 【確認内容】: ID フォーマットが "hvac_zone_" プレフィックス
  })
})

// ─── テスト6〜8: confirmZone — EDGE-001 面積0拒否ロジック ────────

describe('ZoneDrawTool: confirmZone — 面積0以下の拒否（EDGE-001）', () => {
  it('テスト6: 面積が 0 の場合に confirmZone が createNode を呼ばないこと', () => {
    // 【テスト目的】: EDGE-001 — 面積0以下のポリゴンを拒否する確定処理を確認
    // 【テスト内容】: 一直線上の頂点で面積0の場合に createNode が呼ばれないことを確認
    // 【期待される動作】: calculatePolygonArea が 0 を返し、createNode は呼ばれない
    // 🔵 信頼性レベル: TASK-0013 EDGE-001、要件定義セクション4.4に明示

    // 【テストデータ準備】: 一直線上の3頂点（面積0）
    const vertices = COLLINEAR_VERTICES
    const createNodeMock = vi.fn()

    // 【実際の処理実行】: confirmZone ロジックの実行（インライン実装でロジックをテスト）
    const confirmZone = (
      verts: { x: number; y: number }[],
      createNode: (node: unknown, parentId: string | null) => void,
      levelId: string | null,
    ) => {
      if (verts.length < 3) return
      const floorArea = calculatePolygonArea(verts)
      if (floorArea <= 0) return // EDGE-001: 面積0以下は拒否
      const node = HvacZoneNode.parse({
        zoneName: 'HvacZone 1',
        boundary: verts.map((v) => [v.x, v.y] as [number, number]),
        floorArea,
        usage: 'office_general' as const,
        perimeterSegments: [],
        systemId: null,
        calcResult: null,
      })
      createNode(node, levelId)
    }

    // 【実際の処理実行】: 面積0のポリゴンで confirmZone を呼び出す
    confirmZone(vertices, createNodeMock, 'level_test_01')

    // 【結果検証】: createNode が呼ばれていないことを確認
    expect(createNodeMock).not.toHaveBeenCalled() // 【確認内容】: EDGE-001 面積0は createNode を呼ばない
  })

  it('テスト7: 頂点数が 2 の場合に confirmZone が createNode を呼ばないこと', () => {
    // 【テスト目的】: 頂点不足（< 3）の場合に確定処理を無視することを確認
    // 【テスト内容】: 2頂点のみで confirmZone を呼び出すと createNode は呼ばれない
    // 【期待される動作】: 早期リターン（頂点数 < 3 の場合）
    // 🔵 信頼性レベル: 要件定義セクション4.5「頂点不足」に明示

    // 【テストデータ準備】: 2頂点のみ（ポリゴン未完成）
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const createNodeMock = vi.fn()

    // 【実際の処理実行】: confirmZone ロジックの実行
    const confirmZone = (
      verts: { x: number; y: number }[],
      createNode: (node: unknown, parentId: string | null) => void,
      levelId: string | null,
    ) => {
      if (verts.length < 3) return // 頂点不足で早期リターン
      const floorArea = calculatePolygonArea(verts)
      if (floorArea <= 0) return
      const node = HvacZoneNode.parse({
        zoneName: 'HvacZone 1',
        boundary: verts.map((v) => [v.x, v.y] as [number, number]),
        floorArea,
        usage: 'office_general' as const,
        perimeterSegments: [],
        systemId: null,
        calcResult: null,
      })
      createNode(node, levelId)
    }

    // 【実際の処理実行】: 2頂点で confirmZone を呼び出す
    confirmZone(vertices, createNodeMock, 'level_test_01')

    // 【結果検証】: createNode が呼ばれていないことを確認
    expect(createNodeMock).not.toHaveBeenCalled() // 【確認内容】: 頂点数 < 3 は createNode を呼ばない
  })

  it('テスト8: 有効なポリゴンで confirmZone が createNode を正しく呼ぶこと', () => {
    // 【テスト目的】: 正常フローで confirmZone が createNode を正しい引数で呼ぶことを確認
    // 【テスト内容】: 4頂点・面積100m²のポリゴンで確定処理を実行する
    // 【期待される動作】: createNode が HvacZoneNode と levelId を引数として呼ばれる
    // 🔵 信頼性レベル: TASK-0013 単体テスト要件「テスト5」、要件定義 2.4 に明示

    // 【テストデータ準備】: 有効な10m×10mゾーン
    const vertices = VALID_SQUARE_VERTICES
    const createNodeMock = vi.fn()
    const levelId = 'level_test_01'

    // 【実際の処理実行】: confirmZone ロジックの実行
    const confirmZone = (
      verts: { x: number; y: number }[],
      createNode: (node: unknown, parentId: string | null) => void,
      lvId: string | null,
    ) => {
      if (verts.length < 3) return
      const floorArea = calculatePolygonArea(verts)
      if (floorArea <= 0) return
      const node = HvacZoneNode.parse({
        zoneName: 'HvacZone 1',
        boundary: verts.map((v) => [v.x, v.y] as [number, number]),
        floorArea,
        usage: 'office_general' as const,
        perimeterSegments: [],
        systemId: null,
        calcResult: null,
      })
      createNode(node, lvId)
    }

    // 【実際の処理実行】: 有効なポリゴンで confirmZone を呼び出す
    confirmZone(vertices, createNodeMock, levelId)

    // 【結果検証】: createNode が1回呼ばれたことを確認
    expect(createNodeMock).toHaveBeenCalledTimes(1) // 【確認内容】: createNode が1回呼ばれた
    expect(createNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'hvac_zone',
        floorArea: expect.closeTo(100.0, 1),
        usage: 'office_general',
        systemId: null,
        calcResult: null,
        perimeterSegments: [],
      }),
      levelId,
    ) // 【確認内容】: createNode の引数が HvacZoneNode と levelId
  })
})

// ─── テスト9〜10: 確定後リセット・マルチゾーン対応 ──────────────

describe('ZoneDrawTool: 確定後リセットとマルチゾーン描画', () => {
  it('テスト9: 確定後に頂点リストがリセットされること', () => {
    // 【テスト目的】: 確定後に頂点がクリアされ、次のゾーン描画の準備ができることを確認
    // 【テスト内容】: confirmZone 後にリセット関数が呼ばれることを確認
    // 【期待される動作】: resetVertices が呼ばれ、次のゾーン描画が可能な状態になる
    // 🔵 信頼性レベル: TASK-0013 実装詳細セクション4「確定後にverticesをリセット」に明示

    // 【テストデータ準備】: 有効な4頂点ゾーン
    const vertices = VALID_SQUARE_VERTICES
    const createNodeMock = vi.fn()
    const resetMock = vi.fn()

    // 【実際の処理実行】: confirmZone + リセット処理
    const confirmZone = (
      verts: { x: number; y: number }[],
      createNode: (node: unknown, parentId: string | null) => void,
      reset: () => void,
    ) => {
      if (verts.length < 3) return
      const floorArea = calculatePolygonArea(verts)
      if (floorArea <= 0) return
      const node = HvacZoneNode.parse({
        zoneName: 'HvacZone 1',
        boundary: verts.map((v) => [v.x, v.y] as [number, number]),
        floorArea,
        usage: 'office_general' as const,
        perimeterSegments: [],
        systemId: null,
        calcResult: null,
      })
      createNode(node, null)
      reset() // 確定後にリセット
    }

    // 【実際の処理実行】: 確定処理を実行
    confirmZone(vertices, createNodeMock, resetMock)

    // 【結果検証】: リセットが呼ばれたことを確認
    expect(resetMock).toHaveBeenCalledTimes(1) // 【確認内容】: 確定後に頂点リセットが呼ばれる
    expect(createNodeMock).toHaveBeenCalledTimes(1) // 【確認内容】: createNode も呼ばれた
  })

  it('テスト10: 複数のゾーンを連続して確定できること（マルチゾーン対応）', () => {
    // 【テスト目的】: 1フロアで複数のゾーンを連続描画できることを確認
    // 【テスト内容】: 2回確定処理を実行し、両方のゾーンが createNode される
    // 【期待される動作】: createNode が2回呼ばれ、各ゾーンが独立した ID を持つ
    // 🟡 信頼性レベル: HVAC設計での複数ゾーン定義要件から妥当な推測

    // 【テストデータ準備】: 2つの異なるゾーン頂点
    const vertices1 = VALID_SQUARE_VERTICES // 10m×10m
    const vertices2 = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ] // 5m×10m
    const createNodeMock = vi.fn()

    // 【実際の処理実行】: confirmZone を使い回せる純粋関数形式
    const confirmZone = (
      verts: { x: number; y: number }[],
      createNode: (node: unknown, parentId: string | null) => void,
      levelId: string | null,
      zoneName: string,
    ) => {
      if (verts.length < 3) return
      const floorArea = calculatePolygonArea(verts)
      if (floorArea <= 0) return
      const node = HvacZoneNode.parse({
        zoneName,
        boundary: verts.map((v) => [v.x, v.y] as [number, number]),
        floorArea,
        usage: 'office_general' as const,
        perimeterSegments: [],
        systemId: null,
        calcResult: null,
      })
      createNode(node, levelId)
    }

    // 【実際の処理実行】: 2つのゾーンを連続確定
    confirmZone(vertices1, createNodeMock, 'level_01', 'HvacZone 1')
    confirmZone(vertices2, createNodeMock, 'level_01', 'HvacZone 2')

    // 【結果検証】: createNode が2回呼ばれたことを確認
    expect(createNodeMock).toHaveBeenCalledTimes(2) // 【確認内容】: 2つのゾーンが独立して作成される

    // 各ゾーンが正しい floorArea を持つことを確認
    const calls = createNodeMock.mock.calls
    const node1 = calls[0]?.[0] as { floorArea: number }
    const node2 = calls[1]?.[0] as { floorArea: number }
    expect(node1?.floorArea).toBeCloseTo(100.0, 1) // 【確認内容】: ゾーン1の面積は 100.0 m²
    expect(node2?.floorArea).toBeCloseTo(50.0, 1) // 【確認内容】: ゾーン2の面積は 50.0 m²
  })
})
