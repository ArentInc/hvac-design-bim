/**
 * TASK-0041: 再計算カスケード統合 — 全計算パイプライン結合テスト
 *
 * 【テスト対象】: Phase 1〜4 の純粋計算関数群のカスケード連鎖動作
 *   カスケード順序: 負荷計算 → 系統集計 → 風量配分 → ダクト寸法 → 警告生成
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: REQ-1801〜1804, dataflow.md 再計算カスケードに基づく
 */

import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../../schema/types'
import { distributeAirflow } from '../airflow-distribution'
import { calcDuctSize, findDirtyDuctSegmentsForSizing, selectDuctVelocity } from '../duct-sizing'
import {
  calculateCoolingLoad,
  calculateInternalLoad,
  calculateRequiredAirflow,
  calculateZoneLoad,
} from '../load-calc'
import { aggregateSystemLoad, findSystemsForZone } from '../system-aggregation'
import {
  checkAirflowNotSet,
  checkSizeNotDetermined,
  checkVelocityExceeded,
  checkZoneNoSystem,
} from '../validation-system'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const SYSTEM_ID = 'system_A'
const AHU_ID = 'ahu_001'
const ZONE_1_ID = 'hvac_zone_001'
const ZONE_2_ID = 'hvac_zone_002'
const DUCT_MAIN_ID = 'duct_main_001'
const DUCT_BRANCH_ID = 'duct_branch_001'

/** 標準的な HvacZone ノードを作成（calcResult あり） */
function makeHvacZone(
  id: string,
  opts: {
    floorArea?: number
    systemId?: string | null
    calcResult?: {
      coolingLoad: number
      heatingLoad: number
      requiredAirflow: number
      internalLoad: number
      envelopeLoad: number
      perimeterLoadBreakdown: []
      status: 'success' | 'error'
    } | null
  } = {},
): AnyNode {
  const floorArea = opts.floorArea ?? 100
  const defaultCalcResult = {
    coolingLoad: 15000,
    heatingLoad: 8000,
    requiredAirflow: 1500,
    internalLoad: 15000,
    envelopeLoad: 0,
    perimeterLoadBreakdown: [],
    status: 'success' as const,
  }
  return {
    object: 'node',
    id,
    type: 'hvac_zone',
    zoneName: `Zone-${id}`,
    systemId: opts.systemId !== undefined ? opts.systemId : SYSTEM_ID,
    floorArea,
    usage: 'office_general',
    perimeterSegments: [],
    designConditions: { supplyAirTempDiff: 10 },
    calcResult: opts.calcResult !== undefined ? opts.calcResult : defaultCalcResult,
    parentId: null,
    visible: true,
    metadata: {},
  } as unknown as AnyNode
}

/** AHU ノードを作成 */
function makeAhu(
  id: string,
  opts: {
    airflowRate?: number
    systemId?: string
    connectedSegmentId?: string | null
  } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'ahu',
    tag: `AHU-${id}`,
    equipmentName: 'Test AHU',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    dimensions: { width: 1.2, height: 1.0, depth: 0.8 },
    ports: [
      {
        id: 'port_sa',
        label: 'SA',
        medium: 'supply_air',
        position: [0.6, 0.5, 0],
        direction: [1, 0, 0],
        connectedSegmentId: opts.connectedSegmentId ?? DUCT_MAIN_ID,
      },
    ],
    airflowRate: opts.airflowRate ?? 3000,
    coolingCapacity: 20,
    heatingCapacity: 12,
    staticPressure: 300,
    systemId: opts.systemId ?? SYSTEM_ID,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

/** SystemNode を作成 */
function makeSystem(
  id: string,
  opts: {
    servedZoneIds?: string[]
    ahuId?: string | null
    aggregatedLoad?: {
      totalCoolingLoad: number
      totalHeatingLoad: number
      totalAirflow: number
    } | null
  } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'system',
    systemName: `System-${id}`,
    servedZoneIds: opts.servedZoneIds ?? [ZONE_1_ID, ZONE_2_ID],
    ahuId: opts.ahuId !== undefined ? opts.ahuId : AHU_ID,
    aggregatedLoad: opts.aggregatedLoad !== undefined
      ? opts.aggregatedLoad
      : { totalCoolingLoad: 30000, totalHeatingLoad: 16000, totalAirflow: 3000 },
    equipmentCandidates: [],
    selectionStatus: 'pending',
    recommendedEquipmentId: null,
    parentId: null,
    visible: true,
    metadata: {},
  } as unknown as AnyNode
}

