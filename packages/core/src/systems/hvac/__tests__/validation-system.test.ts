/**
 * TASK-0038: ValidationSystem — 警告バリデーション 単体テスト
 *
 * 【テスト対象】: validation-system.tsx の純粋チェック関数
 *   - checkUnconnectedPorts: AHUポート未接続検出
 *   - checkAirflowNotSet: ダクト風量未設定検出
 *   - checkSizeNotDetermined: ダクト/配管サイズ未確定検出
 *   - checkVelocityExceeded: ダクト風速超過検出
 *   - checkPressureNotCalculated: ダクト圧損未計算検出
 *   - checkZoneNoSystem: ゾーン系統未割当検出
 *   - checkAirflowMismatch: 系統風量乖離検出
 *   - checkPipeNotConnected: 配管接続先未設定検出
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0038 要件定義（REQ-1201）に明示
 */

import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../../schema/types'
import {
  AIRFLOW_MISMATCH_THRESHOLD,
  checkAirflowMismatch,
  checkAirflowNotSet,
  checkPipeNotConnected,
  checkPressureNotCalculated,
  checkSizeNotDetermined,
  checkUnconnectedPorts,
  checkVelocityExceeded,
  checkZoneNoSystem,
  DUCT_MAX_VELOCITY_MS,
} from '../validation-system'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const SYSTEM_ID = 'system_test_001'

