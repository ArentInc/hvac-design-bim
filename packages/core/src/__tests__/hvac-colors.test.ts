/**
 * TASK-0044: hvac-colors定数テスト — REQ-1501, REQ-1505
 *
 * 【テスト対象】:
 *   - getZoneColorByUsage: ゾーン用途別カラー取得
 *   - formatHvacLoadValue: 右パネル数値フォーマット
 *
 * 【テストフレームワーク】: Vitest (packages/core/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0044 REQ-1501, REQ-1505に明示
 */

import { describe, expect, it } from 'vitest'
import {
  formatHvacLoadValue,
  getZoneColorByUsage,
  ZONE_DEFAULT_COLOR,
  ZONE_USAGE_COLORS,
} from '../constants/hvac-colors'

// ============================================================================
// テスト1: ゾーンカラーの用途別設定 (REQ-1501)
// ============================================================================

describe('getZoneColorByUsage — ゾーン用途別カラー (REQ-1501)', () => {
  it('テスト1: 用途が office_general (事務室) → 青系カラー #42A5F5 が返される', () => {
    // 【テスト目的】: REQ-1501に定義された事務室用途カラーの正確性を検証
    // 🔵 信頼性レベル: REQ-1501（ゾーン用途カラー）に明示

    const color = getZoneColorByUsage('office_general')

    expect(color).toBe('#42A5F5')
    expect(ZONE_USAGE_COLORS['office_general']).toBe('#42A5F5')
  })

  it('テスト1b: 用途が office_server (サーバー室) → 赤系カラー #EF5350', () => {
    expect(getZoneColorByUsage('office_server')).toBe('#EF5350')
  })

  it('テスト1c: 用途が corridor (廊下) → グレー系 #BDBDBD', () => {
    expect(getZoneColorByUsage('corridor')).toBe('#BDBDBD')
  })

  it('テスト1d: 未知の用途 → デフォルトカラー #9E9E9E', () => {
    expect(getZoneColorByUsage('unknown')).toBe(ZONE_DEFAULT_COLOR)
    expect(ZONE_DEFAULT_COLOR).toBe('#9E9E9E')
  })
})

// ============================================================================
// テスト4: 右パネルの数値フォーマット (REQ-1505, PRDセクション21.5)
// ============================================================================

describe('formatHvacLoadValue — 右パネル数値フォーマット (REQ-1505)', () => {
  it('テスト4: 冷房負荷 12345.678W → 「12,346 W」（整数、カンマ区切り）で表示される', () => {
    // 【テスト目的】: 数値が四捨五入・カンマ区切り・単位付きでフォーマットされることを検証
    // 🔵 信頼性レベル: REQ-1505（右パネル表示フォーマット）に明示

    const formatted = formatHvacLoadValue(12345.678)

    expect(formatted).toBe('12,346 W')
  })

  it('テスト4b: 1000W → 「1,000 W」', () => {
    expect(formatHvacLoadValue(1000)).toBe('1,000 W')
  })

  it('テスト4c: 500.4W → 「500 W」（切り捨て）', () => {
    expect(formatHvacLoadValue(500.4)).toBe('500 W')
  })

  it('テスト4d: 500.5W → 「501 W」（四捨五入）', () => {
    expect(formatHvacLoadValue(500.5)).toBe('501 W')
  })
})
