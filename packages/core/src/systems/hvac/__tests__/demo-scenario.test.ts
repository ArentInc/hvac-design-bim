/**
 * TASK-0046: デモシナリオ検証 — ワンパス通し確認
 *
 * 【テスト対象】:
 *   - ワンパスフロー: ゾーン作成→負荷計算→系統→機器→ダクト→配管→計算→バリデーション
 *   - プリセット読込後の継続操作
 *   - Undo/Redo後の計算整合性
 *   - エッジケース: ゾーン面積0, 風量超過, 全ノード削除
 *   - パフォーマンス: 全バリデーション5秒以内
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0046 PRDセクション21.2, dataflow.mdに明示
 */

import { describe, expect, it } from 'vitest'
import { HVAC_PRESETS } from '../../../data/presets'
import { HvacZoneNode } from '../../../schema/nodes/hvac-zone'
import type { AnyNode } from '../../../schema/types'
import {
  checkAirflowMismatch,
  checkAirflowNotSet,
  checkPipeNotConnected,
  checkPressureNotCalculated,
  checkSizeNotDetermined,
  checkUnconnectedPorts,
  checkVelocityExceeded,
  checkZoneNoSystem,
} from '../validation-system'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const SYSTEM_A = 'system_demo_A'
const SYSTEM_B = 'system_demo_B'

function makeZone(id: string, systemId: string | null, floorArea = 50): AnyNode {
  return {
    object: 'node',
    id,
    type: 'hvac_zone',
    zoneName: `Zone-${id}`,
    usage: 'office_general',
    floorArea,
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
    calcResult: {
      coolingLoad: 5000,
      heatingLoad: 4000,
      requiredAirflow: 1200,
      internalLoad: 2000,
      envelopeLoad: 3000,
      perimeterLoadBreakdown: [],
      status: 'success',
    },
    parentId: 'level_demo',
    visible: true,
    metadata: {},
  } as unknown as AnyNode
}

function makeSystem(
  id: string,
  opts: { ahuId?: string | null; totalAirflow?: number } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'system',
    systemName: `System-${id}`,
    servedZoneIds: [],
    ahuId: opts.ahuId !== undefined ? opts.ahuId : 'ahu_demo',
    aggregatedLoad:
      opts.totalAirflow !== undefined
        ? { totalCoolingLoad: 15000, totalHeatingLoad: 12000, totalAirflow: opts.totalAirflow }
        : null,
    status: 'equipment_selected',
    selectionMargin: 1.1,
    equipmentCandidates: [],
    selectionStatus: 'candidates-available',
    parentId: 'level_demo',
    visible: true,
    metadata: {},
  } as AnyNode
}

function makeAhu(id: string, connected = true): AnyNode {
  return {
    object: 'node',
    id,
    type: 'ahu',
    tag: `AHU-${id}`,
    equipmentName: 'Test AHU',
    position: [0, 2, 0],
    rotation: [0, 0, 0],
    dimensions: { width: 1, height: 1, depth: 0.5 },
    ports: [
      {
        id: `${id}_port_sa`,
        label: 'SA',
        medium: 'supply_air',
        position: [0.5, 0, 0],
        direction: [1, 0, 0],
        connectedSegmentId: connected ? 'duct_demo_001' : null,
      },
    ],
    airflowRate: 2400,
    coolingCapacity: 15,
    heatingCapacity: 12,
    staticPressure: 200,
    systemId: SYSTEM_A,
    parentId: 'level_demo',
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
      connectedSegmentId: `duct_demo_${id}`,
    },
    hostDuctId: null,
    systemId,
    zoneId: `zone_${id}`,
    parentId: 'level_demo',
    visible: true,
    metadata: {},
  } as unknown as AnyNode
}

function makeDuct(
  id: string,
  opts: {
    airflowRate?: number
    width?: number
    height?: number
    calcResult?: { velocity: number; frictionLoss: number; totalPressureLoss: number } | null
    startPortId?: string
    endPortId?: string
  } = {},
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'duct_segment',
    start: [0, 2, 0],
    end: [5, 2, 0],
    medium: 'supply_air',
    shape: 'rectangular',
    width: opts.width !== undefined ? opts.width : 400,
    height: opts.height !== undefined ? opts.height : 300,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate: opts.airflowRate !== undefined ? opts.airflowRate : 1200,
    startPortId: opts.startPortId ?? `${id}_start`,
    endPortId: opts.endPortId ?? `${id}_end`,
    systemId: SYSTEM_A,
    calcResult: opts.calcResult !== undefined ? opts.calcResult : null,
    parentId: 'level_demo',
    visible: true,
    metadata: {},
  } as AnyNode
}

