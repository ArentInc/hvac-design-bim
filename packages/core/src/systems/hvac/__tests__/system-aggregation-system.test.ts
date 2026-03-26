/**
 * TASK-0019: SystemAggregationSystem — 系統集計計算 単体テスト
 *
 * テスト対象: system-aggregation.ts の純粋関数
 *   - aggregateSystemLoad: servedZoneIds から負荷を合算
 *   - findSystemsForZone: ゾーンを含む SystemNode を検索
 *
 * テストフレームワーク: Vitest (packages/core/vitest.config.ts)
 */

import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../../schema/types'
import { aggregateSystemLoad, findSystemsForZone } from '../system-aggregation'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const makeZone = (
  id: string,
  calcResult: { coolingLoad: number; heatingLoad: number; requiredAirflow: number } | null,
): AnyNode =>
  ({
    object: 'node',
    id,
    type: 'hvac_zone',
    zoneName: `Zone ${id}`,
    usage: 'office_general',
    floorArea: 100,
    ceilingHeight: 2.7,
    occupantDensity: 0.15,
    boundary: [],
    designConditions: {
      coolingSetpoint: 26,
      heatingSetpoint: 22,
      relativeHumidity: 50,
      supplyAirTempDiff: 10,
    },
    perimeterSegments: [],
    systemId: null,
    calcResult: calcResult
      ? {
          ...calcResult,
          internalLoad: 0,
          envelopeLoad: 0,
          perimeterLoadBreakdown: [],
          status: 'success' as const,
        }
      : null,
    parentId: null,
    visible: true,
    metadata: {},
  }) as AnyNode

const makeSystem = (id: string, servedZoneIds: string[]): AnyNode =>
  ({
    object: 'node',
    id,
    type: 'system',
    systemName: `System ${id}`,
    servedZoneIds,
    ahuId: null,
    aggregatedLoad: null,
    status: 'draft' as const,
    selectionMargin: 1.1,
    equipmentCandidates: [],
    selectionStatus: 'pending' as const,
    recommendedEquipmentId: undefined,
    parentId: null,
    visible: true,
    metadata: {},
  }) as AnyNode

// ============================================================================
// aggregateSystemLoad テスト
// ============================================================================

describe('aggregateSystemLoad', () => {
  it('テスト1: 冷房負荷合算の正確性', () => {
    const nodes: Record<string, AnyNode> = {
      zone1: makeZone('zone1', { coolingLoad: 10, heatingLoad: 8, requiredAirflow: 1000 }),
      zone2: makeZone('zone2', { coolingLoad: 15, heatingLoad: 12, requiredAirflow: 1500 }),
      zone3: makeZone('zone3', { coolingLoad: 20, heatingLoad: 16, requiredAirflow: 2000 }),
    }
    const result = aggregateSystemLoad(['zone1', 'zone2', 'zone3'], nodes)
    expect(result.totalCoolingLoad).toBe(45)
  })

  it('テスト2: 暖房負荷合算の正確性', () => {
    const nodes: Record<string, AnyNode> = {
      zone1: makeZone('zone1', { coolingLoad: 10, heatingLoad: 8, requiredAirflow: 1000 }),
      zone2: makeZone('zone2', { coolingLoad: 15, heatingLoad: 12, requiredAirflow: 1500 }),
      zone3: makeZone('zone3', { coolingLoad: 20, heatingLoad: 16, requiredAirflow: 2000 }),
    }
    const result = aggregateSystemLoad(['zone1', 'zone2', 'zone3'], nodes)
    expect(result.totalHeatingLoad).toBe(36)
  })

  it('テスト3: 必要風量合算の正確性', () => {
    const nodes: Record<string, AnyNode> = {
      zone1: makeZone('zone1', { coolingLoad: 10, heatingLoad: 8, requiredAirflow: 1000 }),
      zone2: makeZone('zone2', { coolingLoad: 15, heatingLoad: 12, requiredAirflow: 1500 }),
      zone3: makeZone('zone3', { coolingLoad: 20, heatingLoad: 16, requiredAirflow: 2000 }),
    }
    const result = aggregateSystemLoad(['zone1', 'zone2', 'zone3'], nodes)
    expect(result.totalAirflow).toBe(4500)
  })

  it('テスト4: 存在しないゾーンIDは0として扱う', () => {
    const nodes: Record<string, AnyNode> = {
      zone1: makeZone('zone1', { coolingLoad: 10, heatingLoad: 8, requiredAirflow: 1000 }),
    }
    const result = aggregateSystemLoad(['zone1', 'nonexistent_zone_xxx'], nodes)
    expect(result.totalCoolingLoad).toBe(10)
    expect(result.totalHeatingLoad).toBe(8)
    expect(result.totalAirflow).toBe(1000)
  })

  it('テスト5: calcResultがnullのゾーンは0として扱う', () => {
    const nodes: Record<string, AnyNode> = {
      zone1: makeZone('zone1', null),
      zone2: makeZone('zone2', { coolingLoad: 20, heatingLoad: 16, requiredAirflow: 2000 }),
    }
    const result = aggregateSystemLoad(['zone1', 'zone2'], nodes)
    expect(result.totalCoolingLoad).toBe(20)
    expect(result.totalHeatingLoad).toBe(16)
    expect(result.totalAirflow).toBe(2000)
  })

  it('テスト6: 空のservedZoneIdsは全て0', () => {
    const result = aggregateSystemLoad([], {})
    expect(result.totalCoolingLoad).toBe(0)
    expect(result.totalHeatingLoad).toBe(0)
    expect(result.totalAirflow).toBe(0)
  })
})

// ============================================================================
// findSystemsForZone テスト
// ============================================================================

describe('findSystemsForZone', () => {
  it('ゾーンを含む複数の SystemNode ID を返す', () => {
    const nodes: Record<string, AnyNode> = {
      sys1: makeSystem('sys1', ['zone1', 'zone2']),
      sys2: makeSystem('sys2', ['zone2', 'zone3']),
      sys3: makeSystem('sys3', ['zone4']),
    }
    const result = findSystemsForZone('zone2', nodes)
    expect(result).toContain('sys1')
    expect(result).toContain('sys2')
    expect(result).not.toContain('sys3')
    expect(result).toHaveLength(2)
  })

  it('ゾーンを含む SystemNode が存在しない場合は空配列', () => {
    const nodes: Record<string, AnyNode> = {
      sys1: makeSystem('sys1', ['zone1']),
    }
    const result = findSystemsForZone('zone99', nodes)
    expect(result).toHaveLength(0)
  })

  it('ゾーン負荷変更時: 関連する SystemNode が再集計対象として検出される', () => {
    // Given: ゾーンAが系統1に属している
    const nodes: Record<string, AnyNode> = {
      zoneA: makeZone('zoneA', { coolingLoad: 10, heatingLoad: 8, requiredAirflow: 1000 }),
      sys1: makeSystem('sys1', ['zoneA', 'zoneB']),
    }
    // When: zoneA が dirty になった時に関連する SystemNode を検索
    const systemIds = findSystemsForZone('zoneA', nodes)
    // Then: sys1 が再集計対象として検出される
    expect(systemIds).toContain('sys1')
  })
})
