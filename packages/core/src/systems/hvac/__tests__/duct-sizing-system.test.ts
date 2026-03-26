/**
 * TASK-0032: DuctSizingSystem — ダクト寸法選定 単体テスト
 *
 * 【テスト対象】: duct-sizing.ts の純粋計算関数
 *   - calcDuctSize: 等速法でダクト寸法を算出
 *   - snapToStandardDim: 個別寸法を標準サイズにスナップ
 *   - applyAspectRatioConstraint: アスペクト比 ≤ 4.0 制約を適用
 *   - selectDuctVelocity: 幹線/枝線に応じた推奨風速を選択
 *   - findDirtyDuctSegmentsForSizing: dirty ノードから寸法選定対象を抽出
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0032 要件定義（REQ-901~903）に明示
 */

import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../../schema/types'
import {
  BRANCH_DUCT_VELOCITY_MS,
  MAIN_DUCT_VELOCITY_MS,
  applyAspectRatioConstraint,
  calcDuctSize,
  findDirtyDuctSegmentsForSizing,
  selectDuctVelocity,
  snapToStandardDim,
} from '../duct-sizing'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const SYSTEM_ID = 'sys_test'

function makeAhu(id: string, portId: string): AnyNode {
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
    airflowRate: 7200,
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
  startPortId: string,
  endPortId: string,
  airflowRate: number | null = null,
): AnyNode {
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
    airflowRate,
    startPortId,
    endPortId,
    systemId: SYSTEM_ID,
    calcResult: null,
    parentId: null,
    visible: true,
    metadata: {},
  } as AnyNode
}

