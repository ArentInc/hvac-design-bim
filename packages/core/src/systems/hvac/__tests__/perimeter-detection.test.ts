/**
 * PerimeterEditTool -- 外皮条件入力 交差検出アルゴリズム テスト
 *
 * TASK-0014: perimeter-detection.ts (packages/core/src/systems/hvac/perimeter-detection.ts)
 * の TDD Red フェーズテスト。
 *
 * 対象テストケース: TC-N01, TC-N02, TC-N03, TC-N04, TC-B06, TC-B07
 * テストフレームワーク: Vitest (packages/core/vitest.config.ts)
 */

import { describe, expect, it } from 'vitest'
import type { WallMetadata } from '../../../loaders/architecture-metadata'
// 【未実装モジュールのインポート】: detectPerimeterSegments はまだ存在しない
// このインポートが失敗することが Red フェーズの期待動作
import { detectPerimeterSegments } from '../perimeter-detection'

// ============================================================================
// テストデータ共通定義
// ============================================================================

/**
 * 10m x 10m 正方形ゾーン境界（XY平面、原点起点）
 * - 南辺: y=0 の辺（[0,0] → [10,0]）
 * - 東辺: x=10 の辺（[10,0] → [10,10]）
 * - 北辺: y=10 の辺（[10,10] → [0,10]）
 * - 西辺: x=0 の辺（[0,10] → [0,0]）
 */
const SQUARE_BOUNDARY_10x10: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

/** 標準壁高さ（m） */
const WALL_HEIGHT = 2.7

// ============================================================================
// TC-N01: 交差検出 -- 完全一致する外壁面のセグメント検出
// ============================================================================

