/**
 * TASK-0033: DuctVisualSystem — ダクト太さ・色・ラベル更新 単体テスト
 *
 * 【テスト対象】: duct-visual-system.tsx のエクスポートされた純粋ヘルパー関数
 *   - getDuctVisualState: 接続・寸法状態からビジュアル状態を決定
 *   - getDuctColor: 状態に応じたカラーコードを返す
 *   - calcDuctMeshScale: 断面比例スケールを算出
 *   - formatAirflowLabel: 風量ラベルのフォーマット
 *   - formatDimensionLabel: 寸法ラベルのフォーマット
 *
 * 【テストフレームワーク】: Vitest (packages/viewer/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0033 要件定義（REQ-1502）に明示
 */

import { describe, expect, it, vi } from 'vitest'

// Three.js を最小限にモック（循環依存エラーを回避）
vi.mock('three', () => ({
  MeshStandardMaterial: class {
    color = { setStyle: vi.fn() }
  },
}))

// @react-three/fiber をモック（React context 外での実行のため）
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}))

// @pascal-app/core をモック（sceneRegistry など）
vi.mock('@pascal-app/core', () => ({
  sceneRegistry: { byType: { duct_segment: new Set() }, nodes: new Map() },
  useScene: { getState: vi.fn(() => ({ nodes: {}, dirtyNodes: new Set() })) },
}))

import {
  DUCT_COLOR_CONNECTED,
  DUCT_COLOR_PARTIAL,
  DUCT_COLOR_UNSIZED,
  DUCT_MIN_SCALE,
  calcDuctMeshScale,
  formatAirflowLabel,
  formatDimensionLabel,
  getDuctColor,
  getDuctVisualState,
} from '../duct-visual-system'

// ============================================================================
// テスト1: 断面比例スケール計算 (REQ-1502)
// ============================================================================

describe('calcDuctMeshScale — 断面比例太さ更新', () => {
  it('TC-001: width=400mm, height=300mm → scale.x=0.4, scale.y=0.3', () => {
    // 【テスト目的】: mm → m 変換でメッシュスケールが正しく計算されることを検証
    // 【期待される動作】: 400mm → 0.4m, 300mm → 0.3m
    // 🔵 信頼性レベル: REQ-1502（断面比例太さ）に明示

    const scale = calcDuctMeshScale(400, 300)

    expect(scale.x).toBeCloseTo(0.4)
    expect(scale.y).toBeCloseTo(0.3)
  })

  it('TC-001b: 寸法が null のとき最小スケールが返される', () => {
    // 【期待される動作】: width/height が null → DUCT_MIN_SCALE
    const scale = calcDuctMeshScale(null, null)

    expect(scale.x).toBe(DUCT_MIN_SCALE)
    expect(scale.y).toBe(DUCT_MIN_SCALE)
  })
})

// ============================================================================
// テスト2: 寸法確定+両端接続済みの色 (REQ-1502)
// ============================================================================

describe('getDuctColor — 寸法確定+両端接続済み', () => {
  it('TC-002: width>0, height>0, 両端接続済み → #90CAF9（水色）', () => {
    // 【テスト目的】: 正常状態（寸法確定+両端接続）のカラーを検証
    // 【期待される動作】: getDuctColor('connected') = DUCT_COLOR_CONNECTED = '#90CAF9'
    // 🔵 信頼性レベル: REQ-1502（接続状態カラー）に明示

    const state = getDuctVisualState(400, 300, true, true)
    expect(state).toBe('connected')
    expect(getDuctColor(state)).toBe(DUCT_COLOR_CONNECTED)
    expect(getDuctColor(state)).toBe('#90CAF9')
  })
})

// ============================================================================
// テスト3: 片端未接続の色 (REQ-1502)
// ============================================================================

describe('getDuctColor — 片端未接続', () => {
  it('TC-003: width>0, height>0, 終端未接続 → #FFA726（オレンジ）', () => {
    // 【テスト目的】: 接続不完全状態のカラーを検証
    // 【期待される動作】: getDuctColor('partial') = DUCT_COLOR_PARTIAL = '#FFA726'
    // 🔵 信頼性レベル: REQ-1502（接続状態カラー）に明示

    const state = getDuctVisualState(400, 300, true, false)
    expect(state).toBe('partial')
    expect(getDuctColor(state)).toBe(DUCT_COLOR_PARTIAL)
    expect(getDuctColor(state)).toBe('#FFA726')
  })

  it('TC-003b: 始端未接続の場合も partial', () => {
    const state = getDuctVisualState(400, 300, false, true)
    expect(state).toBe('partial')
  })
})

// ============================================================================
// テスト4: 寸法未確定の色 (REQ-1502)
// ============================================================================

describe('getDuctColor — 寸法未確定', () => {
  it('TC-004: width=null, height=null → #BDBDBD（グレー）', () => {
    // 【テスト目的】: 寸法未確定状態のカラーを検証
    // 【期待される動作】: getDuctColor('unsized') = DUCT_COLOR_UNSIZED = '#BDBDBD'
    // 🔵 信頼性レベル: REQ-1502（寸法未確定カラー）に明示

    const state = getDuctVisualState(null, null, true, true)
    expect(state).toBe('unsized')
    expect(getDuctColor(state)).toBe(DUCT_COLOR_UNSIZED)
    expect(getDuctColor(state)).toBe('#BDBDBD')
  })

  it('TC-004b: width=0, height=0 → unsized', () => {
    const state = getDuctVisualState(0, 0, true, true)
    expect(state).toBe('unsized')
  })
})

// ============================================================================
// テスト5: 風量ラベル表示 (REQ-1502)
// ============================================================================

describe('formatAirflowLabel — 風量ラベル表示', () => {
  it('TC-005: airflowRate=600 m³/h → "600 m³/h"', () => {
    // 【テスト目的】: 風量ラベルが正しいフォーマットで生成されることを検証
    // 【期待される動作】: "600 m³/h" 形式のラベル
    // 🔵 信頼性レベル: REQ-1502（風量ラベル）に明示

    expect(formatAirflowLabel(600)).toBe('600 m³/h')
    expect(formatAirflowLabel(1200)).toBe('1200 m³/h')
    expect(formatAirflowLabel(360.5)).toBe('361 m³/h') // 四捨五入
  })
})

// ============================================================================
// テスト6: 寸法ラベル表示 (REQ-1502)
// ============================================================================

describe('formatDimensionLabel — 寸法ラベル表示', () => {
  it('TC-006: width=400mm, height=300mm → "400×300"', () => {
    // 【テスト目的】: 寸法ラベルが正しいフォーマットで生成されることを検証
    // 【期待される動作】: "400×300" 形式のラベル（mm単位）
    // 🔵 信頼性レベル: REQ-1502（寸法ラベル）に明示

    expect(formatDimensionLabel(400, 300)).toBe('400×300')
    expect(formatDimensionLabel(600, 400)).toBe('600×400')
    expect(formatDimensionLabel(500, 500)).toBe('500×500')
  })
})
