/**
 * TASK-0031: AirflowDistributionSystem — 風量自動配分 単体テスト
 *
 * 【テスト対象】: airflow-distribution.ts の純粋計算関数
 *   - distributeAirflow: AHU起点グラフトラバースで各DuctSegmentの風量を合算
 *   - findDirtyAirflowSystems: dirtyNodesから再計算対象systemIdを特定
 *
 * 【単位】:
 *   - airflowRate: m³/h
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0031 要件定義（REQ-801~804, EDGE-004）に明示
 */

import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../../schema/types'
import { distributeAirflow, findDirtyAirflowSystems } from '../airflow-distribution'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const SYSTEM_ID = 'sys_test'

/** AHU ノードの最小構造を構築する */
function makeAhu(id: string, portId: string, airflowRate: number): AnyNode {
  return {
    object: 'node',
    id,
    type: 'ahu',
    tag: 'AHU-01',
    equipmentName: 'Test AHU',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    dimensions: { width: 1, height: 1, depth: 1 },
    ports: [
      {
        id: portId,
        label: 'SA',
        medium: 'supply_air',
        position: [0.5, 0, 0],
        direction: [1, 0, 0],
        connectedSegmentId: null,
      },
    ],
    airflowRate,
    coolingCapacity: 10,
    heatingCapacity: 10,
    staticPressure: 100,
    systemId: SYSTEM_ID,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

/** DuctSegment ノードの最小構造を構築する */
function makeDuctSegment(id: string, startPortId: string, endPortId: string): AnyNode {
  return {
    object: 'node',
    id,
    type: 'duct_segment',
    start: [0, 0, 0],
    end: [1, 0, 0],
    medium: 'supply_air',
    shape: 'rectangular',
    width: null,
    height: null,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate: null,
    startPortId,
    endPortId,
    systemId: SYSTEM_ID,
    calcResult: null,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

/** Diffuser ノードの最小構造を構築する */
function makeDiffuser(id: string, portId: string, airflowRate: number): AnyNode {
  return {
    object: 'node',
    id,
    type: 'diffuser',
    tag: 'SA-01',
    subType: 'anemostat',
    position: [2, 0, 0],
    neckDiameter: 0.15,
    airflowRate,
    port: {
      id: portId,
      label: 'SA',
      medium: 'supply_air',
      position: [2, 0, 0],
      direction: [0, -1, 0],
      connectedSegmentId: null,
    },
    hostDuctId: null,
    systemId: SYSTEM_ID,
    zoneId: 'zone_test',
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

/** DuctFitting (Tee) ノードの最小構造を構築する */
function makeTee(id: string, inPortId: string, out1PortId: string, out2PortId: string): AnyNode {
  return {
    object: 'node',
    id,
    type: 'duct_fitting',
    fittingType: 'tee',
    position: [1, 0, 0],
    rotation: [0, 0, 0],
    ports: [
      {
        id: inPortId,
        label: 'IN',
        medium: 'supply_air',
        position: [1, 0, -0.1],
        direction: [0, 0, -1],
        connectedSegmentId: null,
      },
      {
        id: out1PortId,
        label: 'OUT1',
        medium: 'supply_air',
        position: [1, 0, 0.1],
        direction: [0, 0, 1],
        connectedSegmentId: null,
      },
      {
        id: out2PortId,
        label: 'OUT2',
        medium: 'supply_air',
        position: [1.1, 0, 0],
        direction: [1, 0, 0],
        connectedSegmentId: null,
      },
    ],
    localLossCoefficient: 0.5,
    systemId: SYSTEM_ID,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

// ============================================================================
// テスト1: 単一経路の風量配分
// ============================================================================

describe('distributeAirflow — 単一経路', () => {
  it('TC-001: AHU → Segment1 → Diffuser(300) のとき Segment1.airflowRate = 300', () => {
    // 【テスト目的】: 最もシンプルな直線経路での風量配分を検証
    // 【テスト内容】: AHU直下の1本のセグメントが制気口風量300 m³/hを継承する
    // 【期待される動作】: 葉ノード(Diffuser)の風量が上流セグメントに伝播される
    // 🔵 信頼性レベル: TASK-0031 テスト1（REQ-801, REQ-802）に明記

    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_1: makeDuctSegment('seg_1', 'ahu_port_sa', 'diff_port_sa'),
      diff_1: makeDiffuser('diff_1', 'diff_port_sa', 300),
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    expect(result.errors).toHaveLength(0)
    expect(result.airflowMap.get('seg_1')).toBe(300)
  })
})

// ============================================================================
// テスト2: T分岐の風量合算
// ============================================================================

describe('distributeAirflow — T分岐', () => {
  it('TC-002: AHU → Seg1 → Tee → Seg2(200)/Seg3(100) のとき各セグメントの風量が正しく合算される', () => {
    // 【テスト目的】: T分岐（DuctFitting tee）での風量合算を検証
    // 【テスト内容】: 2つの下流セグメントの風量が分岐点で合算され上流に伝播される
    // 【期待される動作】:
    //   Seg2.airflowRate = 200, Seg3.airflowRate = 100, Seg1.airflowRate = 300
    // 🔵 信頼性レベル: TASK-0031 テスト2（REQ-801 T分岐合算）に明記

    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_1: makeDuctSegment('seg_1', 'ahu_port_sa', 'tee_in'),
      tee_1: makeTee('tee_1', 'tee_in', 'tee_out1', 'tee_out2'),
      seg_2: makeDuctSegment('seg_2', 'tee_out1', 'diff1_port'),
      seg_3: makeDuctSegment('seg_3', 'tee_out2', 'diff2_port'),
      diff_1: makeDiffuser('diff_1', 'diff1_port', 200),
      diff_2: makeDiffuser('diff_2', 'diff2_port', 100),
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    expect(result.errors).toHaveLength(0)
    expect(result.airflowMap.get('seg_1')).toBe(300)
    expect(result.airflowMap.get('seg_2')).toBe(200)
    expect(result.airflowMap.get('seg_3')).toBe(100)
  })
})

// ============================================================================
// テスト3: 多段分岐の風量合算
// ============================================================================

describe('distributeAirflow — 多段分岐', () => {
  it('TC-003: AHU → 幹線 → Tee1 → 枝1(150) / Tee2 → 枝2(100) / 枝3(50) の多段分岐', () => {
    // 【テスト目的】: 2段のT分岐がある複雑なルートでの風量合算を検証
    // 【テスト内容】:
    //   幹線=300, Tee1下流=300, 枝1=150, Tee2下流=150, 枝2=100, 枝3=50
    // 🔵 信頼性レベル: TASK-0031 テスト3（REQ-801 多段分岐）に明記

    // AHU → seg_main → tee1 → seg_branch1 → diff1(150)
    //                        → seg_mid    → tee2 → seg_branch2 → diff2(100)
    //                                             → seg_branch3 → diff3(50)
    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_main: makeDuctSegment('seg_main', 'ahu_port_sa', 'tee1_in'),
      tee_1: makeTee('tee_1', 'tee1_in', 'tee1_out1', 'tee1_out2'),
      seg_branch1: makeDuctSegment('seg_branch1', 'tee1_out1', 'diff1_port'),
      seg_mid: makeDuctSegment('seg_mid', 'tee1_out2', 'tee2_in'),
      tee_2: makeTee('tee_2', 'tee2_in', 'tee2_out1', 'tee2_out2'),
      seg_branch2: makeDuctSegment('seg_branch2', 'tee2_out1', 'diff2_port'),
      seg_branch3: makeDuctSegment('seg_branch3', 'tee2_out2', 'diff3_port'),
      diff_1: makeDiffuser('diff_1', 'diff1_port', 150),
      diff_2: makeDiffuser('diff_2', 'diff2_port', 100),
      diff_3: makeDiffuser('diff_3', 'diff3_port', 50),
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    expect(result.errors).toHaveLength(0)
    expect(result.airflowMap.get('seg_main')).toBe(300)
    expect(result.airflowMap.get('seg_branch1')).toBe(150)
    expect(result.airflowMap.get('seg_mid')).toBe(150)
    expect(result.airflowMap.get('seg_branch2')).toBe(100)
    expect(result.airflowMap.get('seg_branch3')).toBe(50)
  })
})

// ============================================================================
// テスト4: AHU幹線風量検証 — 整合（差異5%以内）
// ============================================================================

describe('distributeAirflow — AHU幹線風量検証', () => {
  it('TC-004: AHU定格500 m³/h、幹線合算=480 m³/h (差異4%) のとき警告なし', () => {
    // 【テスト目的】: AHU定格風量と幹線合算風量が許容範囲内のとき警告が発生しないことを検証
    // 【テスト内容】: 差異4% < 許容5% → 警告なし
    // 【期待される動作】: warnings が空
    // 🔵 信頼性レベル: TASK-0031 テスト4（REQ-803 整合）に明記

    // Diffuser2つ合計480 m³/h、AHU定格500 m³/h → 差異4%
    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_main: makeDuctSegment('seg_main', 'ahu_port_sa', 'tee_in'),
      tee_1: makeTee('tee_1', 'tee_in', 'tee_out1', 'tee_out2'),
      seg_1: makeDuctSegment('seg_1', 'tee_out1', 'diff1_port'),
      seg_2: makeDuctSegment('seg_2', 'tee_out2', 'diff2_port'),
      diff_1: makeDiffuser('diff_1', 'diff1_port', 280),
      diff_2: makeDiffuser('diff_2', 'diff2_port', 200),
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.airflowMap.get('seg_main')).toBe(480)
  })
})

// ============================================================================
// テスト5: AHU幹線風量不整合警告
// ============================================================================

describe('distributeAirflow — AHU幹線風量不整合', () => {
  it('TC-005: AHU定格500 m³/h、幹線合算=300 m³/h (差異40%) のとき不整合警告が発生する', () => {
    // 【テスト目的】: AHU定格風量と幹線合算風量の差異が許容範囲を超えたとき警告を検証
    // 【テスト内容】: 差異40% > 許容5% → 警告発生
    // 【期待される動作】: warnings に AHU幹線不整合警告が1件
    // 🔵 信頼性レベル: TASK-0031 テスト5（REQ-803 不整合）に明記

    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_1: makeDuctSegment('seg_1', 'ahu_port_sa', 'diff_port'),
      diff_1: makeDiffuser('diff_1', 'diff_port', 300),
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('AHU直近幹線')
    expect(result.warnings[0]).toContain('300')
    expect(result.warnings[0]).toContain('500')
  })
})

// ============================================================================
// テスト6: サイクル検出
// ============================================================================

describe('distributeAirflow — サイクル検出', () => {
  it('TC-006: AHU → seg_main → teeA → seg1 → teeB → seg2 → teeA の循環グラフで中断+エラー', () => {
    // 【テスト目的】: ダクト接続にサイクル（ループ）がある場合の安全な中断を検証
    // 【テスト内容】: AHU → seg_main → teeA → seg1 → teeB → seg2 → teeA (循環)
    //               teeA と teeB が seg1, seg2 で互いに接続 → 有向グラフ上のサイクル
    // 【期待される動作】: errors に「ループ検出」メッセージが含まれる、airflowMap は空
    // 🔵 信頼性レベル: TASK-0031 テスト6（EDGE-004 サイクル検出）に明記

    // グラフ構造:
    //   AHU ──seg_main──> teeA ──seg1──> teeB
    //                      ^               |
    //                      └────seg2───────┘  ← サイクル
    //
    // ポートID割り当て:
    //   seg_main: ahu_port_sa → teeA_in
    //   seg1:     teeA_out1   → teeB_in
    //   seg2:     teeB_out1   → teeA_out2  (teeA の第3ポートに戻る = サイクル)
    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_main: makeDuctSegment('seg_main', 'ahu_port_sa', 'teeA_in'),
      duct_fit_tee_A: {
        object: 'node',
        id: 'duct_fit_tee_A',
        type: 'duct_fitting',
        fittingType: 'tee',
        position: [1, 0, 0],
        rotation: [0, 0, 0],
        ports: [
          {
            id: 'teeA_in',
            label: 'IN',
            medium: 'supply_air',
            position: [0, 0, -0.1],
            direction: [0, 0, -1],
            connectedSegmentId: null,
          },
          {
            id: 'teeA_out1',
            label: 'OUT1',
            medium: 'supply_air',
            position: [0, 0, 0.1],
            direction: [0, 0, 1],
            connectedSegmentId: null,
          },
          {
            id: 'teeA_out2',
            label: 'OUT2',
            medium: 'supply_air',
            position: [0.1, 0, 0],
            direction: [1, 0, 0],
            connectedSegmentId: null,
          },
        ],
        localLossCoefficient: 0.5,
        systemId: SYSTEM_ID,
        parentId: null,
        visible: true,
        metadata: {},
      } as AnyNode,
      seg_1: makeDuctSegment('seg_1', 'teeA_out1', 'teeB_in'),
      tee_B: makeTee('tee_B', 'teeB_in', 'teeB_out1', 'teeB_out2'),
      // seg_2 が teeB_out1 から teeA_out2 に戻る → サイクル形成
      seg_2: makeDuctSegment('seg_2', 'teeB_out1', 'teeA_out2'),
    }

    const result = distributeAirflow(SYSTEM_ID, nodes)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('ループ')
    expect(result.airflowMap.size).toBe(0)
  })
})

// ============================================================================
// テスト7: Diffuser風量変更による再計算対象の特定
// ============================================================================

describe('findDirtyAirflowSystems — 再計算対象システム特定', () => {
  it('TC-007: DiffuserのairflowRateが変更（dirty）されたとき対応するsystemIdが返される', () => {
    // 【テスト目的】: DiffuserがdirtyになったときのsystemId特定を検証 (REQ-804)
    // 【テスト内容】: dirtyNodesにDiffuserのIDが含まれる場合、そのsystemIdがSetに含まれる
    // 【期待される動作】: findDirtyAirflowSystems が SYSTEM_ID を含む Set を返す
    // 🔵 信頼性レベル: TASK-0031 テスト7（REQ-804 手動上書き再計算）に明記

    const diffuser = makeDiffuser('diff_1', 'diff_port', 300)
    const nodes: Record<string, AnyNode> = {
      diff_1: diffuser,
    }

    const dirtyIds = new Set(['diff_1'])
    const result = findDirtyAirflowSystems(dirtyIds, nodes)

    expect(result.has(SYSTEM_ID)).toBe(true)
  })

  it('TC-007b: DuctSegment / AHU が dirty のときも対応するsystemIdが返される', () => {
    // 【テスト目的】: 複数ノードタイプでのdirty検知を確認
    // 🔵 信頼性レベル: TASK-0031 実装詳細セクション1（再計算トリガー条件）に明示

    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa', 500),
      seg_1: makeDuctSegment('seg_1', 'ahu_port_sa', 'diff_port'),
    }

    const dirtyIds = new Set(['ahu_1', 'seg_1'])
    const result = findDirtyAirflowSystems(dirtyIds, nodes)

    expect(result.has(SYSTEM_ID)).toBe(true)
  })
})
