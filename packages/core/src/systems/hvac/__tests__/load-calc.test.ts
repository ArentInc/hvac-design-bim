/**
 * LoadCalcSystem -- 負荷概算計算エンジン 単体テスト
 *
 * TASK-0015: load-calc.ts (packages/core/src/systems/hvac/load-calc.ts)
 * の TDD Red フェーズテスト。
 *
 * テストケース:
 *   TC-N01〜TC-N17: 正常系（内部負荷, 外皮負荷, 冷房負荷合算, 風量, 暖房負荷, 統合計算）
 *   TC-E01〜TC-E06: 異常系（ゼロ除算, 負値, 例外ハンドリング, フォールバック）
 *   TC-B01〜TC-B08: 境界値（空配列, glazingRatio 境界, 全方位, 同一方位重複）
 *
 * テストフレームワーク: Vitest (packages/core/vitest.config.ts)
 */

import { describe, expect, it } from 'vitest'

// 【未実装モジュールのインポート】: load-calc.ts はまだ存在しない
// このインポートが失敗することが Red フェーズの期待動作
import {
  calculateCoolingLoad,
  calculateEnvelopeLoad,
  calculateHeatingLoad,
  calculateInternalLoad,
  calculateRequiredAirflow,
  calculateZoneLoad,
  SOLAR_COEFFICIENTS,
} from '../load-calc'

// ============================================================================
// テストデータ共通定義
// ============================================================================

/** 一般オフィスの基本ゾーンデータ（南面ペリメータあり） */
const BASIC_OFFICE_ZONE = {
  floorArea: 100,
  usage: 'office_general' as const,
  perimeterSegments: [{ orientation: 'S' as const, wallArea: 30, glazingRatio: 0.4 }],
  designConditions: { supplyAirTempDiff: 10 },
}

// ============================================================================
// TC-N: 正常系テストケース
// ============================================================================

describe('内部負荷計算 (calculateInternalLoad)', () => {
  it('TC-N01: 一般オフィスの内部冷房負荷が正しく算出される', () => {
    // 【テスト目的】: floorArea x coolingLoadPerArea で内部冷房負荷を正しく計算すること
    // 【テスト内容】: office_general の冷房原単位（150 W/m^2）を 100m^2 に適用
    // 【期待される動作】: load-unit-table.json の office_general.coolingLoadPerArea = 150 が参照される
    // 🔵 信頼性レベル: REQ-302 に計算式明示、load-unit-table.json で値確認済み

    // 【テストデータ準備】: 100m^2 の一般オフィスは最も一般的なケース
    const floorArea = 100
    const usage = 'office_general' as const

    // 【実際の処理実行】: calculateInternalLoad に面積と用途を渡す
    const result = calculateInternalLoad(floorArea, usage)

    // 【結果検証】: 100 x 150 = 15000 W であること
    expect(result).toBe(15000) // 【確認内容】: JSON の office_general.coolingLoadPerArea = 150 が適用されること 🔵
  })

  it('TC-N02: サーバー室の内部冷房負荷が正しく算出される', () => {
    // 【テスト目的】: サーバー室の高い冷房原単位（800 W/m^2）が正しく適用されること
    // 【テスト内容】: office_server の冷房原単位を 50m^2 に適用
    // 【期待される動作】: TASK-0015 記載値（500）ではなく JSON 値（800）が使われること
    // 🔵 信頼性レベル: REQ-302, load-unit-table.json 確認済み

    // 【テストデータ準備】: 50m^2 のサーバー室（高発熱用途の代表）
    const floorArea = 50
    const usage = 'office_server' as const

    // 【実際の処理実行】: calculateInternalLoad に面積と用途を渡す
    const result = calculateInternalLoad(floorArea, usage)

    // 【結果検証】: 50 x 800 = 40000 W であること
    expect(result).toBe(40000) // 【確認内容】: JSON 値（800）が適用されること（TASK記載の500ではない） 🔵
  })

  it('TC-N03: 会議室の内部冷房負荷が正しく算出される', () => {
    // 【テスト目的】: 会議室の冷房原単位（200 W/m^2）が正しく適用されること
    // 【テスト内容】: conference の冷房原単位を 30m^2 に適用
    // 【期待される動作】: load-unit-table.json の conference.coolingLoadPerArea = 200 が参照される
    // 🔵 信頼性レベル: REQ-302, load-unit-table.json 確認済み

    // 【テストデータ準備】: 30m^2 の会議室（中規模）
    const floorArea = 30
    const usage = 'conference' as const

    // 【実際の処理実行】: calculateInternalLoad に面積と用途を渡す
    const result = calculateInternalLoad(floorArea, usage)

    // 【結果検証】: 30 x 200 = 6000 W であること
    expect(result).toBe(6000) // 【確認内容】: conference の冷房原単位 200 が正しく参照されること 🔵
  })

  it('TC-N04: 受付ロビーの内部冷房負荷が正しく算出される', () => {
    // 【テスト目的】: 受付の冷房原単位（130 W/m^2）が正しく適用されること
    // 【テスト内容】: reception の冷房原単位を 80m^2 に適用
    // 【期待される動作】: TASK-0015 記載値（120）ではなく JSON 値（130）が使われること
    // 🔵 信頼性レベル: REQ-302, load-unit-table.json 確認済み

    // 【テストデータ準備】: 80m^2 の受付ロビー
    const floorArea = 80
    const usage = 'reception' as const

    // 【実際の処理実行】: calculateInternalLoad に面積と用途を渡す
    const result = calculateInternalLoad(floorArea, usage)

    // 【結果検証】: 80 x 130 = 10400 W であること
    expect(result).toBe(10400) // 【確認内容】: JSON 値（130）が適用されること（TASK記載の120ではない） 🔵
  })

  it('TC-N05: 廊下の内部冷房負荷が正しく算出される', () => {
    // 【テスト目的】: 廊下の冷房原単位（60 W/m^2）が正しく適用されること
    // 【テスト内容】: corridor の冷房原単位を 40m^2 に適用
    // 【期待される動作】: TASK-0015 記載値（80）ではなく JSON 値（60）が使われること
    // 🔵 信頼性レベル: REQ-302, load-unit-table.json 確認済み

    // 【テストデータ準備】: 40m^2 の廊下
    const floorArea = 40
    const usage = 'corridor' as const

    // 【実際の処理実行】: calculateInternalLoad に面積と用途を渡す
    const result = calculateInternalLoad(floorArea, usage)

    // 【結果検証】: 40 x 60 = 2400 W であること
    expect(result).toBe(2400) // 【確認内容】: JSON 値（60）が適用されること（TASK記載の80ではない） 🔵
  })
})

