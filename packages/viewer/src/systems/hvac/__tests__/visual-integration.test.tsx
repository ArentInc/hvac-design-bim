/**
 * TASK-0044: 画面表示仕様統合テスト — REQ-1502, REQ-1503準拠確認
 *
 * 【テスト対象】:
 *   - getDuctVisualState: ダクト寸法未確定→破線表示モード判定
 *   - getPipeColor: 配管冷水/温水色分け
 *
 * NOTE: ゾーンカラー(REQ-1501)とフォーマット(REQ-1505)は
 *       packages/core/src/__tests__/hvac-colors.test.ts で検証する。
 *
 * 【テストフレームワーク】: Vitest (packages/viewer/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0044 REQ-1502, REQ-1503に明示
 */

import { describe, expect, it, vi } from 'vitest'

// Three.js をモック
vi.mock('three', () => ({
  MeshStandardMaterial: class {
    color = { setStyle: vi.fn() }
  },
  MeshBasicMaterial: class {
    color = { set: vi.fn(), lerp: vi.fn(), copy: vi.fn() }
  },
  Shape: class {
    moveTo = vi.fn()
    lineTo = vi.fn()
    closePath = vi.fn()
  },
  Color: class {
    r = 0
    g = 0
    b = 0
    set(_c: string) {
      return this
    }
    lerp(_color: unknown, _t: number) {
      return this
    }
    copy(_c: unknown) {
      return this
    }
  },
  DoubleSide: 2,
}))

// @react-three/fiber をモック
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(),
}))

// @pascal-app/core をモック（定数を含む）
vi.mock('@pascal-app/core', () => ({
  sceneRegistry: {
    byType: { duct_segment: new Set(), pipe_segment: new Set(), hvac_zone: new Set() },
    nodes: new Map(),
  },
  useScene: Object.assign(
    vi.fn(() => undefined),
    {
      getState: vi.fn(() => ({ nodes: {}, dirtyNodes: new Set() })),
    },
  ),
  useRegistry: vi.fn(),
  useNodeEvents: vi.fn(() => ({})),
  ZONE_USAGE_COLORS: {
    office_general: '#42A5F5',
    conference: '#FFA726',
    reception: '#66BB6A',
    office_server: '#EF5350',
    corridor: '#BDBDBD',
  },
  ZONE_DEFAULT_COLOR: '#9E9E9E',
}))

import { getDuctVisualState } from '../duct-visual-system'
import { getPipeColor } from '../pipe-visual-system'

// ============================================================================
// テスト2: ダクト寸法未確定時の破線表示判定 (REQ-1502)
// ============================================================================

describe('getDuctVisualState — ダクト表示状態判定 (REQ-1502)', () => {
  it('テスト2: width=0, height=0 → 寸法未確定として unsized が返される', () => {
    // 【テスト目的】: 寸法未確定ダクトの表示状態が正しく判定されることを検証
    // 【期待される動作】: width=0, height=0 → 'unsized'（破線表示モード）
    // 🔵 信頼性レベル: REQ-1502（ダクト寸法未確定判定）に明示

    const state = getDuctVisualState(0, 0, true, true)

    expect(state).toBe('unsized')
  })

  it('テスト2b: width=null → unsized', () => {
    const state = getDuctVisualState(null, null, true, true)
    expect(state).toBe('unsized')
  })

  it('テスト2c: width=400, height=300, 両端接続済み → connected', () => {
    const state = getDuctVisualState(400, 300, true, true)
    expect(state).toBe('connected')
  })

  it('テスト2d: 寸法確定・片端未接続 → partial', () => {
    const state = getDuctVisualState(400, 300, true, false)
    expect(state).toBe('partial')
  })
})

// ============================================================================
// テスト3: 配管冷水/温水色分け (REQ-1503)
// ============================================================================

describe('getPipeColor — 配管色分け (REQ-1503)', () => {
  it('テスト3: medium=chilled_water (冷水) → #0288D1 が返される', () => {
    // 【テスト目的】: REQ-1503に定義された冷水配管カラーの正確性を検証
    // 🔵 信頼性レベル: REQ-1503（冷水配管カラー）に明示

    const color = getPipeColor('connected', 'chilled_water')

    expect(color).toBe('#0288D1')
  })

  it('テスト5: medium=hot_water (温水) → #01579B が返される', () => {
    // 【テスト目的】: REQ-1503に定義された温水配管カラーの正確性を検証
    // 【期待される動作】: hot_water → '#01579B'（ダークブルー）
    // 🔵 信頼性レベル: REQ-1503（温水配管カラー）に明示

    const color = getPipeColor('connected', 'hot_water')

    expect(color).toBe('#01579B')
  })

  it('テスト3b: state=unsized → #BDBDBD（媒体問わずグレー）', () => {
    const color = getPipeColor('unsized', 'chilled_water')
    expect(color).toBe('#BDBDBD')
  })
})