describe('detectPerimeterSegments -- 交差検出アルゴリズム', () => {
  it('TC-N01: 完全一致する外壁面のセグメントが検出される', () => {
    // 【テスト目的】: ゾーン境界の辺と外壁面が完全に一致する場合、正しい perimeterSegment が返却されること
    // 【テスト内容】: 10m x 10m 正方形ゾーンの南辺と完全一致する南面外壁を入力
    // 【期待される動作】: orientation='S', wallArea=10*2.7=27, glazingRatio=0.4 のセグメント1件が返却される
    // 🔵 信頼性レベル: REQ-208、TASK-0014 テスト1 に明示的記載

    // 【テストデータ準備】: 南辺に完全一致する外壁面メタデータ（x=0〜10, y=0, z=0）
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w1',
        orientation: 'S',
        wallArea: 27,
        glazingRatio: 0.4,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: セグメントが1件返却され、各フィールドが正確であること
    expect(result).toHaveLength(1) // 【確認内容】: 交差する外壁面が1件なのでセグメントも1件 🔵
    const seg0 = result[0]! // noUncheckedIndexedAccess 対応: length=1 確認済みのため安全
    expect(seg0.orientation).toBe('S') // 【確認内容】: 南面外壁の方位が S であること 🔵
    expect(seg0.wallArea).toBeCloseTo(27, 1) // 【確認内容】: 交差長 10m × 壁高 2.7m = 27m2 🔵
    expect(seg0.glazingRatio).toBe(0.4) // 【確認内容】: 建築参照の glazingRatio をそのまま引き継ぐ 🔵
  })

  // ============================================================================
  // TC-N02: 交差検出 -- 部分交差する外壁面のセグメント検出
  // ============================================================================

  it('TC-N02: 部分交差する外壁面の交差部分のみセグメントが生成される', () => {
    // 【テスト目的】: ゾーン境界の辺と外壁面が部分的にのみ重なる場合、交差部分のみのセグメントが返却されること
    // 【テスト内容】: 南辺の左半分（0〜5m）のみカバーする外壁面を入力
    // 【期待される動作】: wallArea=5*2.7=13.5 のセグメント1件が返却される
    // 🔵 信頼性レベル: REQ-208、TASK-0014 テスト2 に明示的記載

    // 【テストデータ準備】: 南辺の半分（x=0〜5）のみカバーする外壁面
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w1',
        orientation: 'S',
        wallArea: 13.5,
        glazingRatio: 0.3,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 0, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: 交差長5m x 壁高2.7m = 13.5m2 のセグメントが返却されること
    expect(result).toHaveLength(1) // 【確認内容】: 交差が1件なのでセグメントも1件 🔵
    const seg0 = result[0]! // noUncheckedIndexedAccess 対応: length=1 確認済みのため安全
    expect(seg0.orientation).toBe('S') // 【確認内容】: 方位が S であること 🔵
    expect(seg0.wallArea).toBeCloseTo(13.5, 1) // 【確認内容】: 部分交差長さ5m × 壁高2.7m = 13.5m2 🔵
    expect(seg0.glazingRatio).toBe(0.3) // 【確認内容】: glazingRatio が引き継がれること 🔵
  })

  // ============================================================================
  // TC-N03: 交差検出 -- 交差なし
  // ============================================================================

  it('TC-N03: ゾーン境界と離れた外壁面は空配列を返す', () => {
    // 【テスト目的】: ゾーン境界と完全に離れた外壁面がある場合、空配列が返却されること
    // 【テスト内容】: ゾーン境界（0〜10m）から離れた位置（x=20〜30, y=20）の外壁面を入力
    // 【期待される動作】: 交差がないため空配列が返される
    // 🔵 信頼性レベル: REQ-208、TASK-0014 テスト3 に明示的記載

    // 【テストデータ準備】: ゾーン境界から離れた外壁面（x=20〜30, y=20）
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w1',
        orientation: 'S',
        wallArea: 27,
        glazingRatio: 0.4,
        vertices: [
          { x: 20, y: 20, z: 0 },
          { x: 30, y: 20, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: 交差がないため空配列が返却されること
    expect(result).toHaveLength(0) // 【確認内容】: 交差なしで空配列が返ること 🔵
    expect(result).toEqual([]) // 【確認内容】: 返却値が空配列であること 🔵
  })

  // ============================================================================
  // TC-N04: 交差検出 -- 複数方位の外壁面同時検出
  // ============================================================================

  it('TC-N04: 複数方位の外壁面が同時に検出される（南面・東面）', () => {
    // 【テスト目的】: 南面と東面など複数方位の外壁面がゾーン境界と交差する場合、それぞれのセグメントが正しく返却されること
    // 【テスト内容】: 南辺10mと東辺10mの2面の外壁を同時に入力
    // 【期待される動作】: orientation='S' と orientation='E' の2件のセグメントが返却される
    // 🟡 信頼性レベル: REQ-208 に基づく妥当な拡張ケース

    // 【テストデータ準備】: 南面 + 東面の2枚の外壁面
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w-south',
        orientation: 'S',
        wallArea: 27,
        glazingRatio: 0.4,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      },
      {
        wallId: 'w-east',
        orientation: 'E',
        wallArea: 27,
        glazingRatio: 0.3,
        vertices: [
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: 2件のセグメントが返却され、各方位が正しいこと
    expect(result).toHaveLength(2) // 【確認内容】: 南面・東面の2件が検出されること 🟡
    const orientations = result.map((s) => s.orientation)
    expect(orientations).toContain('S') // 【確認内容】: 南面セグメントが含まれること 🟡
    expect(orientations).toContain('E') // 【確認内容】: 東面セグメントが含まれること 🟡
  })

  // ============================================================================
  // TC-B06: 交差検出 -- 交差長がイプシロン以下の場合
  // ============================================================================

  it('TC-B06: 交差長がイプシロン（0.001m）以下の場合にセグメントが生成されない', () => {
    // 【テスト目的】: 浮動小数点誤差レベルの微小な交差はセグメントとして扱われないこと
    // 【テスト内容】: ゾーン境界辺と 0.0005m だけ重なる外壁面を入力
    // 【期待される動作】: イプシロン（0.001m）以下の交差なので空配列が返される
    // 🟡 信頼性レベル: TASK-0014 注意事項「イプシロン 0.001m」に基づく妥当な推測

    // 【テストデータ準備】: 南辺と 0.0005m（イプシロン未満）だけ重なる外壁面
    // ゾーン南辺は y=0, x=0〜10。外壁は x=-0.0005〜0.0005 の範囲で y=0 に接触
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w-tiny',
        orientation: 'S',
        wallArea: 0.001,
        glazingRatio: 0.3,
        vertices: [
          { x: -0.0005, y: 0, z: 0 },
          { x: 0.0005, y: 0, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: イプシロン以下の交差は無視されて空配列が返ること
    expect(result).toHaveLength(0) // 【確認内容】: 微小な交差（0.001m以下）は除外されること 🟡
  })

  // ============================================================================
  // TC-B07: 交差検出 -- 空の architectureWalls
  // ============================================================================

  it('TC-B07: 建築参照の外壁面が空配列の場合に空配列が返る', () => {
    // 【テスト目的】: 建築参照データが存在するが外壁面がないケースで安全に動作すること
    // 【テスト内容】: architectureWalls として空配列を入力
    // 【期待される動作】: エラーにならず空配列が返される
    // 🟡 信頼性レベル: 一般的な堅牢性テストとして妥当な推測

    // 【テストデータ準備】: 空の外壁面配列
    const architectureWalls: WallMetadata[] = []

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す（空配列でクラッシュしないこと）
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: 外壁面がなければセグメントは生成されず空配列が返ること
    expect(result).toHaveLength(0) // 【確認内容】: 空入力に対して安全に空出力を返すこと 🟡
    expect(Array.isArray(result)).toBe(true) // 【確認内容】: 返却値が配列型であること 🟡
  })

  // ============================================================================
  // TC-N04 追加: 南面・北面の対向する外壁面が同時に検出される
  // ============================================================================

  it('TC-N04b: 南面・北面の対向する外壁面が同時に検出される', () => {
    // 【テスト目的】: 対向する2方位（南北）の外壁面が同時に検出されること
    // 【テスト内容】: 南辺と北辺の両方に外壁面がある場合を入力
    // 【期待される動作】: orientation='S' と orientation='N' の2件が返却される
    // 🟡 信頼性レベル: REQ-208 に基づく妥当な拡張ケース

    // 【テストデータ準備】: 南面と北面の2枚の外壁面
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w-south',
        orientation: 'S',
        wallArea: 27,
        glazingRatio: 0.4,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      },
      {
        wallId: 'w-north',
        orientation: 'N',
        wallArea: 27,
        glazingRatio: 0.1,
        vertices: [
          { x: 0, y: 10, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: 南面・北面の2件が検出されること
    expect(result).toHaveLength(2) // 【確認内容】: 南面・北面の2件が検出されること 🟡
    const orientations = result.map((s) => s.orientation)
    expect(orientations).toContain('S') // 【確認内容】: 南面セグメントが含まれること 🟡
    expect(orientations).toContain('N') // 【確認内容】: 北面セグメントが含まれること 🟡
  })

  // ============================================================================
  // wallArea の計算精度: 交差長 × 壁高さ の積
  // ============================================================================

  it('TC-N01b: wallArea が 交差長 × wallHeight で計算される', () => {
    // 【テスト目的】: wallArea が「交差長 × wallHeight」で正確に計算されることを確認
    // 【テスト内容】: 交差長 7m, wallHeight=3.0 の場合に wallArea=21.0 になることを確認
    // 【期待される動作】: wallArea = 7 * 3.0 = 21.0
    // 🔵 信頼性レベル: REQ-208、要件定義 4.3 の wallArea=10*wallHeight の計算式に明示的記載

    // 【テストデータ準備】: 交差長7mの南面外壁（wallHeight=3.0を使用）
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w1',
        orientation: 'S',
        wallArea: 21.0,
        glazingRatio: 0.35,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 7, y: 0, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: wallHeight=3.0 で実行
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, 3.0)

    // 【結果検証】: wallArea が 7 * 3.0 = 21.0 であること
    expect(result).toHaveLength(1) // 【確認内容】: セグメントが1件返却されること 🔵
    const seg0 = result[0]! // noUncheckedIndexedAccess 対応: length=1 確認済みのため安全
    expect(seg0.wallArea).toBeCloseTo(21.0, 1) // 【確認内容】: wallArea = 7m × 3.0m = 21.0m2 🔵
  })

  // ============================================================================
  // 交差検出: ゾーン境界の全4辺に外壁面がある場合
  // ============================================================================

  it('TC-N04c: 全4方向（南・東・北・西）の外壁面が同時に検出される', () => {
    // 【テスト目的】: 4面すべてが外壁に接するゾーンで全セグメントが正しく検出されること
    // 【テスト内容】: 正方形ゾーンの4辺すべてに外壁面を設定
    // 【期待される動作】: 4件のセグメントが返却され、各方位が正しい
    // 🟡 信頼性レベル: REQ-208 に基づく妥当な拡張ケース（角部屋のさらに拡張）

    // 【テストデータ準備】: 4面すべての外壁面
    const architectureWalls: WallMetadata[] = [
      {
        wallId: 'w-south',
        orientation: 'S',
        wallArea: 27,
        glazingRatio: 0.4,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      },
      {
        wallId: 'w-east',
        orientation: 'E',
        wallArea: 27,
        glazingRatio: 0.3,
        vertices: [
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
      },
      {
        wallId: 'w-north',
        orientation: 'N',
        wallArea: 27,
        glazingRatio: 0.1,
        vertices: [
          { x: 10, y: 10, z: 0 },
          { x: 0, y: 10, z: 0 },
        ],
      },
      {
        wallId: 'w-west',
        orientation: 'W',
        wallArea: 27,
        glazingRatio: 0.2,
        vertices: [
          { x: 0, y: 10, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
      },
    ]

    // 【実際の処理実行】: detectPerimeterSegments を呼び出す
    const result = detectPerimeterSegments(SQUARE_BOUNDARY_10x10, architectureWalls, WALL_HEIGHT)

    // 【結果検証】: 4件のセグメントが返却されること
    expect(result).toHaveLength(4) // 【確認内容】: 4方向すべてのセグメントが生成されること 🟡
    const orientations = result.map((s) => s.orientation)
    expect(orientations).toContain('S') // 【確認内容】: 南面が含まれること 🟡
    expect(orientations).toContain('E') // 【確認内容】: 東面が含まれること 🟡
    expect(orientations).toContain('N') // 【確認内容】: 北面が含まれること 🟡
    expect(orientations).toContain('W') // 【確認内容】: 西面が含まれること 🟡
  })
})