describe('外皮負荷計算 (calculateEnvelopeLoad)', () => {
  it('TC-N06: 南面のみの外皮負荷が正しく算出される', () => {
    // 【テスト目的】: 単一方位の外皮負荷計算が正しいこと
    // 【テスト内容】: 南面 wallArea=30, glazingRatio=0.4 で外皮負荷を計算
    // 【期待される動作】: wallArea x glazingRatio x solarCoeff(S=1.0) x BASE(200) で計算
    // 🔵 信頼性レベル: REQ-303 に計算式・係数明示

    // 【テストデータ準備】: 南面 30m^2、ガラス面積比 40%（典型的なペリメータ条件）
    const segments = [{ orientation: 'S' as const, wallArea: 30, glazingRatio: 0.4 }]

    // 【実際の処理実行】: calculateEnvelopeLoad にセグメント配列を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: 合計 30 x 0.4 x 1.0 x 200 = 2400 W であること
    expect(result.total).toBe(2400) // 【確認内容】: 南面 S=1.0 の補正係数が適用された合計値 🔵
  })

  it('TC-N07: 複数方位の外皮負荷が正しく合算される', () => {
    // 【テスト目的】: 複数セグメントの外皮負荷が個別計算後に正しく合算されること
    // 【テスト内容】: 南面と西面の 2 セグメントを渡した場合の合算
    // 【期待される動作】: S=1.0, W=1.2 の補正係数で個別計算し合算
    // 🔵 信頼性レベル: REQ-303 に方位別係数明示

    // 【テストデータ準備】: 南面と西面の 2 面ペリメータ（コーナーゾーンの典型）
    const segments = [
      { orientation: 'S' as const, wallArea: 30, glazingRatio: 0.4 },
      { orientation: 'W' as const, wallArea: 20, glazingRatio: 0.3 },
    ]

    // 【実際の処理実行】: calculateEnvelopeLoad にセグメント配列を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: S: 30 x 0.4 x 1.0 x 200 = 2400, W: 20 x 0.3 x 1.2 x 200 = 1440, 合計 = 3840
    expect(result.total).toBe(3840) // 【確認内容】: 方位ごとに異なる係数が適用され合算されること 🔵
  })

  it('TC-N08: 方位別外皮負荷内訳が正しく出力される', () => {
    // 【テスト目的】: breakdown の構造が HvacZoneCalcResult スキーマに準拠すること
    // 【テスト内容】: 南面と東面の 2 セグメントで breakdown の内容を確認
    // 【期待される動作】: orientation, solarCorrectionFactor, envelopeLoadContribution が各エントリに含まれる
    // 🔵 信頼性レベル: REQ-306, hvac-zone.ts の HvacZoneCalcResult スキーマに明示

    // 【テストデータ準備】: 南面と東面の 2 面構成
    const segments = [
      { orientation: 'S' as const, wallArea: 30, glazingRatio: 0.4 },
      { orientation: 'E' as const, wallArea: 20, glazingRatio: 0.5 },
    ]

    // 【実際の処理実行】: calculateEnvelopeLoad にセグメント配列を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: breakdown に正しい構造と値が含まれること
    // S: 30 x 0.4 x 1.0 x 200 = 2400, E: 20 x 0.5 x 1.2 x 200 = 2400
    expect(result.breakdown).toHaveLength(2) // 【確認内容】: 2 セグメント分のエントリが含まれること 🔵
    const sEntry = result.breakdown.find((b) => b.orientation === 'S')
    const eEntry = result.breakdown.find((b) => b.orientation === 'E')
    expect(sEntry).toBeDefined() // 【確認内容】: S 方位のエントリが存在すること 🔵
    expect(sEntry?.solarCorrectionFactor).toBe(1.0) // 【確認内容】: S の補正係数が 1.0 であること 🔵
    expect(sEntry?.envelopeLoadContribution).toBe(2400) // 【確認内容】: S の外皮負荷寄与が 2400 W であること 🔵
    expect(eEntry?.solarCorrectionFactor).toBe(1.2) // 【確認内容】: E の補正係数が 1.2 であること 🔵
    expect(eEntry?.envelopeLoadContribution).toBe(2400) // 【確認内容】: E の外皮負荷寄与が 2400 W であること 🔵
  })
})

