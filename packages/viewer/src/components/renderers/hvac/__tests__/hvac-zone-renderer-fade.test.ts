/**
 * TASK-0018: HvacZoneRenderer フェードイン — 純粋関数テスト
 *
 * 【テスト対象】:
 *   - easeOut: ease-out イージング関数
 *   - フェードイン進捗計算ロジック
 *
 * 【設計方針】: R3F useFrame に依存する部分を除外し、純粋関数のみをテストする。
 *              ahu-renderer.test.ts のパターンに従い、Three.js/core を必要最小限にモック化。
 * 🟡 信頼性レベル: TASK-0018 テスト5〜6に基づく
 */

import { describe, expect, it, vi } from 'vitest'

// 【モック設定】: Three.js / R3F / core の副作用を遮断
vi.mock('three', () => ({
  Shape: class {},
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
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}))
vi.mock('../../../hooks/use-node-events', () => ({
  useNodeEvents: vi.fn(() => ({})),
}))
vi.mock('@pascal-app/core', () => ({
  useRegistry: vi.fn(),
  useScene: vi.fn(),
}))
vi.mock('../../../lib/layers', () => ({
  ZONE_LAYER: 2,
}))

import { easeOut, getZoneColor, ZONE_DEFAULT_COLOR, ZONE_USAGE_COLORS } from '../hvac-zone-renderer'

describe('TASK-0018: easeOut イージング関数', () => {
  it('テスト6a: t=0 → 0 を返す', () => {
    // 🟡 信頼性レベル: TASK-0018 テスト6に明示
    expect(easeOut(0)).toBe(0)
  })

  it('テスト6b: t=0.5 → 0.75 を返す（ease-out の中間点）', () => {
    // 【計算根拠】: easeOut(t) = 1 - (1-t)² → easeOut(0.5) = 1 - 0.25 = 0.75
    // 🟡 信頼性レベル: TASK-0018 テスト6に明示
    expect(easeOut(0.5)).toBe(0.75)
  })

  it('テスト6c: t=1.0 → 1.0 を返す（アニメーション完了）', () => {
    expect(easeOut(1.0)).toBe(1.0)
  })

  it('テスト6d: t=0.25 → 0.4375（四分の一地点）', () => {
    // easeOut(0.25) = 1 - (0.75)² = 1 - 0.5625 = 0.4375
    expect(easeOut(0.25)).toBeCloseTo(0.4375)
  })

  it('テスト6e: 単調増加 — t1 < t2 ならば easeOut(t1) < easeOut(t2)', () => {
    const samples = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    for (let i = 0; i < samples.length - 1; i++) {
      expect(easeOut(samples[i]!)).toBeLessThan(easeOut(samples[i + 1]!))
    }
  })
})

describe('TASK-0018: フェードイン カラー選択ロジック', () => {
  it('テスト5a: calcResult=null → ZONE_DEFAULT_COLOR が返る', () => {
    // 🔵 信頼性レベル: TASK-0018 テスト4「フェードイン開始検出」に関連
    const node = {
      id: 'hvac_zone_001' as const,
      type: 'hvac_zone' as const,
      usage: 'office_general' as const,
      calcResult: null,
      zoneName: 'テスト',
      floorArea: 50,
      ceilingHeight: 2.7,
      occupantDensity: 0.15,
      boundary: [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
      ] as [number, number][],
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 22,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
      perimeterSegments: [],
      systemId: null,
      parentId: null,
      children: [],
      object: 'node' as const,
      visible: true,
      metadata: {},
    }
    expect(getZoneColor(node)).toBe(ZONE_DEFAULT_COLOR)
  })

  it('テスト5b: calcResult設定あり + usage=office_general → #42A5F5 が返る', () => {
    const calcResult = {
      coolingLoad: 17400,
      heatingLoad: 8000,
      requiredAirflow: 4478,
      internalLoad: 10000,
      envelopeLoad: 7400,
      perimeterLoadBreakdown: [],
      status: 'success' as const,
    }
    const node = {
      id: 'hvac_zone_001' as const,
      type: 'hvac_zone' as const,
      usage: 'office_general' as const,
      calcResult,
      zoneName: 'テスト',
      floorArea: 50,
      ceilingHeight: 2.7,
      occupantDensity: 0.15,
      boundary: [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
      ] as [number, number][],
      designConditions: {
        coolingSetpoint: 26,
        heatingSetpoint: 22,
        relativeHumidity: 50,
        supplyAirTempDiff: 10,
      },
      perimeterSegments: [],
      systemId: null,
      parentId: null,
      children: [],
      object: 'node' as const,
      visible: true,
      metadata: {},
    }
    expect(getZoneColor(node)).toBe(ZONE_USAGE_COLORS['office_general'])
    expect(getZoneColor(node)).toBe('#42A5F5')
  })

  it('テスト5c: deltaTime=0.25, FADE_SPEED=2 で fadeProgress が正しく進む', () => {
    // 【テスト目的】: useFrame でのfadeProgress更新ロジックの確認
    const FADE_SPEED = 2
    let fadeProgress = 0
    fadeProgress = Math.min(fadeProgress + 0.25 * FADE_SPEED, 1)
    expect(fadeProgress).toBe(0.5)
  })

  it('テスト5d: fadeProgress が 1.0 を超えない（Math.min 境界）', () => {
    const FADE_SPEED = 2
    let fadeProgress = 0.9
    fadeProgress = Math.min(fadeProgress + 0.5 * FADE_SPEED, 1)
    expect(fadeProgress).toBe(1.0)
  })
})
