/**
 * PerimeterEditTool -- 外皮条件入力 PerimeterSegment バリデーション テスト
 *
 * TASK-0014: packages/core/src/schema/nodes/hvac-shared.ts の
 * PerimeterSegment Zod スキーマのバリデーション TDD Red フェーズテスト。
 *
 * 対象テストケース: TC-N05, TC-N06, TC-E01, TC-E02, TC-E03, TC-B01, TC-B02, TC-B03, TC-B04, TC-B05, TC-E06
 * テストフレームワーク: Vitest (packages/core/vitest.config.ts)
 */

import { describe, expect, it } from 'vitest'
import { PerimeterSegment } from '../hvac-shared'

// ============================================================================
// TC-N05: PerimeterSegment スキーマ -- 正常値パース成功
// ============================================================================

describe('PerimeterSegment バリデーション -- 正常系', () => {
  it('TC-N05: 有効な orientation/wallArea/glazingRatio の組み合わせがパースに成功する', () => {
    // 【テスト目的】: 有効な orientation, wallArea, glazingRatio の組み合わせが Zod スキーマで正常にパースされること
    // 【テスト内容】: 典型的な南面の外壁面データを PerimeterSegment.safeParse に渡す
    // 【期待される動作】: safeParse が success=true を返す
    // 🔵 信頼性レベル: hvac-shared.ts の PerimeterSegment スキーマに基づく

    // 【テストデータ準備】: 典型的な南面外壁面データ
    const input = { orientation: 'S', wallArea: 15, glazingRatio: 0.4 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: パースが成功すること
    expect(result.success).toBe(true) // 【確認内容】: safeParse の success フラグが true であること 🔵
  })

  // ============================================================================
  // TC-N06: 全 8 方位の Orientation バリデーション
  // ============================================================================

  it('TC-N06: 全 8 方位（N/NE/E/SE/S/SW/W/NW）が有効値として受け入れられる', () => {
    // 【テスト目的】: N, NE, E, SE, S, SW, W, NW の全 8 方位が正常にパースされること
    // 【テスト内容】: 8 方位それぞれで PerimeterSegment.safeParse を呼び出す
    // 【期待される動作】: 全 8 件で success=true が返される
    // 🔵 信頼性レベル: hvac-shared.ts の Orientation enum 定義に基づく

    // 【テストデータ準備】: 8 方位の網羅テストデータ
    const allOrientations = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

    // 【実際の処理実行 + 結果検証】: 各方位でパース成功すること
    for (const orientation of allOrientations) {
      const result = PerimeterSegment.safeParse({ orientation, wallArea: 10, glazingRatio: 0.3 })
      expect(result.success).toBe(true) // 【確認内容】: 方位 ${orientation} でパースが成功すること 🔵
    }
  })
})

// ============================================================================
// 異常系テストケース
// ============================================================================

describe('PerimeterSegment バリデーション -- 異常系', () => {
  // ============================================================================
  // TC-E01: glazingRatio が上限超過（EDGE-002）
  // ============================================================================

  it('TC-E01: glazingRatio が 1.0 を超える場合にバリデーションエラーとなる（EDGE-002）', () => {
    // 【テスト目的】: EDGE-002 -- ガラス面積比が 1.0（100%）を超える不正値がバリデーションエラーになること
    // 【テスト内容】: glazingRatio=1.5 の不正データを PerimeterSegment.safeParse に渡す
    // 【期待される動作】: safeParse が success=false を返す
    // 🔵 信頼性レベル: EDGE-002 として明示的に定義、TASK-0014 テスト4 に記載

    // 【テストデータ準備】: glazingRatio が 1.0 を超える不正値（150%のガラス面積比）
    const input = { orientation: 'S', wallArea: 15, glazingRatio: 1.5 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: バリデーションエラーが発生すること
    expect(result.success).toBe(false) // 【確認内容】: glazingRatio 1.5 は max(1) 制約違反でエラーになること 🔵
  })

  // ============================================================================
  // TC-E02: glazingRatio が下限未満
  // ============================================================================

  it('TC-E02: glazingRatio が 0.0 未満の場合にバリデーションエラーとなる', () => {
    // 【テスト目的】: ガラス面積比が負の値の場合にバリデーションエラーになること
    // 【テスト内容】: glazingRatio=-0.1 の不正データを渡す
    // 【期待される動作】: safeParse が success=false を返す
    // 🔵 信頼性レベル: EDGE-002 の下限側テスト、hvac-shared.ts の min(0) 制約に基づく

    // 【テストデータ準備】: 負の glazingRatio
    const input = { orientation: 'S', wallArea: 15, glazingRatio: -0.1 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: バリデーションエラーが発生すること
    expect(result.success).toBe(false) // 【確認内容】: glazingRatio -0.1 は min(0) 制約違反でエラーになること 🔵
  })

  // ============================================================================
  // TC-E03: 不正な orientation 値のバリデーション
  // ============================================================================

  it('TC-E03: 8 方位以外の orientation 値がバリデーションエラーとなる', () => {
    // 【テスト目的】: 定義されていない方位文字列（例: 'NORTH'）がバリデーションエラーになること
    // 【テスト内容】: orientation='NORTH' の不正データを渡す
    // 【期待される動作】: safeParse が success=false を返す
    // 🔵 信頼性レベル: hvac-shared.ts の Orientation enum 定義に基づく

    // 【テストデータ準備】: 8 方位 enum に存在しない 'NORTH' を使用
    const input = { orientation: 'NORTH', wallArea: 15, glazingRatio: 0.3 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: バリデーションエラーが発生すること
    expect(result.success).toBe(false) // 【確認内容】: 不正な orientation 'NORTH' は enum 不一致でエラーになること 🔵
  })

  // ============================================================================
  // TC-E03b: orientation に空文字列を渡した場合
  // ============================================================================

  it('TC-E03b: orientation に空文字列を渡した場合にバリデーションエラーとなる', () => {
    // 【テスト目的】: orientation が空文字列の場合にバリデーションエラーになること
    // 【テスト内容】: orientation='' の不正データを渡す
    // 【期待される動作】: safeParse が success=false を返す
    // 🔵 信頼性レベル: hvac-shared.ts の Orientation enum 定義に基づく

    // 【テストデータ準備】: 空文字列の orientation
    const input = { orientation: '', wallArea: 15, glazingRatio: 0.3 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: バリデーションエラーが発生すること
    expect(result.success).toBe(false) // 【確認内容】: 空文字列は enum 不一致でエラーになること 🔵
  })

  // ============================================================================
  // TC-E06: wallArea に負の値
  // ============================================================================

  it('TC-E06: wallArea に負の値を入力した場合の現行スキーマ動作を確認する', () => {
    // 【テスト目的】: wallArea の現行バリデーション動作を文書化し、制約不足を認識する
    // 【テスト内容】: wallArea=-5 を渡した場合に現行スキーマ（z.number()）では success=true になることを確認
    // 【期待される動作】: 現行スキーマは nonnegative 制約がないため success=true になる（既知の制限事項）
    // 🟡 信頼性レベル: 要件定義 3.3 で「wallArea は z.number()（現状 nonnegative 制約なし、要確認）」と記載されている

    // 【テストデータ準備】: 負の wallArea（物理的にありえない値）
    const input = { orientation: 'S', wallArea: -5, glazingRatio: 0.3 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: 現行スキーマでは nonnegative 制約がないため success=true（制限事項の可視化）
    // NOTE: 将来的には wallArea: z.number().nonnegative() への変更を推奨
    expect(result.success).toBe(true) // 【確認内容】: 現行スキーマでは負の wallArea もパース成功する（制限事項） 🟡
  })
})

// ============================================================================
// 境界値テストケース
// ============================================================================

describe('PerimeterSegment バリデーション -- 境界値', () => {
  // ============================================================================
  // TC-B01: glazingRatio = 0.0（下限境界値）
  // ============================================================================

  it('TC-B01: glazingRatio = 0.0 が有効値として受け入れられる（下限境界値）', () => {
    // 【テスト目的】: glazingRatio 下限境界値（0.0）が有効値として正確に判定されること
    // 【テスト内容】: glazingRatio=0.0（ガラスのない壁面）を渡す
    // 【期待される動作】: safeParse が success=true を返す
    // 🔵 信頼性レベル: EDGE-002、TASK-0014 テスト5 に明示的記載

    // 【テストデータ準備】: 下限境界値 0.0 のデータ
    const input = { orientation: 'N', wallArea: 10, glazingRatio: 0.0 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: 下限境界値 0.0 は有効値として受け入れられること
    expect(result.success).toBe(true) // 【確認内容】: 0.0 は min(0) 制約の境界値として有効であること 🔵
  })

  // ============================================================================
  // TC-B02: glazingRatio = 1.0（上限境界値）
  // ============================================================================

  it('TC-B02: glazingRatio = 1.0 が有効値として受け入れられる（上限境界値）', () => {
    // 【テスト目的】: glazingRatio 上限境界値（1.0）が有効値として正確に判定されること
    // 【テスト内容】: glazingRatio=1.0（全面ガラス）を渡す
    // 【期待される動作】: safeParse が success=true を返す
    // 🔵 信頼性レベル: EDGE-002、TASK-0014 テスト5 に明示的記載

    // 【テストデータ準備】: 上限境界値 1.0 のデータ
    const input = { orientation: 'S', wallArea: 20, glazingRatio: 1.0 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: 上限境界値 1.0 は有効値として受け入れられること
    expect(result.success).toBe(true) // 【確認内容】: 1.0 は max(1) 制約の境界値として有効であること 🔵
  })

  // ============================================================================
  // TC-B03: glazingRatio = 1.001（上限直外）
  // ============================================================================

  it('TC-B03: glazingRatio = 1.001 がバリデーションエラーとなる（上限境界直外）', () => {
    // 【テスト目的】: 上限 1.0 をわずかに超える値が確実に拒否されること
    // 【テスト内容】: glazingRatio=1.001（上限をわずかに超過）を渡す
    // 【期待される動作】: safeParse が success=false を返す
    // 🟡 信頼性レベル: EDGE-002 の境界テストとして妥当な拡張

    // 【テストデータ準備】: 上限直外の 1.001
    const input = { orientation: 'S', wallArea: 15, glazingRatio: 1.001 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: 1.001 は max(1) 制約に違反してエラーになること
    expect(result.success).toBe(false) // 【確認内容】: 1.001 は max(1) を超えるためエラーになること 🟡
  })

  // ============================================================================
  // TC-B04: glazingRatio = -0.001（下限直外）
  // ============================================================================

  it('TC-B04: glazingRatio = -0.001 がバリデーションエラーとなる（下限境界直外）', () => {
    // 【テスト目的】: 下限 0.0 をわずかに下回る値が確実に拒否されること
    // 【テスト内容】: glazingRatio=-0.001（下限をわずかに下回る）を渡す
    // 【期待される動作】: safeParse が success=false を返す
    // 🟡 信頼性レベル: EDGE-002 の境界テストとして妥当な拡張

    // 【テストデータ準備】: 下限直外の -0.001
    const input = { orientation: 'N', wallArea: 10, glazingRatio: -0.001 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: -0.001 は min(0) 制約に違反してエラーになること
    expect(result.success).toBe(false) // 【確認内容】: -0.001 は min(0) を下回るためエラーになること 🟡
  })

  // ============================================================================
  // TC-B05: wallArea = 0（壁面積ゼロ）
  // ============================================================================

  it('TC-B05: wallArea = 0 が有効値として受け入れられる（現行スキーマ動作確認）', () => {
    // 【テスト目的】: wallArea=0 が現行スキーマ（z.number()）で有効値として扱われること
    // 【テスト内容】: wallArea=0 のデータを渡す
    // 【期待される動作】: safeParse が success=true を返す（外皮負荷 0 として計算される）
    // 🟡 信頼性レベル: 要件定義 4.9 に記載されている妥当な推測

    // 【テストデータ準備】: wallArea=0 のデータ
    const input = { orientation: 'S', wallArea: 0, glazingRatio: 0.3 }

    // 【実際の処理実行】: Zod の safeParse でバリデーション実行
    const result = PerimeterSegment.safeParse(input)

    // 【結果検証】: wallArea=0 は現行スキーマで有効値として受け入れられること
    expect(result.success).toBe(true) // 【確認内容】: wallArea=0 は z.number() の範囲内で有効値 🟡
  })
})