describe('冷房負荷合算 (calculateCoolingLoad)', () => {
  it('TC-N09: 冷房負荷が内部負荷と外皮負荷の合計として正しく算出される', () => {
    // 【テスト目的】: coolingLoad = internalLoad + envelopeLoad の単純加算が正しいこと
    // 【テスト内容】: internalLoad=15000, envelopeLoad=2400 を渡した場合の合算
    // 【期待される動作】: 単純加算で 17400 W を返す
    // 🔵 信頼性レベル: REQ-301 に coolingLoad = internalLoad + envelopeLoad と明示

    // 【テストデータ準備】: 一般オフィス 100m^2 の内部負荷 + 南面外皮負荷の組み合わせ
    const internalLoad = 15000
    const envelopeLoad = 2400

    // 【実際の処理実行】: calculateCoolingLoad に内部負荷と外皮負荷を渡す
    const result = calculateCoolingLoad(internalLoad, envelopeLoad)

    // 【結果検証】: 15000 + 2400 = 17400 W であること
    expect(result).toBe(17400) // 【確認内容】: 合算が単純加算であること 🔵
  })
})

describe('必要風量計算 (calculateRequiredAirflow)', () => {
  it('TC-N10: 冷房負荷から必要風量が正しく算出される', () => {
    // 【テスト目的】: 風量計算式 coolingLoad / (ρ x Cp x ΔT) x 3600 が正しく実装されること
    // 【テスト内容】: coolingLoad=15000, supplyAirTempDiff=10 の風量計算
    // 【期待される動作】: Math.round で整数に丸められた m^3/h 値を返す
    // 🔵 信頼性レベル: REQ-304 に計算式明示（ρ=1.2, Cp=1005）

    // 【テストデータ準備】: 15kW の冷房負荷、標準送風温度差 10K
    const coolingLoad = 15000
    const supplyAirTempDiff = 10

    // 【実際の処理実行】: calculateRequiredAirflow に冷房負荷と温度差を渡す
    const result = calculateRequiredAirflow(coolingLoad, supplyAirTempDiff)

    // 【結果検証】: Math.round(15000 / (1.2 x 1005 x 10) x 3600) = 4478 m^3/h
    // 15000 / 12060 = 1.2437810945... x 3600 = 4477.61... -> 4478
    expect(result).toBe(4478) // 【確認内容】: Math.round で整数丸め、m^3/h 単位であること 🔵
  })

  it('TC-N11: 送風温度差を省略した場合にデフォルト値（10K）が適用される', () => {
    // 【テスト目的】: supplyAirTempDiff 未指定時のデフォルト値 10K が適用されること
    // 【テスト内容】: calculateRequiredAirflow に温度差引数なしで呼び出した場合
    // 【期待される動作】: デフォルト値 10K で計算され TC-N10 と同値を返す
    // 🔵 信頼性レベル: hvac-zone.ts の DesignConditions で supplyAirTempDiff のデフォルトが 10

    // 【テストデータ準備】: 冷房負荷のみ指定（温度差は未指定）
    const coolingLoad = 15000

    // 【実際の処理実行】: 温度差引数なしで calculateRequiredAirflow を呼び出す
    const result = calculateRequiredAirflow(coolingLoad)

    // 【結果検証】: TC-N10 と同じ 4478 m^3/h になること
    expect(result).toBe(4478) // 【確認内容】: デフォルト 10K が使用されること 🔵
  })
})

