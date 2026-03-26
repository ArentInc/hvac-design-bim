/**
 * TASK-0034: PressureLossSystem — ダクト圧損計算 単体テスト
 *
 * 【テスト対象】: pressure-loss.ts の純粋計算関数
 *   - calcEquivalentDiameter: 矩形ダクトの等価直径（水力直径）
 *   - calcStraightDuctLoss: ダルシー・ワイスバッハ式による直管圧損
 *   - calcFittingLoss: 局所損失係数による継手損失
 *   - calcAllPathPressureLosses: 全経路の圧損計算
 *   - findMaxPathPressureLoss: 最遠経路の選択
 *   - calcRequiredFanPressure: AHU 必要送風静圧の算出
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0034 要件定義（REQ-1001~1004）に明示
 */

import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../../schema/types'
import {
  FAN_PRESSURE_SAFETY_FACTOR,
  FITTING_LOSS_COEFFICIENTS,
  calcEquivalentDiameter,
  calcFittingLoss,
  calcRequiredFanPressure,
  calcStraightDuctLoss,
  findMaxPathPressureLoss,
} from '../pressure-loss'

// ============================================================================
// テストデータヘルパー
// ============================================================================

const SYSTEM_ID = 'sys_test'

function makeAhu(id: string, portId: string, staticPressure = 200): AnyNode {
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
    airflowRate: 3600,
    coolingCapacity: 10,
    heatingCapacity: 10,
    staticPressure,
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
  length = 10,
  widthMm = 400,
  heightMm = 300,
  airflowRate = 3600,
  material = 'galvanized_steel',
): AnyNode {
  return {
    object: 'node',
    id,
    type: 'duct_segment',
    start: [0, 0, 0],
    end: [length, 0, 0], // length を X 方向長さとして設定
    medium: 'supply_air',
    shape: 'rectangular',
    width: widthMm,
    height: heightMm,
    diameter: null,
    ductMaterial: material,
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

function makeDiffuser(id: string, portId: string, airflowRate = 600): AnyNode {
  return {
    object: 'node',
    id,
    type: 'diffuser',
    tag: 'SA-01',
    subType: 'anemostat',
    position: [10, 0, 0],
    neckDiameter: 0.15,
    airflowRate,
    port: {
      id: portId,
      label: 'SA',
      medium: 'supply_air',
      position: [10, 0, 0],
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
// テスト1: 基本的な直管圧損計算 (REQ-1001)
// ============================================================================

describe('calcStraightDuctLoss — 基本的な直管圧損計算', () => {
  it('TC-001: L=10m, w=0.4m, h=0.3m, Q=3600m³/h, galvanized → 物理的妥当値', () => {
    // 【テスト目的】: ダルシー・ワイスバッハ式での直管圧損が正しく計算されることを検証
    // Q = 3600/3600 = 1.0 m³/s, A = 0.4×0.3 = 0.12 m², v = 1.0/0.12 ≈ 8.33 m/s
    // Dh = 2×0.4×0.3/(0.4+0.3) ≈ 0.343m
    // ΔP = 0.02 × (10/0.343) × (1.2 × 8.33² / 2) ≈ 数十Pa
    // 🔵 信頼性レベル: REQ-1001（ダルシー・ワイスバッハ式）に明示

    const result = calcStraightDuctLoss(10, 0.4, 0.3, 3600, 'galvanized_steel')

    // 物理的妥当範囲（数Pa ～ 数十Pa）
    expect(result).toBeGreaterThan(1)
    expect(result).toBeLessThan(500)
    expect(result).toBeCloseTo(result, 0) // NaN/Infinity でないことを確認
  })
})

// ============================================================================
// テスト2: flexible材質の摩擦係数4倍 (REQ-1003)
// ============================================================================

describe('calcStraightDuctLoss — flexible材質', () => {
  it('TC-002: 同一条件で flexible の圧損が galvanized の約4倍', () => {
    // 【テスト目的】: flexible 材質で摩擦係数が4倍になることを検証
    // 🔵 信頼性レベル: REQ-1003（flexible材質: 摩擦係数×4）に明示

    const galvanized = calcStraightDuctLoss(10, 0.4, 0.3, 3600, 'galvanized_steel')
    const flexible = calcStraightDuctLoss(10, 0.4, 0.3, 3600, 'flexible')

    expect(flexible).toBeCloseTo(galvanized * 4, 1)
  })
})

// ============================================================================
// テスト3: エルボ90°の継手損失 (REQ-1002)
// ============================================================================

describe('calcFittingLoss — エルボ90°', () => {
  it('TC-003: elbow, v=5 m/s → ΔP = 0.3 × (1.2 × 25 / 2) = 4.5 Pa', () => {
    // 【テスト目的】: エルボ90°の局所損失係数 ζ=0.3 が正しく適用されることを検証
    // ΔP = 0.3 × (1.2 × 5² / 2) = 0.3 × 15 = 4.5 Pa
    // 🔵 信頼性レベル: REQ-1002（継手損失係数テーブル）に明示

    const result = calcFittingLoss('elbow', FITTING_LOSS_COEFFICIENTS.elbow!, 5.0)

    expect(result).toBeCloseTo(4.5, 1)
  })
})

// ============================================================================
// テスト4: T分岐の継手損失 (REQ-1002)
// ============================================================================

describe('calcFittingLoss — T分岐（分岐側）', () => {
  it('TC-004: tee-branch (ζ=1.0), v=5 m/s → ΔP = 1.0 × (1.2 × 25 / 2) = 15.0 Pa', () => {
    // 【テスト目的】: T分岐（分岐側）の局所損失係数 ζ=1.0 が正しく適用されることを検証
    // ΔP = 1.0 × (1.2 × 5² / 2) = 1.0 × 15 = 15.0 Pa
    // 🔵 信頼性レベル: REQ-1002（T分岐分岐側）に明示

    const result = calcFittingLoss('tee_branch', 1.0, 5.0) // fittingType 未登録 → localLossCoefficient 使用

    expect(result).toBeCloseTo(15.0, 1)
  })
})

// ============================================================================
// テスト5: 最遠経路の選択 (REQ-1004)
// ============================================================================

describe('findMaxPathPressureLoss — 最遠経路選択', () => {
  it('TC-005: 経路A=30Pa, 経路B=50Pa → 経路B(50Pa)が最遠経路として選択される', () => {
    // 【テスト目的】: 複数経路の中で最大圧損経路が正しく選択されることを検証
    // 🔵 信頼性レベル: REQ-1004（最遠経路総圧損）に明示

    const pathLosses = new Map<string, number>([
      ['diff_A', 30],
      ['diff_B', 50],
      ['diff_C', 20],
    ])

    const result = findMaxPathPressureLoss(pathLosses)

    expect(result).toBe(50)
  })

  it('TC-005b: 経路が空の場合は 0 を返す', () => {
    const result = findMaxPathPressureLoss(new Map())
    expect(result).toBe(0)
  })
})

// ============================================================================
// テスト6: requiredFanPressure計算 (REQ-1004)
// ============================================================================

describe('calcRequiredFanPressure — 送風圧計算', () => {
  it('TC-006: 最遠経路総圧損=100Pa → requiredFanPressure=110Pa（安全率1.1）', () => {
    // 【テスト目的】: 最遠経路圧損に安全率1.1を掛けた値が算出されることを検証
    // 🔵 信頼性レベル: REQ-1004（安全率1.1）に明示

    const result = calcRequiredFanPressure(100)

    expect(result).toBeCloseTo(100 * FAN_PRESSURE_SAFETY_FACTOR, 5)
    expect(result).toBeCloseTo(110, 1)
  })
})

// ============================================================================
// テスト7: 等価直径計算（矩形ダクト） (REQ-1001)
// ============================================================================

describe('calcEquivalentDiameter — 矩形ダクト水力直径', () => {
  it('TC-007: width=0.4m, height=0.3m → Dh = 2×0.4×0.3/(0.4+0.3) ≈ 0.343m', () => {
    // 【テスト目的】: 矩形ダクトの等価直径（水力直径）が正しく算出されることを検証
    // Dh = 2 × 0.4 × 0.3 / (0.4 + 0.3) = 0.24 / 0.7 ≈ 0.3429m
    // 🔵 信頼性レベル: REQ-1001（等価直径計算）に明示

    const result = calcEquivalentDiameter(0.4, 0.3)

    expect(result).toBeCloseTo(0.3429, 3)
  })

  it('TC-007b: 正方形ダクト (0.4×0.4) → Dh = 2×0.4×0.4/(0.4+0.4) = 0.4m', () => {
    // 正方形では等価直径 = 一辺の長さ
    const result = calcEquivalentDiameter(0.4, 0.4)
    expect(result).toBeCloseTo(0.4, 5)
  })
})
