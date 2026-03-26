/**
 * TASK-0044: 画面表示仕様統合テスト — REQ-1501〜1503, REQ-1505準拠確認
 *
 * 【テスト対象】:
 *   - getZoneColorByUsage: ゾーン用途別カラー取得（core定数）
 *   - getDuctVisualState: ダクト寸法未確定判定
 *   - getPipeColor: 配管冷水/温水色分け
 *   - formatHvacLoadValue: 右パネル数値フォーマット
 *
 * 【テストフレームワーク】: Vitest (packages/viewer/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0044 REQ-1501〜1503, REQ-1505に明示
 */

import { describe, expect, it, vi } from 'vitest'

// Three.js を最小限にモック
vi.mock('three', () => ({
  MeshStandardMaterial: class {
    color = { setStyle: vi.fn() }
  },
}))

// @react-three/fiber をモック
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}))

// @pascal-app/core をモック（sceneRegistry など）
vi.mock('@pascal-app/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pascal-app/core')>()
  return {
    ...actual,
    sceneRegistry: {
      byType: { duct_segment: new Set(), pipe_segment: new Set() },
      nodes: new Map(),
    },
    useScene: { getState: vi.fn(() => ({ nodes: {}, dirtyNodes: new Set() })) },
  }
})

import { formatHvacLoadValue, getZoneColorByUsage } from '@pascal-app/core'
import { getDuctVisualState } from '../duct-visual-system'
import { getPipeColor } from '../pipe-visual-system'

// ============================================================================
// テスト1: ゾーンカラーの用途別設定 (REQ-1501)
// ============================================================================

describe('getZoneColorByUsage — ゾーン用途別カラー (REQ-1501)', () => {
  it('テスト1: 用途が「事務室」(office_general) → 青系カラー #42A5F5 が返される', () => {
    // 【テスト目的】: REQ-1501に定義されたゾーン用途別カラーの正確性を検証
    // 【期待される動作】: office_general → '#42A5F5'
    // 🔵 信頼性レベル: REQ-1501（ゾーン用途カラー）に明示

    const color = getZoneColorByUsage('office_general')

    expect(color).toBe('#42A5F5')
  })

  it('テスト1b: 用途が「サーバー室」(office_server) → 赤系カラー #EF5350 が返される', () => {
    const color = getZoneColorByUsage('office_server')
    expect(color).toBe('#EF5350')
  })

  it('テスト1c: 未知の用途 → デフォルトカラー #9E9E9E が返される', () => {
    const color = getZoneColorByUsage('unknown_usage')
    expect(color).toBe('#9E9E9E')
  })
})

// ============================================================================
// テスト2: ダクト寸法未確定時の破線表示判定 (REQ-1502)
// ============================================================================

describe('getDuctVisualState — ダクト表示状態判定 (REQ-1502)', () => {
  it('テスト2: width=0, height=0 → 寸法未確定として unsized が返される', () => {
    // 【テスト目的】: 寸法未確定ダクトの表示状態が正しく判定されることを検証
    // 【期待される動作】: width=0, height=0 → 'unsized'（破線表示モード）
    // 🔵 信頼性レベル: REQ-1502（ダクト接続状態別表示）に明示

    const state = getDuctVisualState(0, 0, true, true)

    expect(state).toBe('unsized')
  })

  it('テスト2b: width=400, height=300, 両端接続済み → connected', () => {
    const state = getDuctVisualState(400, 300, true, true)
    expect(state).toBe('connected')
  })
})

// ============================================================================
// テスト3: 配管冷水色分け (REQ-1503)
// ============================================================================

describe('getPipeColor — 配管色分け (REQ-1503)', () => {
  it('テスト3: medium=chilled_water (冷水) → #0288D1 が返される', () => {
    // 【テスト目的】: REQ-1503に定義された冷水配管カラーの正確性を検証
    // 【期待される動作】: chilled_water, connected → '#0288D1'
    // 🔵 信頼性レベル: REQ-1503（冷水配管カラー）に明示

    const color = getPipeColor('connected', 'chilled_water')

    expect(color).toBe('#0288D1')
  })

  // ============================================================================
  // テスト5: 配管温水色 (REQ-1503)
  // ============================================================================

  it('テスト5: medium=hot_water (温水) → #01579B が返される', () => {
    // 【テスト目的】: REQ-1503に定義された温水配管カラーの正確性を検証
    // 【期待される動作】: hot_water, connected → '#01579B'（ダークブルー）
    // 🔵 信頼性レベル: REQ-1503（温水配管カラー）に明示

    const color = getPipeColor('connected', 'hot_water')

    expect(color).toBe('#01579B')
  })
})

// ============================================================================
// テスト4: 右パネルの数値フォーマット (REQ-1505, PRDセクション21.5)
// ============================================================================

describe('formatHvacLoadValue — 右パネル数値フォーマット (REQ-1505)', () => {
  it('テスト4: 冷房負荷 12345.678W → 「12,346 W」（整数、カンマ区切り）で表示される', () => {
    // 【テスト目的】: 右パネルの数値が日本語ロケール（カンマ区切り・単位付き）でフォーマットされることを検証
    // 【期待される動作】: 12345.678 → '12,346 W'（四捨五入、カンマ区切り）
    // 🔵 信頼性レベル: REQ-1505（右パネル表示フォーマット）に明示

    const formatted = formatHvacLoadValue(12345.678)

    expect(formatted).toBe('12,346 W')
  })

  it('テスト4b: 整数値 1000W → 「1,000 W」で表示される', () => {
    const formatted = formatHvacLoadValue(1000)
    expect(formatted).toBe('1,000 W')
  })

  it('テスト4c: 小数点切り捨て 500.4W → 「500 W」で表示される', () => {
    const formatted = formatHvacLoadValue(500.4)
    expect(formatted).toBe('500 W')
  })
})