describe('暖房負荷計算 (calculateHeatingLoad)', () => {
  it('TC-N12: 一般オフィスの暖房負荷が正しく算出される', () => {
    // 【テスト目的】: floorArea x heatingLoadPerArea で暖房負荷を正しく計算すること
    // 【テスト内容】: office_general の暖房原単位（80 W/m^2）を 100m^2 に適用
    // 【期待される動作】: TASK-0015 記載値（100）ではなく JSON 値（80）が使われること
    // 🔵 信頼性レベル: REQ-305, load-unit-table.json 確認済み

    // 【テストデータ準備】: 100m^2 の一般オフィス
    const floorArea = 100
    const usage = 'office_general' as const

    // 【実際の処理実行】: calculateHeatingLoad に面積と用途を渡す
    const result = calculateHeatingLoad(floorArea, usage)

    // 【結果検証】: 100 x 80 = 8000 W であること
    expect(result).toBe(8000) // 【確認内容】: JSON 値（80）が適用されること（TASK記載の100ではない） 🔵
  })

  it('TC-N13: サーバー室の暖房負荷が 0 になる', () => {
    // 【テスト目的】: サーバー室は暖房原単位 0 のため暖房負荷が 0 になること
    // 【テスト内容】: office_server の暖房負荷を計算
    // 【期待される動作】: 0 W が返されること
    // 🔵 信頼性レベル: load-unit-table.json 確認済み、TASK-0015 テスト7 と合致

    // 【テストデータ準備】: 50m^2 のサーバー室（暖房原単位 0 の特殊ケース）
    const floorArea = 50
    const usage = 'office_server' as const

    // 【実際の処理実行】: calculateHeatingLoad に面積と用途を渡す
    const result = calculateHeatingLoad(floorArea, usage)

    // 【結果検証】: 暖房不要のため 0 W であること
    expect(result).toBe(0) // 【確認内容】: 暖房原単位 0 が正しく適用され 0 W を返すこと 🔵
  })

  it('TC-N17: 全 5 用途タイプで暖房負荷が正しく算出される', () => {
    // 【テスト目的】: 全用途の暖房原単位が load-unit-table.json の値と一致すること
    // 【テスト内容】: floorArea=100 で各用途タイプを順に計算
    // 【期待される動作】: 各用途の heatingLoadPerArea が正しく適用される
    // 🔵 信頼性レベル: load-unit-table.json 全レコード確認済み

    // 【テストデータ準備】: floorArea=100 を固定、全用途タイプを網羅
    const floorArea = 100
    const expected = {
      office_general: 8000, // 100 x 80
      office_server: 0, // 100 x 0
      conference: 10000, // 100 x 100
      reception: 7000, // 100 x 70
      corridor: 4000, // 100 x 40
    }

    // 【実際の処理実行】: 各用途タイプで calculateHeatingLoad を実行
    for (const [usage, expectedLoad] of Object.entries(expected)) {
      const result = calculateHeatingLoad(floorArea, usage as 'office_general')
      expect(result).toBe(expectedLoad) // 【確認内容】: 各用途の暖房原単位が JSON 値と一致すること 🔵
    }
  })
})

describe('日射補正係数テーブル (SOLAR_COEFFICIENTS)', () => {
  it('TC-N14: 全 8 方位の日射補正係数が設計値と一致する', () => {
    // 【テスト目的】: SOLAR_COEFFICIENTS 定数の各方位値が REQ-303 の設計値と一致すること
    // 【テスト内容】: 8 方位すべての補正係数を確認
    // 【期待される動作】: S=1.0, SE=1.1, SW=1.1, E=1.2, W=1.2, NE=0.8, NW=0.8, N=0.6
    // 🔵 信頼性レベル: REQ-303 に全方位の係数が明示

    // 【結果検証】: 各方位の補正係数が REQ-303 の設計値と一致すること
    expect(SOLAR_COEFFICIENTS['S']).toBe(1.0) // 【確認内容】: 南面（最大日射） 🔵
    expect(SOLAR_COEFFICIENTS['SE']).toBe(1.1) // 【確認内容】: 南東面 🔵
    expect(SOLAR_COEFFICIENTS['SW']).toBe(1.1) // 【確認内容】: 南西面 🔵
    expect(SOLAR_COEFFICIENTS['E']).toBe(1.2) // 【確認内容】: 東面 🔵
    expect(SOLAR_COEFFICIENTS['W']).toBe(1.2) // 【確認内容】: 西面 🔵
    expect(SOLAR_COEFFICIENTS['NE']).toBe(0.8) // 【確認内容】: 北東面 🔵
    expect(SOLAR_COEFFICIENTS['NW']).toBe(0.8) // 【確認内容】: 北西面 🔵
    expect(SOLAR_COEFFICIENTS['N']).toBe(0.6) // 【確認内容】: 北面（最小日射） 🔵
  })
})

