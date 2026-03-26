/**
 * TASK-0027: EquipmentCatalogPanel — 機器カタログ表示テスト
 *
 * 【テスト対象】: EquipmentCatalogPanel コンポーネント
 *   - AHUカタログ5機種の一覧表示
 *   - 選定状態バッジ（推奨/選定済み/未選定）の表示
 * 🔵 信頼性レベル: TASK-0027 要件定義（REQ-1404）に明示
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@pascal-app/core', () => ({
  useScene: vi.fn(),
}))

import { useScene } from '@pascal-app/core'
import { EquipmentCatalogPanel } from '../equipment-catalog-panel'

// --- テストデータ定義 ---

const mockAhuNodeB = {
  id: 'ahu_001',
  type: 'ahu' as const,
  tag: 'AHU-M-10000', // catalog modelId に対応
  equipmentName: '中型AHU 10000',
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  dimensions: { width: 2.4, height: 1.8, depth: 1.6 },
  ports: [],
  airflowRate: 10000,
  coolingCapacity: 60.0,
  heatingCapacity: 40.0,
  staticPressure: 400,
  systemId: 'system_001',
  parentId: null,
  children: [],
}

const mockSystemWithRecommended = {
  id: 'system_001',
  type: 'system' as const,
  systemName: 'AHU系統-1',
  servedZoneIds: [],
  ahuId: 'ahu_001',
  aggregatedLoad: null,
  status: 'equipment_selected' as const,
  selectionMargin: 1.1,
  equipmentCandidates: ['AHU-S-5000'],
  selectionStatus: 'candidates-available' as const,
  recommendedEquipmentId: 'AHU-S-5000', // 推奨
  parentId: null,
  children: [],
}

// --- セットアップ/クリーンアップ ---

beforeEach(() => {
  vi.mocked(useScene).mockImplementation((selector) => {
    const state = { nodes: {} }
    return selector ? selector(state as any) : state
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// --- テスト ---

describe('TASK-0027: EquipmentCatalogPanel', () => {
  it('テスト4: AHUカタログに5機種がリスト表示される', () => {
    // 【テスト目的】: AHUカタログの全5機種が画面に表示されることを確認
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト4」に明示
    render(<EquipmentCatalogPanel />)

    // 5機種のモデル名が表示される
    expect(screen.getByText('小型AHU 2000')).toBeDefined()
    expect(screen.getByText('中小型AHU 5000')).toBeDefined()
    expect(screen.getByText('中型AHU 10000')).toBeDefined()
    expect(screen.getByText('大型AHU 20000')).toBeDefined()
    expect(screen.getByText('特大型AHU 30000')).toBeDefined()
  })

  it('テスト5: 選定状態バッジ（推奨/選定済み/未選定）が正しく表示される', () => {
    // 【テスト目的】: 各カタログ機種に対応するステータスバッジが表示されることを確認
    //   - AHU-S-5000: 推奨（systemNode.recommendedEquipmentId）
    //   - AHU-M-10000: 選定済み（AhuNode.tag が一致）
    //   - その他: 未選定
    // 🔵 信頼性レベル: TASK-0027 単体テスト要件「テスト5」に明示
    vi.mocked(useScene).mockImplementation((selector) => {
      const state = {
        nodes: {
          system_001: mockSystemWithRecommended,
          ahu_001: mockAhuNodeB,
        },
      }
      return selector ? selector(state as any) : state
    })

    render(<EquipmentCatalogPanel />)

    // 推奨バッジ: AHU-S-5000（中小型AHU 5000）
    const recommendedBadges = screen.getAllByText('推奨')
    expect(recommendedBadges.length).toBeGreaterThan(0)

    // 選定済みバッジ: AHU-M-10000（中型AHU 10000）
    const selectedBadges = screen.getAllByText('選定済み')
    expect(selectedBadges.length).toBeGreaterThan(0)

    // 未選定バッジ: 残りの機種
    const unselectedBadges = screen.getAllByText('未選定')
    expect(unselectedBadges.length).toBeGreaterThan(0)
  })
})