function makeAhu(
  id: string,
  ports: Array<{ id: string; connectedSegmentId: string | null }>,
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'ahu',
    tag: `AHU-${id}`,
    equipmentName: 'Test AHU',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    dimensions: { width: 1, height: 1, depth: 1 },
    ports: ports.map((p) => ({
      id: p.id,
      label: 'SA',
      medium: 'supply_air',
      position: [0.5, 0, 0],
      direction: [1, 0, 0],
      connectedSegmentId: p.connectedSegmentId,
    })),
    airflowRate: 3600,
    coolingCapacity: 10,
    heatingCapacity: 10,
    staticPressure: 200,
    systemId: SYSTEM_ID,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

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
    width: opts.width !== undefined ? opts.width : 400,
    height: opts.height !== undefined ? opts.height : 300,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate: opts.airflowRate !== undefined ? opts.airflowRate : 3600,
    startPortId: opts.startPortId ?? 'port_start',
    endPortId: opts.endPortId ?? 'port_end',
    systemId: opts.systemId ?? SYSTEM_ID,
    calcResult: opts.calcResult !== undefined ? opts.calcResult : null,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

function makePipeSegment(
  id: string,
  opts: {
    nominalSize?: number | null
    startPortId?: string
    endPortId?: string
    calcResult?: { velocity: number; pressureDrop: number } | null
  } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'pipe_segment',
    start: [0, 0, 0],
    end: [5, 0, 0],
    medium: 'chilled_water',
    nominalSize: opts.nominalSize !== undefined ? opts.nominalSize : 25,
    outerDiameter: null,
    startPortId: opts.startPortId ?? 'port_start',
    endPortId: opts.endPortId ?? 'port_end',
    systemId: SYSTEM_ID,
    calcResult: opts.calcResult !== undefined ? opts.calcResult : null,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

function makeHvacZone(id: string, systemId: string | null): AnyNode {
  return {
    object: 'node',
    id,
    type: 'hvac_zone',
    zoneName: `Zone-${id}`,
    usage: 'office_general',
    floorArea: 50,
    ceilingHeight: 2.7,
    occupantDensity: 0.15,
    boundary: [
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
    ],
    designConditions: {
      coolingSetpoint: 26,
      heatingSetpoint: 22,
      relativeHumidity: 50,
      supplyAirTempDiff: 10,
    },
    perimeterSegments: [],
    systemId,
    calcResult: null,
    parentId: null,
    visible: true,
    metadata: {},
  } as unknown as AnyNode
}

function makeSystem(
  id: string,
  opts: {
    ahuId?: string | null
    totalAirflow?: number
    servedZoneIds?: string[]
  } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'system',
    systemName: `System-${id}`,
    servedZoneIds: opts.servedZoneIds ?? [],
    ahuId: opts.ahuId !== undefined ? opts.ahuId : 'ahu_001',
    aggregatedLoad:
      opts.totalAirflow !== undefined
        ? {
            totalCoolingLoad: 10000,
            totalHeatingLoad: 8000,
            totalAirflow: opts.totalAirflow,
          }
        : null,
    status: 'draft',
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

function makeDiffuser(id: string, systemId: string, airflowRate: number): AnyNode {
  return {
    object: 'node',
    id,
    type: 'diffuser',
    tag: `SA-${id}`,
    subType: 'anemostat',
    position: [5, 0, 0],
    neckDiameter: 0.15,
    airflowRate,
    port: {
      id: `port_${id}`,
      label: 'SA',
      medium: 'supply_air',
      position: [5, 0, 0],
      direction: [0, -1, 0],
      connectedSegmentId: null,
    },
    hostDuctId: null,
    systemId,
    zoneId: `zone_${id}`,
    parentId: null,
    visible: true,
    metadata: {},
  } as unknown as AnyNode
}

// ============================================================================
// テスト1: unconnected_port検出 (REQ-1201)
// ============================================================================

describe('checkUnconnectedPorts — AHUポート未接続検出', () => {
  it('テスト1: AHUポートに接続先未設定のportがある → unconnected_port警告が生成される', () => {
    // 【テスト目的】: AHUポートのconnectedSegmentId=nullで'unconnected_port'警告が生成されることを検証
    // 🔵 信頼性レベル: REQ-1201（unconnected_port）に明示

    const nodes = {
      ahu_001: makeAhu('ahu_001', [{ id: 'port_a', connectedSegmentId: null }]),
    }
    const warnings = checkUnconnectedPorts(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('unconnected_port')
    expect(warnings[0]!.severity).toBe('error')
    expect(warnings[0]!.nodeId).toBe('ahu_001')
    expect(warnings[0]!.nodeType).toBe('ahu')
  })

  it('テスト1b: 全ポートが接続済みの場合は警告なし', () => {
    // 【テスト目的】: 全ポート接続済みの場合は警告が生成されないことを検証

    const nodes = {
      ahu_001: makeAhu('ahu_001', [{ id: 'port_a', connectedSegmentId: 'duct_seg_001' }]),
    }
    const warnings = checkUnconnectedPorts(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })

  it('テスト1c: 複数ポートのうち一部が未接続 → 未接続分のみ警告', () => {
    const nodes = {
      ahu_001: makeAhu('ahu_001', [
        { id: 'port_sa', connectedSegmentId: 'duct_seg_001' },
        { id: 'port_ra', connectedSegmentId: null },
      ]),
    }
    const warnings = checkUnconnectedPorts(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.nodeId).toBe('ahu_001')
  })
})

// ============================================================================
// テスト2: airflow_not_set検出 (REQ-1201)
// ============================================================================

describe('checkAirflowNotSet — ダクト風量未設定検出', () => {
  it('テスト2: DuctSegmentのairflowRate=0 → airflow_not_set警告が生成される', () => {
    // 【テスト目的】: airflowRate=0のDuctSegmentで警告が生成されることを検証
    // 🔵 信頼性レベル: REQ-1201（airflow_not_set）に明示

    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { airflowRate: 0 }),
    }
    const warnings = checkAirflowNotSet(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('airflow_not_set')
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.nodeId).toBe('duct_seg_001')
  })

  it('テスト2b: DuctSegmentのairflowRate=null → airflow_not_set警告が生成される', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { airflowRate: null }),
    }
    const warnings = checkAirflowNotSet(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('airflow_not_set')
  })

  it('テスト2c: airflowRate=600 → 警告なし', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { airflowRate: 600 }),
    }
    const warnings = checkAirflowNotSet(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト3: size_not_determined検出 (REQ-1201)
// ============================================================================

describe('checkSizeNotDetermined — サイズ未確定検出', () => {
  it('テスト3: DuctSegmentのwidth=0 → size_not_determined警告が生成される', () => {
    // 【テスト目的】: width=0のDuctSegmentで警告が生成されることを検証
    // 🔵 信頼性レベル: REQ-1201（size_not_determined）に明示

    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { width: 0, height: 300 }),
    }
    const warnings = checkSizeNotDetermined(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('size_not_determined')
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.nodeId).toBe('duct_seg_001')
  })

  it('テスト3b: DuctSegmentのwidth=null → size_not_determined警告が生成される', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { width: null }),
    }
    const warnings = checkSizeNotDetermined(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('size_not_determined')
  })

  it('テスト3c: PipeSegmentのnominalSize=null → size_not_determined警告が生成される', () => {
    const nodes = {
      pipe_seg_001: makePipeSegment('pipe_seg_001', { nominalSize: null }),
    }
    const warnings = checkSizeNotDetermined(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('size_not_determined')
    expect(warnings[0]!.nodeId).toBe('pipe_seg_001')
    expect(warnings[0]!.nodeType).toBe('pipe_segment')
  })

  it('テスト3d: DuctSegment width=400, height=300 → 警告なし', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { width: 400, height: 300 }),
    }
    const warnings = checkSizeNotDetermined(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト4: velocity_exceeded検出 (REQ-1201)
// ============================================================================

describe('checkVelocityExceeded — ダクト風速超過検出', () => {
  it(`テスト4: calcResult.velocity=${DUCT_MAX_VELOCITY_MS + 5} (>${DUCT_MAX_VELOCITY_MS}) → velocity_exceeded警告が生成される`, () => {
    // 【テスト目的】: 風速上限超過で警告が生成されることを検証
    // 🔵 信頼性レベル: REQ-1201（velocity_exceeded）に明示

    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', {
        calcResult: { velocity: 20, frictionLoss: 5, totalPressureLoss: 5 },
      }),
    }
    const warnings = checkVelocityExceeded(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('velocity_exceeded')
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.nodeId).toBe('duct_seg_001')
  })

  it('テスト4b: calcResult.velocity=10 → 警告なし', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', {
        calcResult: { velocity: 10, frictionLoss: 2, totalPressureLoss: 2 },
      }),
    }
    const warnings = checkVelocityExceeded(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })

  it(`テスト4c: calcResult.velocity=${DUCT_MAX_VELOCITY_MS} (境界値) → 警告なし`, () => {
    // 境界値: ちょうど15m/sは超過ではない
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', {
        calcResult: { velocity: DUCT_MAX_VELOCITY_MS, frictionLoss: 3, totalPressureLoss: 3 },
      }),
    }
    const warnings = checkVelocityExceeded(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })

  it('テスト4d: calcResult=null → 警告なし（velocity_exceeded は計算済みが前提）', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { calcResult: null }),
    }
    const warnings = checkVelocityExceeded(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト4e: pressure_not_calculated検出 (REQ-1201)
// ============================================================================

describe('checkPressureNotCalculated — ダクト圧損未計算検出', () => {
  it('テスト4e: DuctSegmentのcalcResult=null → pressure_not_calculated情報警告が生成される', () => {
    // 【テスト目的】: calcResult=nullのDuctSegmentで情報警告が生成されることを検証

    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', { calcResult: null }),
    }
    const warnings = checkPressureNotCalculated(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('pressure_not_calculated')
    expect(warnings[0]!.severity).toBe('info')
  })

  it('テスト4f: calcResultが設定済み → 警告なし', () => {
    const nodes = {
      duct_seg_001: makeDuctSegment('duct_seg_001', {
        calcResult: { velocity: 5, frictionLoss: 2, totalPressureLoss: 2 },
      }),
    }
    const warnings = checkPressureNotCalculated(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト5: zone_no_system検出 (REQ-1201)
// ============================================================================

describe('checkZoneNoSystem — ゾーン系統未割当検出', () => {
  it('テスト5: HvacZoneのsystemId=null → zone_no_system警告が生成される', () => {
    // 【テスト目的】: systemId=nullのゾーンで警告が生成されることを検証
    // 🔵 信頼性レベル: REQ-1201（zone_no_system）に明示

    const nodes = {
      hvac_zone_001: makeHvacZone('hvac_zone_001', null),
    }
    const warnings = checkZoneNoSystem(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('zone_no_system')
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.nodeId).toBe('hvac_zone_001')
  })

  it('テスト5b: HvacZoneのsystemId="" → zone_no_system警告が生成される', () => {
    const nodes = {
      hvac_zone_001: makeHvacZone('hvac_zone_001', ''),
    }
    const warnings = checkZoneNoSystem(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('zone_no_system')
  })

  it('テスト5c: systemId設定済み → 警告なし', () => {
    const nodes = {
      hvac_zone_001: makeHvacZone('hvac_zone_001', SYSTEM_ID),
    }
    const warnings = checkZoneNoSystem(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト6: airflow_mismatch検出 (REQ-1201)
// ============================================================================

describe('checkAirflowMismatch — 系統風量乖離検出', () => {
  it(`テスト6: 系統風量1000m³/h、制気口合計900m³/h (10%乖離) → airflow_mismatch警告が生成される`, () => {
    // 【テスト目的】: 5%超の風量乖離で警告が生成されることを検証
    // 乖離 = |900 - 1000| / 1000 = 10% > 5% → 警告
    // 🔵 信頼性レベル: REQ-1201（airflow_mismatch）に明示

    const sysId = 'system_001'
    const nodes = {
      system_001: makeSystem('system_001', { ahuId: 'ahu_001', totalAirflow: 1000 }),
      diffuser_a: makeDiffuser('diffuser_a', sysId, 450),
      diffuser_b: makeDiffuser('diffuser_b', sysId, 450),
    }
    const warnings = checkAirflowMismatch(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('airflow_mismatch')
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.nodeId).toBe('system_001')
  })

  it(`テスト6b: 乖離3% (${AIRFLOW_MISMATCH_THRESHOLD * 100}%以内) → 警告なし`, () => {
    // 乖離 = |970 - 1000| / 1000 = 3% < 5% → 警告なし

    const sysId = 'system_001'
    const nodes = {
      system_001: makeSystem('system_001', { ahuId: 'ahu_001', totalAirflow: 1000 }),
      diffuser_a: makeDiffuser('diffuser_a', sysId, 485),
      diffuser_b: makeDiffuser('diffuser_b', sysId, 485),
    }
    const warnings = checkAirflowMismatch(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })

  it('テスト6c: aggregatedLoad=null → 警告なし（未計算系統はスキップ）', () => {
    const nodes = {
      system_001: makeSystem('system_001', { ahuId: 'ahu_001', totalAirflow: undefined }),
    }
    const warnings = checkAirflowMismatch(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })

  it('テスト6d: ahuId=null → 警告なし（AHU未選定系統はスキップ）', () => {
    const sysId = 'system_001'
    const nodes = {
      system_001: makeSystem('system_001', { ahuId: null, totalAirflow: 1000 }),
      diffuser_a: makeDiffuser('diffuser_a', sysId, 500),
    }
    const warnings = checkAirflowMismatch(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト7: pipe_not_connected検出 (REQ-1201)
// ============================================================================

describe('checkPipeNotConnected — 配管接続先未設定検出', () => {
  it('テスト7: PipeSegmentのstartPortId="" → pipe_not_connected警告が生成される', () => {
    // 【テスト目的】: startPortId空文字で警告が生成されることを検証
    // 🔵 信頼性レベル: REQ-1201（pipe_not_connected）に明示

    const nodes = {
      pipe_seg_001: makePipeSegment('pipe_seg_001', { startPortId: '', endPortId: 'port_end' }),
    }
    const warnings = checkPipeNotConnected(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('pipe_not_connected')
    expect(warnings[0]!.severity).toBe('error')
    expect(warnings[0]!.nodeId).toBe('pipe_seg_001')
  })

  it('テスト7b: endPortId="" → pipe_not_connected警告が生成される', () => {
    const nodes = {
      pipe_seg_001: makePipeSegment('pipe_seg_001', { startPortId: 'port_start', endPortId: '' }),
    }
    const warnings = checkPipeNotConnected(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('pipe_not_connected')
  })

  it('テスト7c: 両端設定済み → 警告なし', () => {
    const nodes = {
      pipe_seg_001: makePipeSegment('pipe_seg_001', {
        startPortId: 'port_start',
        endPortId: 'port_end',
      }),
    }
    const warnings = checkPipeNotConnected(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト8: Warning型の構造検証 (REQ-1201)
// ============================================================================

describe('Warning型の構造', () => {
  it('テスト8: 生成されたWarningにid/nodeId/nodeType/severity/code/messageが全て含まれる', () => {
    // 【テスト目的】: Warning型に必須フィールドが全て設定されることを検証
    // 🔵 信頼性レベル: REQ-1201（Warning型: {id, nodeId, nodeType, severity, code, message}）に明示

    const nodes = {
      ahu_001: makeAhu('ahu_001', [{ id: 'port_sa', connectedSegmentId: null }]),
    }
    const warnings = checkUnconnectedPorts(nodes as Record<string, AnyNode>)

    expect(warnings).toHaveLength(1)
    const w = warnings[0]!
    expect(w).toHaveProperty('id')
    expect(w).toHaveProperty('nodeId')
    expect(w).toHaveProperty('nodeType')
    expect(w).toHaveProperty('severity')
    expect(w).toHaveProperty('code')
    expect(w).toHaveProperty('message')
    expect(typeof w.id).toBe('string')
    expect(typeof w.nodeId).toBe('string')
    expect(typeof w.nodeType).toBe('string')
    expect(typeof w.severity).toBe('string')
    expect(typeof w.code).toBe('string')
    expect(typeof w.message).toBe('string')
    expect(w.id.length).toBeGreaterThan(0)
    expect(w.message.length).toBeGreaterThan(0)
  })

  it('テスト8b: 警告IDはwarning_<code>_<nodeId>の形式', () => {
    const nodes = {
      hvac_zone_001: makeHvacZone('hvac_zone_001', null),
    }
    const warnings = checkZoneNoSystem(nodes as Record<string, AnyNode>)

    expect(warnings[0]!.id).toMatch(/^warning_zone_no_system_/)
    expect(warnings[0]!.id).toContain('hvac_zone_001')
  })
})

// ============================================================================
// テスト9: 複合シナリオ（全ノード正常時は警告なし）
// ============================================================================

describe('全チェック正常時は警告なし', () => {
  it('テスト9: 全HVACノードが正常に設定されている場合は警告配列が空', () => {
    // 【テスト目的】: 正常状態では全チェックで警告が生成されないことを検証
    // 🔵 信頼性レベル: REQ-1201（正常系）に明示

    const sysId = 'system_001'
    const nodes = {
      ahu_001: makeAhu('ahu_001', [{ id: 'port_sa', connectedSegmentId: 'duct_seg_001' }]),
      duct_seg_001: makeDuctSegment('duct_seg_001', {
        airflowRate: 1200,
        width: 400,
        height: 300,
        calcResult: { velocity: 8, frictionLoss: 2, totalPressureLoss: 2 },
        systemId: sysId,
      }),
      pipe_seg_001: makePipeSegment('pipe_seg_001', {
        nominalSize: 25,
        startPortId: 'port_start',
        endPortId: 'port_end',
      }),
      hvac_zone_001: makeHvacZone('hvac_zone_001', sysId),
      system_001: makeSystem('system_001', { ahuId: 'ahu_001', totalAirflow: 1200 }),
      diffuser_a: makeDiffuser('diffuser_a', sysId, 600),
      diffuser_b: makeDiffuser('diffuser_b', sysId, 600),
    }

    // airflow_not_setとpressure_not_calculatedはduct_seg_001が計算済みなので対象外
    // velocity_exceededはvelocity=8 < 15なので対象外
    // zone_no_systemはsystemId設定済みなので対象外
    // airflow_mismatchは1200 vs 1200で乖離0なので対象外
    const allWarnings = [
      ...checkUnconnectedPorts(nodes as Record<string, AnyNode>),
      ...checkAirflowNotSet(nodes as Record<string, AnyNode>),
      ...checkSizeNotDetermined(nodes as Record<string, AnyNode>),
      ...checkVelocityExceeded(nodes as Record<string, AnyNode>),
      ...checkPressureNotCalculated(nodes as Record<string, AnyNode>),
      ...checkZoneNoSystem(nodes as Record<string, AnyNode>),
      ...checkAirflowMismatch(nodes as Record<string, AnyNode>),
      ...checkPipeNotConnected(nodes as Record<string, AnyNode>),
    ]

    expect(allWarnings).toHaveLength(0)
  })
})