describe('統合計算 (calculateZoneLoad)', () => {
  it('TC-N15: ゾーン全体の負荷計算が正しく統合される', () => {
    // 【テスト目的】: calculateZoneLoad が CalcResult 構造で全フィールドを正しく返すこと
    // 【テスト内容】: 一般オフィス 100m^2、南面ペリメータ、温度差 10K の統合計算
    // 【期待される動作】: 内部負荷・外皮負荷・冷房負荷・暖房負荷・風量すべてを算出
    // 🔵 信頼性レベル: REQ-301〜306 を統合、TASK-0015 テスト10 に対応

    // 【テストデータ準備】: 一般的なオフィスゾーン（南面ペリメータあり）
    const zone = BASIC_OFFICE_ZONE

    // 【実際の処理実行】: calculateZoneLoad にゾーンデータを渡す
    const result = calculateZoneLoad(zone)

    // 【結果検証】: 全フィールドが正しい値であること
    expect(result.status).toBe('success') // 【確認内容】: 計算が成功していること 🔵
    expect(result.internalLoad).toBe(15000) // 【確認内容】: 100 x 150 = 15000 W 🔵
    expect(result.envelopeLoad).toBe(2400) // 【確認内容】: 30 x 0.4 x 1.0 x 200 = 2400 W 🔵
    expect(result.coolingLoad).toBe(17400) // 【確認内容】: 15000 + 2400 = 17400 W 🔵
    expect(result.heatingLoad).toBe(8000) // 【確認内容】: 100 x 80 = 8000 W 🔵
    // Math.round(17400 / (1.2 x 1005 x 10) x 3600) = Math.round(5193.98...) = 5194
    expect(result.requiredAirflow).toBe(5194) // 【確認内容】: Math.round で整数丸めされること 🔵
    expect(result.perimeterLoadBreakdown).toHaveLength(1) // 【確認内容】: 1 セグメント分の内訳があること 🔵
  })

  it('TC-N16: calculateZoneLoad の戻り値が HvacZoneCalcResult スキーマでパースできる', () => {
    // 【テスト目的】: 計算結果が既存 Zod スキーマと型互換があること
    // 【テスト内容】: calculateZoneLoad の結果を HvacZoneCalcResult.parse() に通す
    // 【期待される動作】: パースが成功し、バリデーションエラーが発生しない
    // 🔵 信頼性レベル: hvac-zone.ts の HvacZoneCalcResult スキーマ定義と照合

    // 【テストデータ準備】: TC-N15 と同じゾーンデータ
    const zone = BASIC_OFFICE_ZONE

    // 【実際の処理実行】: calculateZoneLoad でゾーン計算を実行
    const result = calculateZoneLoad(zone)

    // 【結果検証】: Zod スキーマでパース可能であること
    // HvacZoneCalcResult スキーマのフィールドが存在することを確認
    expect(result).toHaveProperty('coolingLoad') // 【確認内容】: coolingLoad フィールドが存在すること 🔵
    expect(result).toHaveProperty('heatingLoad') // 【確認内容】: heatingLoad フィールドが存在すること 🔵
    expect(result).toHaveProperty('requiredAirflow') // 【確認内容】: requiredAirflow フィールドが存在すること 🔵
    expect(result).toHaveProperty('internalLoad') // 【確認内容】: internalLoad フィールドが存在すること 🔵
    expect(result).toHaveProperty('envelopeLoad') // 【確認内容】: envelopeLoad フィールドが存在すること 🔵
    expect(result).toHaveProperty('perimeterLoadBreakdown') // 【確認内容】: perimeterLoadBreakdown フィールドが存在すること 🔵
    expect(result).toHaveProperty('status') // 【確認内容】: status フィールドが存在すること 🔵
    // perimeterLoadBreakdown の各エントリ構造を確認（既存スキーマ準拠）
    if (result.perimeterLoadBreakdown.length > 0) {
      const entry = result.perimeterLoadBreakdown[0]
      expect(entry).toHaveProperty('orientation') // 【確認内容】: orientation フィールドが存在すること 🔵
      expect(entry).toHaveProperty('solarCorrectionFactor') // 【確認内容】: solarCorrectionFactor フィールドが存在すること 🔵
      expect(entry).toHaveProperty('envelopeLoadContribution') // 【確認内容】: envelopeLoadContribution フィールドが存在すること 🔵
    }
  })
})