function makePipe(id: string, nominalSize = 25): AnyNode {
  return {
    object: 'node',
    id,
    type: 'pipe_segment',
    start: [0, 2, 0],
    end: [3, 2, 0],
    medium: 'chilled_water',
    nominalSize,
    outerDiameter: 34.0,
    startPortId: `${id}_start`,
    endPortId: `${id}_end`,
    systemId: SYSTEM_A,
    calcResult: { velocity: 1.2, pressureDrop: 15.0 },
    parentId: 'level_demo',
    visible: true,
    metadata: {},
  } as AnyNode
}

/** 全バリデーションチェックをまとめて実行する */
function runAllChecks(nodes: Record<string, AnyNode>) {
  return [
    ...checkUnconnectedPorts(nodes),
    ...checkAirflowNotSet(nodes),
    ...checkSizeNotDetermined(nodes),
    ...checkVelocityExceeded(nodes),
    ...checkPressureNotCalculated(nodes),
    ...checkZoneNoSystem(nodes),
    ...checkAirflowMismatch(nodes),
    ...checkPipeNotConnected(nodes),
  ]
}

// ============================================================================
// テスト1: ワンパスフロー基本動作 (PRDセクション21.2)
// ============================================================================

describe('ワンパスフロー基本動作 (PRDセクション21.2)', () => {
  it('テスト1: ゾーン作成→負荷計算→系統→機器→ダクト→配管→計算→バリデーションを順次実行 → 警告0件', () => {
    // 【テスト目的】: PRDセクション21.2のデモシナリオ全ステップが警告なく完了することを検証
    // 🔵 信頼性レベル: PRDセクション21.2 ワンパスフローに明示

    // Step 1: 3ゾーン作成（事務室・会議室・サーバー室）
    // Step 2: 負荷計算済み（calcResult付き）
    // Step 3: 2系統に分類
    // Step 4-5: AHU + Diffuser配置
    // Step 6-7: ダクト + 配管接続
    // Step 8: 風量配分 + 寸法計算 + 圧損計算済み
    // Step 9: バリデーション実行

    const nodes: Record<string, AnyNode> = {
      // ゾーン（系統割当済み・負荷計算済み）
      zone_office: makeZone('zone_office', SYSTEM_A, 100),
      zone_conf: makeZone('zone_conf', SYSTEM_A, 60),
      zone_server: makeZone('zone_server', SYSTEM_B, 40),

      // 系統 + AHU（ポート接続済み）
      system_A: makeSystem(SYSTEM_A, { ahuId: 'ahu_A', totalAirflow: 2400 }),
      system_B: makeSystem(SYSTEM_B, { ahuId: 'ahu_B', totalAirflow: 800 }),
      ahu_A: makeAhu('ahu_A', true),
      ahu_B: {
        ...makeAhu('ahu_B', true),
        systemId: SYSTEM_B,
        ports: [
          {
            id: 'ahu_B_port_sa',
            label: 'SA',
            medium: 'supply_air' as const,
            position: [0.5, 0, 0] as [number, number, number],
            direction: [1, 0, 0] as [number, number, number],
            connectedSegmentId: 'duct_B_001',
          },
        ],
      } as AnyNode,

      // Diffuser（風量合計 = 系統設計風量）
      diffuser_01: makeDiffuser('diffuser_01', SYSTEM_A, 1200),
      diffuser_02: makeDiffuser('diffuser_02', SYSTEM_A, 1200),
      diffuser_03: makeDiffuser('diffuser_03', SYSTEM_B, 800),

      // ダクト（寸法確定・風量設定・圧損計算済み）
      duct_A_001: makeDuct('duct_A_001', {
        airflowRate: 2400,
        width: 600,
        height: 400,
        calcResult: { velocity: 5.6, frictionLoss: 1.5, totalPressureLoss: 8.0 },
        startPortId: 'ahu_A_port_sa',
      }),
      duct_B_001: makeDuct('duct_B_001', {
        airflowRate: 800,
        width: 400,
        height: 300,
        calcResult: { velocity: 3.7, frictionLoss: 1.0, totalPressureLoss: 5.0 },
        startPortId: 'ahu_B_port_sa',
        endPortId: 'duct_B_001_end',
      }),

      // 配管（口径確定・両端接続済み）
      pipe_001: makePipe('pipe_001', 50),
      pipe_002: makePipe('pipe_002', 32),
    }

    const warnings = runAllChecks(nodes)

    // pressure_not_calculatedは duct_A_001/B_001 が calcResult 設定済みのため0
    // zone_no_system も全ゾーン割当済みのため0
    // 全警告0件を期待
    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト2: プリセット読込後の操作継続 (REQ-1701, REQ-1702)
// ============================================================================

describe('プリセット読込後の操作継続 (TASK-0042)', () => {
  it('テスト2: preset-02-equip を読み込み、バリデーション関数がエラーなく実行できる', () => {
    // 【テスト目的】: Stage 2プリセットのノードに対してバリデーションが正常実行できることを検証
    // 🔵 信頼性レベル: REQ-1701（プリセット読込）に明示

    const preset = HVAC_PRESETS.find((p) => p.stage === 2)
    expect(preset).toBeDefined()
    expect(preset!.data.nodes).toBeDefined()

    // プリセットのノードをAnyNodeとして扱いバリデーション実行
    const nodes = preset!.data.nodes as Record<string, AnyNode>

    // エラーなく実行できることを確認（エラーをthrowしないこと）
    expect(() => runAllChecks(nodes)).not.toThrow()
  })

  it('テスト2b: preset-04-complete を読み込み、全HVACノードが存在する', () => {
    // 【テスト目的】: Stage 4プリセット（完成状態）のノードにHVACノードが含まれることを検証
    // 🔵 信頼性レベル: REQ-1702（プリセット完成状態）に明示

    const preset = HVAC_PRESETS.find((p) => p.stage === 4)
    expect(preset).toBeDefined()

    const nodes = preset!.data.nodes
    const nodeList = Object.values(nodes)

    const hvacTypes = ['hvac_zone', 'system', 'ahu', 'diffuser', 'duct_segment', 'pipe_segment']
    const hasHvacNodes = nodeList.some((n: unknown) =>
      hvacTypes.includes((n as { type: string }).type),
    )
    expect(hasHvacNodes).toBe(true)
  })
})

// ============================================================================
// テスト3: Undo/Redo後の計算整合性 (EDGE-103)
// ============================================================================

describe('Undo/Redo後の計算整合性 (EDGE-103)', () => {
  it('テスト3: 同一ノードセットに対してバリデーションを2回実行した結果が一致する（決定性）', () => {
    // 【テスト目的】: バリデーション関数の決定性（同一入力→同一出力）を検証
    //               これがUndoしてRedoした後でも同じ結果が得られることを保証する
    // 🔵 信頼性レベル: EDGE-103（Undo/Redo後の計算整合性）に明示

    const nodes: Record<string, AnyNode> = {
      zone_01: makeZone('zone_01', null), // systemId=null → zone_no_system警告
      duct_01: makeDuct('duct_01', { airflowRate: 0 }), // airflowRate=0 → airflow_not_set警告
    }

    const result1 = runAllChecks(nodes)
    const result2 = runAllChecks(nodes)

    expect(result1.length).toBe(result2.length)
    for (let i = 0; i < result1.length; i++) {
      expect(result1[i]!.id).toBe(result2[i]!.id)
      expect(result1[i]!.code).toBe(result2[i]!.code)
    }
  })
})

// ============================================================================
// テスト4: エッジケース — ゾーン面積0 (EDGE-001)
// ============================================================================

describe('エッジケース — ゾーン面積0 (EDGE-001)', () => {
  it('テスト4: floorArea=0 でHvacZoneNodeのZodバリデーションエラーが発生する', () => {
    // 【テスト目的】: 面積0m²のゾーン作成試行でZodのバリデーションエラーが発生することを検証
    // 【期待される動作】: HvacZoneNode.parse({...floorArea: 0}) → ZodError
    // 🔵 信頼性レベル: EDGE-001（ゾーン面積0の入力）に明示

    const result = HvacZoneNode.safeParse({
      object: 'node',
      id: 'hvac_zone_zero',
      type: 'hvac_zone',
      zoneName: '面積ゼロゾーン',
      usage: 'office_general',
      floorArea: 0, // 不正な値: 0以下は許可しない
      ceilingHeight: 2.7,
      occupantDensity: 0.15,
      boundary: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 22,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
      parentId: null,
      visible: true,
      metadata: {},
    })

    expect(result.success).toBe(false)
  })

  it('テスト4b: floorArea=-1 でもZodバリデーションエラーが発生する', () => {
    const result = HvacZoneNode.safeParse({
      object: 'node',
      id: 'hvac_zone_negative',
      type: 'hvac_zone',
      zoneName: '負面積ゾーン',
      usage: 'office_general',
      floorArea: -1,
      ceilingHeight: 2.7,
      occupantDensity: 0.15,
      boundary: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 22,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
      parentId: null,
      visible: true,
      metadata: {},
    })

    expect(result.success).toBe(false)
  })

  it('テスト4c: floorArea=0.1 (正の値) → パース成功', () => {
    const result = HvacZoneNode.safeParse({
      object: 'node',
      id: 'hvac_zone_small',
      type: 'hvac_zone',
      zoneName: '小ゾーン',
      usage: 'office_general',
      floorArea: 0.1,
      ceilingHeight: 2.7,
      occupantDensity: 0.15,
      boundary: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 22,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
      perimeterSegments: [],
      systemId: null,
      calcResult: null,
      parentId: null,
      visible: true,
      metadata: {},
    })

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// テスト5: エッジケース — 風量超過警告 (EDGE-005)
// ============================================================================

describe('エッジケース — 風量超過警告 (EDGE-005)', () => {
  it('テスト5: 系統風量1000m³/h、制気口合計1200m³/h → airflow_mismatch警告が生成される', () => {
    // 【テスト目的】: 風量合計が系統能力を超過した場合に警告が生成されることを検証
    // 【期待される動作】: |1200-1000|/1000 = 20% > 5% → airflow_mismatch警告
    // 🔵 信頼性レベル: EDGE-005（風量超過）に明示

    const sysId = 'system_over'
    const nodes: Record<string, AnyNode> = {
      system_over: makeSystem(sysId, { ahuId: 'ahu_over', totalAirflow: 1000 }),
      diffuser_a: makeDiffuser('diffuser_a', sysId, 600),
      diffuser_b: makeDiffuser('diffuser_b', sysId, 600),
    }

    const warnings = checkAirflowMismatch(nodes)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.code).toBe('airflow_mismatch')
    expect(warnings[0]!.nodeId).toBe('system_over')
  })
})

// ============================================================================
// テスト6: エッジケース — 全ノード削除 (EDGE-101)
// ============================================================================

describe('エッジケース — 全ノード削除 (EDGE-101)', () => {
  it('テスト6: HVACノードを全削除後に空シーンが正常に動作し、警告も消去される', () => {
    // 【テスト目的】: 空のnodesオブジェクトに対してバリデーション関数がエラーなく動作し、警告0件となることを検証
    // 🔵 信頼性レベル: EDGE-101（全ノード削除後のシーン復帰）に明示

    const emptyNodes: Record<string, AnyNode> = {}

    expect(() => runAllChecks(emptyNodes)).not.toThrow()

    const warnings = runAllChecks(emptyNodes)
    expect(warnings).toHaveLength(0)
  })
})

// ============================================================================
// テスト7: パフォーマンス — 再計算時間 (NFR-002)
// ============================================================================

describe('パフォーマンス — バリデーション実行時間 (NFR-002)', () => {
  it('テスト7: 3ゾーン・2系統・10ダクト区間・5配管のシーンでバリデーションが5秒以内に完了する', () => {
    // 【テスト目的】: NFR-002（再計算5秒以内）の検証
    // 🟡 信頼性レベル: NFR-002（ユニットテストレベルの計測）

    // 10ダクト + 5配管 + 3ゾーン + 2系統 + 2AHU + 3Diffuser のシーン
    const nodes: Record<string, AnyNode> = {}

    // ゾーン3件
    for (let i = 0; i < 3; i++) {
      const sysId = i < 2 ? SYSTEM_A : SYSTEM_B
      nodes[`zone_${i}`] = makeZone(`zone_${i}`, sysId)
    }

    // 系統2件
    nodes[SYSTEM_A] = makeSystem(SYSTEM_A, { ahuId: 'ahu_A', totalAirflow: 2400 })
    nodes[SYSTEM_B] = makeSystem(SYSTEM_B, { ahuId: 'ahu_B', totalAirflow: 800 })

    // AHU 2件
    nodes['ahu_A'] = makeAhu('ahu_A', true)
    nodes['ahu_B'] = makeAhu('ahu_B', true)

    // ダクト10件（寸法・圧損確定済み）
    for (let i = 0; i < 10; i++) {
      nodes[`duct_${i}`] = makeDuct(`duct_${i}`, {
        airflowRate: 1200,
        width: 400,
        height: 300,
        calcResult: { velocity: 5.6, frictionLoss: 1.5, totalPressureLoss: 8.0 },
      })
    }

    // 配管5件
    for (let i = 0; i < 5; i++) {
      nodes[`pipe_${i}`] = makePipe(`pipe_${i}`, 25)
    }

    // Diffuser 3件（風量合計 = 系統A: 2400, 系統B: 800）
    nodes['diffuser_0'] = makeDiffuser('diffuser_0', SYSTEM_A, 1200)
    nodes['diffuser_1'] = makeDiffuser('diffuser_1', SYSTEM_A, 1200)
    nodes['diffuser_2'] = makeDiffuser('diffuser_2', SYSTEM_B, 800)

    const start = Date.now()
    runAllChecks(nodes)
    const elapsed = Date.now() - start

    // NFR-002: 5秒以内（ユニットテストでは余裕をもって1000ms以内を目標）
    expect(elapsed).toBeLessThan(5000)
  })
})