function makeDiffuser(id: string, portId: string): AnyNode {
  return {
    object: 'node',
    id,
    type: 'diffuser',
    tag: 'SA-01',
    subType: 'anemostat',
    position: [2, 0, 0],
    neckDiameter: 0.15,
    airflowRate: 360,
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

// ============================================================================
// テスト1: 基本的な等速法計算 (REQ-901)
// ============================================================================

describe('calcDuctSize — 基本的な等速法計算', () => {
  it('TC-001: airflowRate=3600 m³/h, velocity=5.0 m/s → 断面積0.2m²から寸法を選定', () => {
    // 【テスト目的】: 等速法で断面積を算出し、標準サイズにスナップすることを検証
    // Q = 3600/3600 = 1.0 m³/s, A = 1.0/5.0 = 0.2 m², side = √0.2 ≈ 447mm → 500mm
    // 🔵 信頼性レベル: REQ-901（等速法）に明示

    const result = calcDuctSize(3600, 5.0)

    expect(result).not.toBeNull()
    // 断面積 width×height ≥ 0.2 m² = 200000 mm²
    const area = result!.width * result!.height
    expect(area).toBeGreaterThanOrEqual(200000)
    // アスペクト比 ≤ 4.0
    const aspect = Math.max(result!.width, result!.height) / Math.min(result!.width, result!.height)
    expect(aspect).toBeLessThanOrEqual(4.0)
  })
})

// ============================================================================
// テスト2: 幹線風速適用 (REQ-902)
// ============================================================================

describe('selectDuctVelocity — 幹線風速適用', () => {
  it('TC-002: AHU直近の DuctSegment → 幹線風速 7 m/s が適用される', () => {
    // 【テスト目的】: AHU直近セグメントに幹線推奨風速が選択されることを検証
    // 【期待される動作】: selectDuctVelocity が MAIN_DUCT_VELOCITY_MS (7) を返す
    // 🔵 信頼性レベル: REQ-902（幹線推奨風速 6~8 m/s）に明示

    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa'),
      seg_main: makeDuctSegment('seg_main', 'ahu_port_sa', 'diff_port', 7200),
      diff_1: makeDiffuser('diff_1', 'diff_port'),
    }

    const velocity = selectDuctVelocity('seg_main', SYSTEM_ID, nodes)

    expect(velocity).toBe(MAIN_DUCT_VELOCITY_MS)

    // calcDuctSize で使用した場合の断面積確認
    const area = 7200 / 3600 / MAIN_DUCT_VELOCITY_MS // ≈ 0.286 m²
    expect(area).toBeCloseTo(0.286, 2)
  })
})

// ============================================================================
// テスト3: 枝線風速適用 (REQ-902)
// ============================================================================

describe('selectDuctVelocity — 枝線風速適用', () => {
  it('TC-003: 末端 DuctSegment (AHU直近でない) → 枝線風速 4 m/s が適用される', () => {
    // 【テスト目的】: AHU直近でないセグメントに枝線推奨風速が選択されることを検証
    // 【期待される動作】: selectDuctVelocity が BRANCH_DUCT_VELOCITY_MS (4) を返す
    // 🔵 信頼性レベル: REQ-902（枝線推奨風速 3~5 m/s）に明示

    const nodes: Record<string, AnyNode> = {
      ahu_1: makeAhu('ahu_1', 'ahu_port_sa'),
      seg_main: makeDuctSegment('seg_main', 'ahu_port_sa', 'mid_port', 360),
      seg_branch: makeDuctSegment('seg_branch', 'mid_port', 'diff_port', 360),
      diff_1: makeDiffuser('diff_1', 'diff_port'),
    }

    const velocity = selectDuctVelocity('seg_branch', SYSTEM_ID, nodes)

    expect(velocity).toBe(BRANCH_DUCT_VELOCITY_MS)

    // calcDuctSize で使用した場合の断面積確認
    const area = 360 / 3600 / BRANCH_DUCT_VELOCITY_MS // = 0.025 m²
    expect(area).toBeCloseTo(0.025, 3)
  })
})

// ============================================================================
// テスト4: 標準サイズスナップ (REQ-902)
// ============================================================================

describe('snapToStandardDim — 標準サイズスナップ', () => {
  it('TC-004: 273mm → 300mm にスナップされる', () => {
    // 【テスト目的】: 計算値以上の最小標準寸法へのスナップを検証
    // 【期待される動作】: 273mm → 300mm（次の標準寸法）
    // 🔵 信頼性レベル: REQ-902（標準サイズスナップ）に明示

    expect(snapToStandardDim(273)).toBe(300)
    expect(snapToStandardDim(300)).toBe(300)
    expect(snapToStandardDim(301)).toBe(350)
    expect(snapToStandardDim(200)).toBe(200)
  })
})

// ============================================================================
// テスト5: アスペクト比制約 (REQ-903)
// ============================================================================

describe('applyAspectRatioConstraint — アスペクト比制約', () => {
  it('TC-005: width=1000mm, height=200mm (比率5.0) → height が 4.0 以下に調整される', () => {
    // 【テスト目的】: アスペクト比 > 4.0 のとき短辺が拡大されることを検証
    // width/height = 1000/200 = 5.0 → 制約超過
    // requiredHeight = 1000/4.0 = 250mm → snapToStandardDim(250) = 250mm
    // 🔵 信頼性レベル: REQ-903（アスペクト比≤4.0）に明示

    const result = applyAspectRatioConstraint(1000, 200)

    expect(result.width).toBe(1000)
    expect(result.height).toBeGreaterThanOrEqual(250)
    const aspect = result.width / result.height
    expect(aspect).toBeLessThanOrEqual(4.0)
  })
})

// ============================================================================
// テスト6: アスペクト比制約後の標準サイズスナップ (REQ-902, REQ-903)
// ============================================================================

describe('applyAspectRatioConstraint — 制約後スナップ', () => {
  it('TC-006: 調整値240mm → 250mm にスナップされる', () => {
    // 【テスト目的】: アスペクト比制約適用後に標準サイズへスナップされることを検証
    // width=960mm の場合: requiredHeight = 960/4 = 240mm → snapToStandardDim(240) = 250mm
    // 🔵 信頼性レベル: REQ-903（制約後スナップ）に明示

    const result = applyAspectRatioConstraint(960, 200)

    expect(result.width).toBe(960)
    expect(result.height).toBe(250)
    const aspect = result.width / result.height
    expect(aspect).toBeLessThanOrEqual(4.0)
  })
})

// ============================================================================
// テスト7: 風量ゼロ時のスキップ
// ============================================================================

describe('calcDuctSize — 風量ゼロ時スキップ', () => {
  it('TC-007: airflowRate=0 → null が返され寸法選定がスキップされる', () => {
    // 【テスト目的】: 風量ゼロのとき寸法選定を安全にスキップすることを検証
    // 【期待される動作】: calcDuctSize が null を返す
    // 🔵 信頼性レベル: TASK-0032 注意事項（ゼロ風量スキップ）に明示

    expect(calcDuctSize(0, 5.0)).toBeNull()
    expect(calcDuctSize(-100, 5.0)).toBeNull()
  })

  it('TC-007b: dirty ノードに airflowRate=null のセグメントが含まれる場合はスキップされる', () => {
    // 【テスト目的】: findDirtyDuctSegmentsForSizing が風量未設定セグメントを除外することを検証
    // 🔵 信頼性レベル: TASK-0032 実装詳細セクション1に明示

    const nodes: Record<string, AnyNode> = {
      seg_a: makeDuctSegment('seg_a', 'port1', 'port2', null),  // 風量未設定
      seg_b: makeDuctSegment('seg_b', 'port3', 'port4', 600),   // 風量あり
    }

    const result = findDirtyDuctSegmentsForSizing(new Set(['seg_a', 'seg_b']), nodes)

    expect(result).not.toContain('seg_a')
    expect(result).toContain('seg_b')
  })
})