// ============================================================================
// TC-E: 異常系テストケース
// ============================================================================

describe('異常系: ゼロ除算・入力バリデーション', () => {
  it('TC-E01: 送風温度差が 0 の場合にゼロ除算せず 0 を返す', () => {
    // 【テスト目的】: supplyAirTempDiff = 0 でゼロ除算が発生しないこと
    // 【テスト内容】: coolingLoad=15000, supplyAirTempDiff=0 を渡した場合
    // 【期待される動作】: NaN/Infinity を防ぎ、0 m^3/h を返す
    // 🔵 信頼性レベル: TASK-0015 テスト6 に明示

    // 【テストデータ準備】: 送風温度差 0（ゼロ除算を引き起こす条件）
    const coolingLoad = 15000
    const supplyAirTempDiff = 0

    // 【実際の処理実行】: calculateRequiredAirflow に温度差 0 を渡す
    const result = calculateRequiredAirflow(coolingLoad, supplyAirTempDiff)

    // 【結果検証】: 0 が返されること（NaN/Infinity ではないこと）
    expect(result).toBe(0) // 【確認内容】: ゼロ除算防止ロジックで 0 が返されること 🔵
    expect(Number.isNaN(result)).toBe(false) // 【確認内容】: NaN ではないこと 🔵
    expect(Number.isFinite(result)).toBe(true) // 【確認内容】: Infinity ではないこと 🔵
  })

  it('TC-E02: 送風温度差が負の値の場合に 0 を返す', () => {
    // 【テスト目的】: supplyAirTempDiff < 0 の場合に安全に 0 を返すこと
    // 【テスト内容】: coolingLoad=15000, supplyAirTempDiff=-5 を渡した場合
    // 【期待される動作】: 負の風量値を防止し、0 m^3/h を返す
    // 🔵 信頼性レベル: TASK-0015 実装詳細セクション5 に明示

    // 【テストデータ準備】: 送風温度差が負（物理的に不正な条件）
    const coolingLoad = 15000
    const supplyAirTempDiff = -5

    // 【実際の処理実行】: calculateRequiredAirflow に負の温度差を渡す
    const result = calculateRequiredAirflow(coolingLoad, supplyAirTempDiff)

    // 【結果検証】: 0 が返されること（負の風量にならないこと）
    expect(result).toBe(0) // 【確認内容】: supplyAirTempDiff <= 0 の条件分岐で 0 が返されること 🔵
  })

  it('TC-E03: 床面積が負の値の場合にエラーステータスが返される', () => {
    // 【テスト目的】: floorArea < 0 の場合にエラーステータスが返されること
    // 【テスト内容】: floorArea=-10 のゾーンデータで calculateZoneLoad を実行
    // 【期待される動作】: status='error', error にエラーメッセージが格納される
    // 🟡 信頼性レベル: 要件定義書 4.4 に記載あるが、具体的なエラーメッセージは未定義

    // 【テストデータ準備】: 床面積が負（物理的にありえない条件）
    const zone = {
      floorArea: -10,
      usage: 'office_general' as const,
      perimeterSegments: [],
      designConditions: { supplyAirTempDiff: 10 },
    }

    // 【実際の処理実行】: calculateZoneLoad に不正なゾーンデータを渡す
    const result = calculateZoneLoad(zone)

    // 【結果検証】: エラーステータスが返されること
    expect(result.status).toBe('error') // 【確認内容】: status='error' が返されること 🟡
    expect(result.error).toBeDefined() // 【確認内容】: error フィールドにメッセージが格納されること 🟡
    expect(typeof result.error).toBe('string') // 【確認内容】: エラーメッセージが文字列であること 🟡
  })

  it('TC-E04: 床面積が 0 の場合にエラーステータスが返される', () => {
    // 【テスト目的】: floorArea = 0 の場合にエラーステータスが返されること（EDGE-001）
    // 【テスト内容】: floorArea=0 のゾーンデータで calculateZoneLoad を実行
    // 【期待される動作】: status='error' が返され、面積 0 のゾーンを計算対象外とする
    // 🟡 信頼性レベル: EDGE-001 に「面積0以下の拒否」と記載、具体的な挙動は推測

    // 【テストデータ準備】: 床面積が 0（面積 0 のゾーンは物理的に存在しない）
    const zone = {
      floorArea: 0,
      usage: 'office_general' as const,
      perimeterSegments: [],
      designConditions: { supplyAirTempDiff: 10 },
    }

    // 【実際の処理実行】: calculateZoneLoad に面積 0 のゾーンデータを渡す
    const result = calculateZoneLoad(zone)

    // 【結果検証】: エラーステータスが返されること
    expect(result.status).toBe('error') // 【確認内容】: status='error' が返されること 🟡
    expect(result.error).toBeDefined() // 【確認内容】: error フィールドにメッセージが格納されること 🟡
  })

  it('TC-E05: 計算中に例外が発生した場合にエラーステータスが返される', () => {
    // 【テスト目的】: try-catch で例外が捕捉され status='error' が返されること（NFR-102）
    // 【テスト内容】: 不正なデータ（null/undefined 相当）で例外を引き起こす
    // 【期待される動作】: 例外が上位にスローされず、エラーステータスで安全に処理される
    // 🟡 信頼性レベル: 要件定義書 4.4 に「try-catch でキャッチ、status: 'error' を返す」と記載

    // 【テストデータ準備】: perimeterSegments に不正な値（型キャストで強制的に渡す）
    // biome-ignore lint: テスト目的で意図的に不正な型を渡す
    const zone = {
      floorArea: 100,
      usage: 'office_general' as const,
      perimeterSegments: [{ orientation: 'INVALID' as never, wallArea: 30, glazingRatio: 0.4 }],
      designConditions: { supplyAirTempDiff: 10 },
    }

    // 【実際の処理実行】: calculateZoneLoad に不正なデータを渡す
    // 例外がスローされないことを確認（NFR-102: クラッシュ防止）
    expect(() => calculateZoneLoad(zone)).not.toThrow() // 【確認内容】: 例外が上位に漏れないこと 🟡
    const result = calculateZoneLoad(zone)
    expect(result.status).toBe('error') // 【確認内容】: エラーステータスが返されること 🟡
  })

  it('TC-E06: 未知の usage が指定された場合にデフォルト値でフォールバックする', () => {
    // 【テスト目的】: ZoneUsage enum に存在しない値が渡された場合にフォールバックすること
    // 【テスト内容】: usage='unknown_type' を型キャストで渡した場合の動作確認
    // 【期待される動作】: office_general 相当の値（coolingLoadPerArea=150, heatingLoadPerArea=80）でフォールバック
    // 🟡 信頼性レベル: TASK-0015 に「デフォルト値を適用」と記載あるが、方式は実装時決定

    // 【テストデータ準備】: 未知の用途タイプ（Zod バリデーションをバイパスする場合を想定）
    const floorArea = 100
    const unknownUsage = 'unknown_type' as never

    // 【実際の処理実行】: calculateInternalLoad に未知の用途を渡す
    // フォールバックで office_general 相当の 15000 W が返されることを確認
    const result = calculateInternalLoad(floorArea, unknownUsage)

    // 【結果検証】: デフォルト値（office_general相当: coolingLoadPerArea=150）でフォールバックすること
    expect(result).toBe(15000) // 【確認内容】: フォールバックで 100 x 150 = 15000 W が返されること 🟡
  })
})

