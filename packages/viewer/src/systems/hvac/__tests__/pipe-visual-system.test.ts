/**
 * TASK-0037: PipeVisualSystem — 配管色・太さ更新 単体テスト
 *
 * 【テスト対象】: pipe-visual-system.tsx のエクスポートされた純粋ヘルパー関数
 *   - getPipeVisualState: 接続・口径状態からビジュアル状態を決定
 *   - getPipeColor: 状態と媒体に応じたカラーコードを返す
 *   - calcPipeMeshScale: 外径比例スケールを算出
 *
 * 【テストフレームワーク】: Vitest (packages/viewer/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0037 要件定義（REQ-1503）に明示
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
  sceneRegistry: { byType: { pipe_segment: new Set() }, nodes: new Map() },
  useScene: { getState: vi.fn(() => ({ nodes: {}, dirtyNodes: new Set() })) },
}))

import {
  calcPipeMeshScale,
  getPipeColor,
  getPipeVisualState,
  PIPE_COLOR_CHILLED,
  PIPE_COLOR_CONDENSATE,
  PIPE_COLOR_HOT,
  PIPE_COLOR_UNSIZED,
  PIPE_MIN_SCALE,
} from '../pipe-visual-system'

// ============================================================================
// テスト: getPipeVisualState (REQ-1503)
// ============================================================================

describe('getPipeVisualState', () => {
  it('TC-001: nominalSize=50, 両端接続 → connected', () => {
    // 【テスト目的】: 口径確定 + 両端接続済みの場合に connected が返されることを検証
    // 【期待される動作】: 正常状態 = 'connected'
    // 🔵 信頼性レベル: REQ-1503（接続状態判定）に明示

    const state = getPipeVisualState(50, true, true)
    expect(state).toBe('connected')
  })

  it('TC-001b: nominalSize=null → unsized', () => {
    // 【テスト目的】: 口径が null の場合に unsized が返されることを検証
    // 【期待される動作】: 口径未確定 = 'unsized'
    // 🔵 信頼性レベル: REQ-1503（口径未確定状態）に明示

    const state = getPipeVisualState(null, true, true)
    expect(state).toBe('unsized')
  })

  it('TC-001c: nominalSize=0 → unsized', () => {
    // 【テスト目的】: 口径が 0 の場合に unsized が返されることを検証
    // 【期待される動作】: 0 は未確定扱い = 'unsized'
    // 🔵 信頼性レベル: REQ-1503（口径未確定状態）に明示

    const state = getPipeVisualState(0, true, true)
    expect(state).toBe('unsized')
  })

  it('TC-001d: nominalSize=50, 片端未接続 → partial', () => {
    // 【テスト目的】: 口径確定 + 片端未接続の場合に partial が返されることを検証
    // 【期待される動作】: 接続不完全 = 'partial'
    // 🔵 信頼性レベル: REQ-1503（接続不完全状態）に明示

    const state = getPipeVisualState(50, true, false)
    expect(state).toBe('partial')
  })
})

// ============================================================================
// テスト: getPipeColor (REQ-1503)
// ============================================================================

describe('getPipeColor', () => {
  it('TC-002: state=connected, medium=chilled_water → #0288D1', () => {
    // 【テスト目的】: 冷水配管の正常状態カラーを検証
    // 【期待される動作】: getPipeColor('connected', 'chilled_water') = PIPE_COLOR_CHILLED = '#0288D1'
    // 🔵 信頼性レベル: REQ-1503（配管媒体カラー）に明示

    const color = getPipeColor('connected', 'chilled_water')
    expect(color).toBe(PIPE_COLOR_CHILLED)
    expect(color).toBe('#0288D1')
  })

  it('TC-003: state=connected, medium=hot_water → #01579B', () => {
    // 【テスト目的】: 温水配管の正常状態カラーを検証
    // 【期待される動作】: getPipeColor('connected', 'hot_water') = PIPE_COLOR_HOT = '#01579B' (REQ-1503)
    // 🔵 信頼性レベル: REQ-1503（配管媒体カラー）に明示

    const color = getPipeColor('connected', 'hot_water')
    expect(color).toBe(PIPE_COLOR_HOT)
    expect(color).toBe('#01579B')
  })

  it('TC-003b: state=connected, medium=condensate → #78909C', () => {
    // 【テスト目的】: 冷媒ドレン配管のカラーを検証
    // 【期待される動作】: getPipeColor('connected', 'condensate') = PIPE_COLOR_CONDENSATE = '#78909C'
    // 🔵 信頼性レベル: REQ-1503（配管媒体カラー）に明示

    const color = getPipeColor('connected', 'condensate')
    expect(color).toBe(PIPE_COLOR_CONDENSATE)
    expect(color).toBe('#78909C')
  })

  it('TC-004: state=unsized → #BDBDBD regardless of medium', () => {
    // 【テスト目的】: 口径未確定状態では媒体に関わらずグレーが返されることを検証
    // 【期待される動作】: getPipeColor('unsized', any) = PIPE_COLOR_UNSIZED = '#BDBDBD'
    // 🔵 信頼性レベル: REQ-1503（口径未確定カラー）に明示

    expect(getPipeColor('unsized', 'chilled_water')).toBe(PIPE_COLOR_UNSIZED)
    expect(getPipeColor('unsized', 'hot_water')).toBe(PIPE_COLOR_UNSIZED)
    expect(getPipeColor('unsized', 'condensate')).toBe(PIPE_COLOR_UNSIZED)
    expect(getPipeColor('unsized', 'chilled_water')).toBe('#BDBDBD')
  })
})

// ============================================================================
// テスト: calcPipeMeshScale (REQ-1503)
// ============================================================================

describe('calcPipeMeshScale', () => {
  it('TC-005: outerDiameter=60.5mm → 0.0605', () => {
    // 【テスト目的】: mm → m 変換でメッシュスケールが正しく計算されることを検証
    // 【期待される動作】: 60.5mm → 0.0605m
    // 🔵 信頼性レベル: REQ-1503（外径比例太さ）に明示

    const scale = calcPipeMeshScale(60.5)
    expect(scale).toBeCloseTo(0.0605)
  })

  it('TC-006: outerDiameter=0 → PIPE_MIN_SCALE', () => {
    // 【テスト目的】: 外径が 0 の場合に最小スケールが返されることを検証
    // 【期待される動作】: 0 → PIPE_MIN_SCALE
    // 🔵 信頼性レベル: REQ-1503（口径未確定時の最小表示）に明示

    const scale = calcPipeMeshScale(0)
    expect(scale).toBe(PIPE_MIN_SCALE)
  })

  it('TC-007: outerDiameter=null → PIPE_MIN_SCALE', () => {
    // 【テスト目的】: 外径が null の場合に最小スケールが返されることを検証
    // 【期待される動作】: null → PIPE_MIN_SCALE
    // 🔵 信頼性レベル: REQ-1503（口径未確定時の最小表示）に明示

    const scale = calcPipeMeshScale(null)
    expect(scale).toBe(PIPE_MIN_SCALE)
  })
})
