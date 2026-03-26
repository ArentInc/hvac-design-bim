/**
 * TASK-0021: EquipmentSelectionSystem — AHU候補選定ロジック 単体テスト
 *
 * テスト対象: equipment-selection.ts の純粋関数
 *   - filterAhuCandidates: 容量・風量フィルタ
 *   - sortAhuCandidates: 容量過不足順ソート
 *   - selectEquipment: 統合選定処理
 *
 * 単位: coolingCapacity は kW、airflowRate は m3/h、totalCoolingLoadKw は kW
 *
 * テストフレームワーク: Vitest (packages/core/vitest.config.ts)
 */

import { describe, expect, it } from 'vitest'
import type { AhuCatalogEntry } from '../equipment-selection'
import {
  DEFAULT_SELECTION_MARGIN,
  filterAhuCandidates,
  selectEquipment,
  sortAhuCandidates,
} from '../equipment-selection'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const makeEntry = (
  modelId: string,
  coolingCapacity: number,
  airflowRate: number,
): AhuCatalogEntry => ({
  modelId,
  modelName: modelId,
  coolingCapacity,
  heatingCapacity: coolingCapacity * 0.7,
  airflowRate,
  staticPressure: 300,
})

// ============================================================================
// filterAhuCandidates テスト
// ============================================================================

describe('filterAhuCandidates', () => {
  it('テスト1: 容量条件を満たす候補のみ残る（余裕率1.1適用）', () => {
    // Given: カタログに3機種（50kW/80kW/120kW）、合算負荷70kW、余裕率1.1
    // 必要容量 = 70 x 1.1 = 77kW → 50kW は除外、80kW と 120kW が残る
    const catalog = [
      makeEntry('AHU-50', 50, 20000),
      makeEntry('AHU-80', 80, 20000),
      makeEntry('AHU-120', 120, 20000),
    ]
    const result = filterAhuCandidates(catalog, 70, 10000, 1.1)
    expect(result.map((e) => e.modelId)).toEqual(['AHU-80', 'AHU-120'])
  })

  it('テスト2: 風量条件フィルタ', () => {
    // Given: 容量は全機種OK、風量が10000/15000/20000 m3/h、必要風量12000 m3/h、余裕率1.1
    // 必要風量 = 12000 x 1.1 = 13200 → 10000 は除外
    const catalog = [
      makeEntry('AHU-A', 200, 10000),
      makeEntry('AHU-B', 200, 15000),
      makeEntry('AHU-C', 200, 20000),
    ]
    const result = filterAhuCandidates(catalog, 50, 12000, 1.1)
    expect(result.map((e) => e.modelId)).toEqual(['AHU-B', 'AHU-C'])
  })

  it('テスト7: 容量・風量の複合フィルタ', () => {
    // 機種A: 容量OK, 風量NG / 機種B: 容量NG, 風量OK / 機種C: 両方OK
    const catalog = [
      makeEntry('AHU-A', 100, 5000), // 容量OK (>=77), 風量NG (<13200)
      makeEntry('AHU-B', 50, 20000), // 容量NG (<77), 風量OK
      makeEntry('AHU-C', 100, 20000), // 両方OK
    ]
    const result = filterAhuCandidates(catalog, 70, 12000, 1.1)
    expect(result.map((e) => e.modelId)).toEqual(['AHU-C'])
  })
})

// ============================================================================
// sortAhuCandidates テスト
// ============================================================================

describe('sortAhuCandidates', () => {
  it('テスト3: 容量過不足の少ない順にソートされる', () => {
    // Given: 候補が80kW, 120kW, 100kW、合算負荷70kW、余裕率1.1 → 必要容量77kW
    // 余剰: 80-77=3, 120-77=43, 100-77=23 → 80 → 100 → 120 の順
    const candidates = [
      makeEntry('AHU-80', 80, 20000),
      makeEntry('AHU-120', 120, 20000),
      makeEntry('AHU-100', 100, 20000),
    ]
    const result = sortAhuCandidates(candidates, 70, 1.1)
    expect(result.map((e) => e.modelId)).toEqual(['AHU-80', 'AHU-100', 'AHU-120'])
  })
})

// ============================================================================
// selectEquipment テスト
// ============================================================================

describe('selectEquipment', () => {
  it('テスト4: デフォルト余裕率1.1が適用される', () => {
    // DEFAULT_SELECTION_MARGIN が 1.1 であること
    expect(DEFAULT_SELECTION_MARGIN).toBe(1.1)

    // 合算負荷70kW、余裕率1.1 → 77kW 以上が必要
    const catalog = [makeEntry('AHU-80', 80, 20000), makeEntry('AHU-50', 50, 20000)]
    const result = selectEquipment(70, 10000, DEFAULT_SELECTION_MARGIN, catalog)
    expect(result.selectionStatus).toBe('candidates-available')
    expect(result.equipmentCandidates).toContain('AHU-80')
    expect(result.equipmentCandidates).not.toContain('AHU-50')
  })

  it('テスト5: ユーザー指定余裕率が適用される', () => {
    // selectionMargin = 1.2 の場合: 70 x 1.2 = 84kW 以上が必要
    const catalog = [makeEntry('AHU-80', 80, 20000), makeEntry('AHU-90', 90, 20000)]
    const result = selectEquipment(70, 10000, 1.2, catalog)
    // 80kW < 84kW → 除外、90kW >= 84kW → 候補
    expect(result.equipmentCandidates).not.toContain('AHU-80')
    expect(result.equipmentCandidates).toContain('AHU-90')
  })

  it('テスト6: 候補なしの場合 selectionStatus が no-candidates になる', () => {
    // カタログの最大容量50kW、合算負荷100kW → 全て除外
    const catalog = [makeEntry('AHU-50', 50, 20000)]
    const result = selectEquipment(100, 10000, 1.1, catalog)
    expect(result.selectionStatus).toBe('no-candidates')
    expect(result.equipmentCandidates).toHaveLength(0)
    expect(result.recommendedEquipmentId).toBeNull()
  })

  it('候補ありの場合 recommendedEquipmentId が最適候補（余剰最小）に設定される', () => {
    const catalog = [makeEntry('AHU-120', 120, 20000), makeEntry('AHU-80', 80, 20000)]
    const result = selectEquipment(70, 10000, 1.1, catalog)
    // 余剰: AHU-80=3kW, AHU-120=43kW → AHU-80 が推奨
    expect(result.recommendedEquipmentId).toBe('AHU-80')
  })
})