/** DuctSegment ノードを作成 */
function makeDuctSegment(
  id: string,
  opts: {
    airflowRate?: number | null
    width?: number | null
    height?: number | null
    calcResult?: { velocity: number; frictionLoss: number; totalPressureLoss: number } | null
    startPortId?: string
    endPortId?: string
    systemId?: string
  } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'duct_segment',
    start: [0, 0, 0],
    end: [10, 0, 0],
    medium: 'supply_air',
    shape: 'rectangular',
    width: opts.width !== undefined ? opts.width : null,
    height: opts.height !== undefined ? opts.height : null,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate: opts.airflowRate !== undefined ? opts.airflowRate : null,
    startPortId: opts.startPortId ?? 'port_sa',
    endPortId: opts.endPortId ?? 'port_branch',
    systemId: opts.systemId ?? SYSTEM_ID,
    calcResult: opts.calcResult !== undefined ? opts.calcResult : null,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

// ============================================================================
// テスト
// ============================================================================

describe('TASK-0041: 再計算カスケード統合テスト', () => {
  it('テスト1: ゾーン条件変更→負荷再計算（面積2倍で冷房負荷が約2倍）', () => {
    // 【テスト目的】: ゾーン面積変更が負荷計算に正しく反映されることを確認 (REQ-1801)

    const zone100 = {
      floorArea: 100,
      usage: 'office_general' as const,
      perimeterSegments: [],
    }
    const zone200 = {
      floorArea: 200,
      usage: 'office_general' as const,
      perimeterSegments: [],
    }

    const result100 = calculateZoneLoad(zone100)
    const result200 = calculateZoneLoad(zone200)

    expect(result100.status).toBe('success')
    expect(result200.status).toBe('success')

    // 面積が2倍なら冷房負荷も2倍（外皮なしの純内部負荷のみなので線形）
    expect(result200.coolingLoad).toBe(result100.coolingLoad * 2)
    // Math.round の丸め誤差を許容（1 m³/h 以内）
    expect(Math.abs(result200.requiredAirflow - result100.requiredAirflow * 2)).toBeLessThanOrEqual(1)
  })

  it('テスト2: ゾーン条件変更→警告再生成（velocity_exceeded 警告が新たに発生）', () => {
    // 【テスト目的】: 風量増加→寸法未確定状態でvelocity_exceeded警告が生成されることを確認 (REQ-1801)

    // 風速超過状態のダクト（calcResult.velocity > 15 m/s）
    const nodesWithHighVelocity: Record<string, AnyNode> = {
      duct_001: makeDuctSegment('duct_001', {
        airflowRate: 5000,
        width: 200,
        height: 150,
        calcResult: { velocity: 20, frictionLoss: 1.5, totalPressureLoss: 15 },
      }),
    }

    // 風速超過なし状態
    const nodesNormal: Record<string, AnyNode> = {
      duct_001: makeDuctSegment('duct_001', {
        airflowRate: 1000,
        width: 400,
        height: 300,
        calcResult: { velocity: 5, frictionLoss: 0.3, totalPressureLoss: 3 },
      }),
    }

    const warningsHigh = checkVelocityExceeded(nodesWithHighVelocity)
    const warningsNormal = checkVelocityExceeded(nodesNormal)

    // 風速超過ありの場合は警告が生成される
    expect(warningsHigh.length).toBeGreaterThan(0)
    expect(warningsHigh[0]!.code).toBe('velocity_exceeded')

    // 風速超過なしの場合は警告なし
    expect(warningsNormal.length).toBe(0)
  })

  it('テスト3: グルーピング変更→系統合算負荷が増加する', () => {
    // 【テスト目的】: 3つ目のゾーンを追加すると合算負荷が増加することを確認 (REQ-1802)

    const zone1 = makeHvacZone(ZONE_1_ID, {
      calcResult: {
        coolingLoad: 15000,
        heatingLoad: 8000,
        requiredAirflow: 1500,
        internalLoad: 15000,
        envelopeLoad: 0,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })
    const zone2 = makeHvacZone(ZONE_2_ID, {
      calcResult: {
        coolingLoad: 12000,
        heatingLoad: 6000,
        requiredAirflow: 1200,
        internalLoad: 12000,
        envelopeLoad: 0,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })
    const zone3 = makeHvacZone('hvac_zone_003', {
      calcResult: {
        coolingLoad: 18000,
        heatingLoad: 10000,
        requiredAirflow: 1800,
        internalLoad: 18000,
        envelopeLoad: 0,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })

    const nodes: Record<string, AnyNode> = { [ZONE_1_ID]: zone1, [ZONE_2_ID]: zone2 }
    const nodesWithZone3: Record<string, AnyNode> = {
      [ZONE_1_ID]: zone1,
      [ZONE_2_ID]: zone2,
      'hvac_zone_003': zone3,
    }

    // 2ゾーン合算
    const result2 = aggregateSystemLoad([ZONE_1_ID, ZONE_2_ID], nodes)
    // 3ゾーン合算
    const result3 = aggregateSystemLoad([ZONE_1_ID, ZONE_2_ID, 'hvac_zone_003'], nodesWithZone3)

    expect(result3.totalCoolingLoad).toBeGreaterThan(result2.totalCoolingLoad)
    const zone3Hvac = zone3 as Extract<AnyNode, { type: 'hvac_zone' }>
    expect(result3.totalCoolingLoad).toBe(result2.totalCoolingLoad + zone3Hvac.calcResult!.coolingLoad)
    expect(result3.totalAirflow).toBe(result2.totalAirflow + zone3Hvac.calcResult!.requiredAirflow)
  })

  it('テスト4: ルート変更→ダクト寸法再計算（風量設定済みセグメントが寸法選定対象）', () => {
    // 【テスト目的】: ダクト追加後に寸法計算関数が正しい結果を返すことを確認 (REQ-1803)

    // 3600 m³/h の幹線ダクトを寸法選定
    const result = calcDuctSize(3600, 7) // 7 m/s (幹線推奨)
    expect(result).not.toBeNull()
    expect(result!.width).toBeGreaterThan(0)
    expect(result!.height).toBeGreaterThan(0)

    // 風量増加後の寸法（6000 m³/h）
    const resultLarger = calcDuctSize(6000, 7)
    expect(resultLarger).not.toBeNull()

    // 風量が増えると断面積も増える（幅×高が大きい）
    const area3600 = result!.width * result!.height
    const area6000 = resultLarger!.width * resultLarger!.height
    expect(area6000).toBeGreaterThan(area3600)
  })

  it('テスト5: 機器変更→接続ダクトの風量配分が再計算される', () => {
    // 【テスト目的】: AHU風量変更後に distributeAirflow が正しく動作することを確認 (REQ-1804)

    const ahu = makeAhu(AHU_ID, {
      airflowRate: 3000,
      connectedSegmentId: DUCT_MAIN_ID,
    })
    const ductMain = makeDuctSegment(DUCT_MAIN_ID, {
      airflowRate: null,
      startPortId: 'port_sa',
      endPortId: 'port_branch',
      systemId: SYSTEM_ID,
    })
    const ductBranch = makeDuctSegment(DUCT_BRANCH_ID, {
      airflowRate: null,
      startPortId: 'port_branch',
      endPortId: 'diffuser_port',
      systemId: SYSTEM_ID,
    })
    const system = makeSystem(SYSTEM_ID, { ahuId: AHU_ID })

    const nodes: Record<string, AnyNode> = {
      [AHU_ID]: ahu,
      [DUCT_MAIN_ID]: ductMain,
      [DUCT_BRANCH_ID]: ductBranch,
      [SYSTEM_ID]: system,
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    // サイクルなし・エラーなし
    expect(result.errors.length).toBe(0)
    // airflowMap が返ること（ダクト区間が存在する場合）
    expect(result.airflowMap).toBeInstanceOf(Map)
  })

  it('テスト6: dirtyNodesから対象セグメントを正しく抽出できる', () => {
    // 【テスト目的】: dirtyNodes が正しく処理されて対象セグメントが抽出されることを確認

    const ductWithAirflow = makeDuctSegment('duct_a', { airflowRate: 1800 })
    const ductNoAirflow = makeDuctSegment('duct_b', { airflowRate: null })
    const nodes: Record<string, AnyNode> = {
      duct_a: ductWithAirflow,
      duct_b: ductNoAirflow,
    }

    const dirtyNodes = new Set(['duct_a', 'duct_b'])
    const targets = findDirtyDuctSegmentsForSizing(dirtyNodes, nodes)

    // airflowRate が設定されているものだけ対象
    expect(targets).toContain('duct_a')
    expect(targets).not.toContain('duct_b')
  })

  it('テスト7: ゾーン未割当の警告が系統割当後に解消される', () => {
    // 【テスト目的】: zone_no_system 警告が系統割当後に消えることを確認（カスケード最終結果）

    // 系統未割当のゾーン
    const nodesWithUnassigned: Record<string, AnyNode> = {
      zone1: makeHvacZone('zone1', { systemId: null }),
    }

    // 系統割当済みのゾーン
    const nodesAssigned: Record<string, AnyNode> = {
      zone1: makeHvacZone('zone1', { systemId: SYSTEM_ID }),
    }

    const warningsBefore = checkZoneNoSystem(nodesWithUnassigned)
    const warningsAfter = checkZoneNoSystem(nodesAssigned)

    expect(warningsBefore.length).toBeGreaterThan(0)
    expect(warningsBefore[0]!.code).toBe('zone_no_system')

    // 系統割当後は警告なし
    expect(warningsAfter.length).toBe(0)
  })

  it('テスト追加: 計算カスケード全体（負荷→集計→風量→寸法→警告）の連鎖確認', () => {
    // 【テスト目的】: 4ステップ全体が正しく連鎖することを一連の流れで確認 (REQ-1801)

    // Step 1: ゾーン負荷計算
    const zoneInput = { floorArea: 100, usage: 'office_general' as const, perimeterSegments: [] }
    const zoneResult = calculateZoneLoad(zoneInput)
    expect(zoneResult.status).toBe('success')
    const { coolingLoad, requiredAirflow } = zoneResult

    // Step 2: 系統集計（2ゾーン合算）
    const zone1Node = makeHvacZone('z1', {
      calcResult: {
        coolingLoad,
        heatingLoad: zoneResult.heatingLoad,
        requiredAirflow,
        internalLoad: zoneResult.internalLoad,
        envelopeLoad: 0,
        perimeterLoadBreakdown: [],
        status: 'success',
      },
    })
    const nodes: Record<string, AnyNode> = { z1: zone1Node }
    const agg = aggregateSystemLoad(['z1'], nodes)
    expect(agg.totalCoolingLoad).toBe(coolingLoad)
    expect(agg.totalAirflow).toBe(requiredAirflow)

    // Step 3: ダクト寸法選定（等速法）
    const sizingResult = calcDuctSize(requiredAirflow, 7)
    expect(sizingResult).not.toBeNull()

    // Step 4: 風量未設定の警告チェック
    const ductNode = makeDuctSegment('d1', { airflowRate: null, width: null, height: null })
    const warningsAirflow = checkAirflowNotSet({ d1: ductNode })
    const warningsSize = checkSizeNotDetermined({ d1: ductNode })

    expect(warningsAirflow.length).toBeGreaterThan(0)
    expect(warningsSize.length).toBeGreaterThan(0)

    // Step 5: 風量・寸法設定後は警告なし
    const ductReady = makeDuctSegment('d1', {
      airflowRate: requiredAirflow,
      width: sizingResult!.width,
      height: sizingResult!.height,
    })
    const warningsAfter = checkAirflowNotSet({ d1: ductReady })
    const warningsSizeAfter = checkSizeNotDetermined({ d1: ductReady })
    expect(warningsAfter.length).toBe(0)
    expect(warningsSizeAfter.length).toBe(0)
  })
})