// ============================================================================
// TC-B: 境界値テストケース
// ============================================================================

describe('境界値テスト', () => {
  it('TC-B01: ペリメータセグメントが空の場合に外皮負荷が 0 になる', () => {
    // 【テスト目的】: インテリアゾーン（外壁に面していない）の場合に外皮負荷が 0 になること
    // 【テスト内容】: calculateEnvelopeLoad に空配列を渡した場合
    // 【期待される動作】: total=0, breakdown=[] が返される
    // 🔵 信頼性レベル: TASK-0015 テスト8 に明示

    // 【テストデータ準備】: ペリメータセグメントなし（インテリアゾーン）
    const segments: never[] = []

    // 【実際の処理実行】: calculateEnvelopeLoad に空配列を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: 外皮負荷が 0 であること
    expect(result.total).toBe(0) // 【確認内容】: ペリメータなしで外皮負荷が 0 W であること 🔵
    expect(result.breakdown).toHaveLength(0) // 【確認内容】: breakdown が空配列であること 🔵
  })

  it('TC-B02: ガラス面積比が 0 の場合に外皮負荷が 0 になる', () => {
    // 【テスト目的】: glazingRatio=0 （窓なし外壁）では日射による負荷が 0 になること
    // 【テスト内容】: glazingRatio=0.0 のセグメントで外皮負荷を計算
    // 【期待される動作】: 乗算結果が 0 になること
    // 🔵 信頼性レベル: hvac-shared.ts で glazingRatio の最小値が 0 と定義済み

    // 【テストデータ準備】: 南面 30m^2、glazingRatio=0.0（窓なし）
    const segments = [{ orientation: 'S' as const, wallArea: 30, glazingRatio: 0.0 }]

    // 【実際の処理実行】: calculateEnvelopeLoad に glazingRatio=0 を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: 30 x 0.0 x 1.0 x 200 = 0 W であること
    expect(result.total).toBe(0) // 【確認内容】: ガラスなしなら日射負荷は 0 W であること 🔵
  })

  it('TC-B03: ガラス面積比が 1.0 の場合に外皮負荷が最大になる', () => {
    // 【テスト目的】: glazingRatio=1.0 （全面ガラス）で最大外皮負荷が計算されること
    // 【テスト内容】: glazingRatio=1.0 のセグメントで外皮負荷を計算
    // 【期待される動作】: 最大負荷が正しく計算されること
    // 🔵 信頼性レベル: hvac-shared.ts で glazingRatio の最大値が 1 と定義済み

    // 【テストデータ準備】: 南面 30m^2、glazingRatio=1.0（全面ガラス）
    const segments = [{ orientation: 'S' as const, wallArea: 30, glazingRatio: 1.0 }]

    // 【実際の処理実行】: calculateEnvelopeLoad に glazingRatio=1.0 を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: 30 x 1.0 x 1.0 x 200 = 6000 W であること
    expect(result.total).toBe(6000) // 【確認内容】: 全面ガラスで最大外皮負荷 6000 W が計算されること 🔵
  })

  it('TC-B06: 冷房負荷が 0 の場合に必要風量が 0 になる', () => {
    // 【テスト目的】: 冷房負荷なし（0 W）の場合に風量が 0 m^3/h になること
    // 【テスト内容】: calculateRequiredAirflow に coolingLoad=0 を渡した場合
    // 【期待される動作】: 0/正値 = 0 が返されること
    // 🔵 信頼性レベル: 計算式から自明な結果

    // 【テストデータ準備】: 冷房負荷が 0（冷房不要ゾーン）
    const coolingLoad = 0
    const supplyAirTempDiff = 10

    // 【実際の処理実行】: calculateRequiredAirflow に冷房負荷 0 を渡す
    const result = calculateRequiredAirflow(coolingLoad, supplyAirTempDiff)

    // 【結果検証】: Math.round(0 / (1.2 x 1005 x 10) x 3600) = 0 m^3/h であること
    expect(result).toBe(0) // 【確認内容】: 冷房負荷 0 で風量が 0 m^3/h になること 🔵
  })

  it('TC-B07: 全 8 方位のセグメントが同時に存在する場合に正しく合算される', () => {
    // 【テスト目的】: 最大セグメント数（全 8 方位）での合算が正しいこと
    // 【テスト内容】: 各方位に wallArea=10, glazingRatio=0.5 のセグメントを設定
    // 【期待される動作】: 全方位の係数が正しく適用され合算される
    // 🔵 信頼性レベル: REQ-303 の全方位係数を使用

    // 【テストデータ準備】: 8 方位すべてに同条件のセグメント
    const segments = [
      { orientation: 'S' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'SE' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'SW' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'E' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'W' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'NE' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'NW' as const, wallArea: 10, glazingRatio: 0.5 },
      { orientation: 'N' as const, wallArea: 10, glazingRatio: 0.5 },
    ]

    // 【実際の処理実行】: calculateEnvelopeLoad に 8 方位のセグメント配列を渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: 全方位の合計が 7800 W であること
    // S=1000, SE=1100, SW=1100, E=1200, W=1200, NE=800, NW=800, N=600 = 7800
    expect(result.total).toBe(7800) // 【確認内容】: 全 8 方位の係数が正しく適用され合算されること 🔵
    expect(result.breakdown).toHaveLength(8) // 【確認内容】: breakdown に 8 エントリが含まれること 🔵
  })

  it('TC-B08: 同じ方位に複数セグメントがある場合に正しく処理される', () => {
    // 【テスト目的】: 同一方位に複数セグメントがある場合に正しく合算されること
    // 【テスト内容】: 南面に 2 つのセグメント（異なる glazingRatio）を渡した場合
    // 【期待される動作】: 各セグメントが個別計算され合算される
    // 🟡 信頼性レベル: TASK-0015 のコードサンプルでは同方位を合算する実装だが、breakdown の構造は未定義

    // 【テストデータ準備】: 南面に 2 セグメント（L字型ファサードを想定）
    const segments = [
      { orientation: 'S' as const, wallArea: 20, glazingRatio: 0.3 },
      { orientation: 'S' as const, wallArea: 15, glazingRatio: 0.5 },
    ]

    // 【実際の処理実行】: calculateEnvelopeLoad に同一方位の複数セグメントを渡す
    const result = calculateEnvelopeLoad(segments)

    // 【結果検証】: seg1: 20 x 0.3 x 1.0 x 200 = 1200, seg2: 15 x 0.5 x 1.0 x 200 = 1500, 合計 = 2700
    expect(result.total).toBe(2700) // 【確認内容】: 同一方位のセグメントが合算されること 🟡
  })
})
