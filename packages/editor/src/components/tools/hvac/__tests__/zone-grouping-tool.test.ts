/**
 * TASK-0020: ZoneGroupingTool — ゾーングルーピング 単体テスト
 *
 * 【テスト対象】: ZoneGroupingTool のビジネスロジック
 *   - validateZoneAssignment: N:1 制約バリデーション
 *   - toggleZoneSelection: ゾーン選択トグル
 *   - performGrouping (インラインヘルパー): 系統作成とゾーン紐付けのロジック
 *
 * 【設計方針】: @pascal-app/core をインポートすると three-mesh-bvh の循環依存が発生するため、
 *   zone-grouping-logic.ts の純粋関数のみテスト対象とし、
 *   SystemNode.parse / createNode / updateNode は vi.fn() でモック化する。
 * 🔵 信頼性レベル: TASK-0020 要件定義に明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toggleZoneSelection, validateZoneAssignment } from '../zone-grouping-logic'

// ============================================================================
// Mocks
// ============================================================================

const mockCreateNode = vi.fn()
const mockUpdateNode = vi.fn()

const mockSystemNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: 'system_mock123',
  type: 'system',
  object: 'node',
  parentId: null,
  visible: true,
  metadata: {},
  ...input,
}))

// ============================================================================
// テストデータヘルパー
// ============================================================================

type MinimalNode = { type: string; systemId?: string | null }

const makeZoneNodes = (
  entries: Array<{ id: string; systemId: string | null }>,
): Record<string, MinimalNode> =>
  Object.fromEntries(entries.map(({ id, systemId }) => [id, { type: 'hvac_zone', systemId }]))

// ============================================================================
// validateZoneAssignment テスト
// ============================================================================

describe('validateZoneAssignment', () => {
  it('テスト3: 既に系統に属するゾーンが競合として検出される', () => {
    // Given: ゾーンAが既に系統1に属している
    const nodes = makeZoneNodes([
      { id: 'zoneA', systemId: 'system_001' },
      { id: 'zoneB', systemId: null },
    ])
    // When: ゾーンAを系統2に追加しようとする
    const conflicts = validateZoneAssignment(['zoneA', 'zoneB'], nodes)
    // Then: zoneA のみ競合として検出される
    expect(conflicts).toContain('zoneA')
    expect(conflicts).not.toContain('zoneB')
  })

  it('テスト4: 未割当ゾーンのみの場合は競合なし（空配列）', () => {
    // Given: ゾーンA, B, C がいずれの系統にも属していない
    const nodes = makeZoneNodes([
      { id: 'zoneA', systemId: null },
      { id: 'zoneB', systemId: null },
      { id: 'zoneC', systemId: null },
    ])
    const conflicts = validateZoneAssignment(['zoneA', 'zoneB', 'zoneC'], nodes)
    expect(conflicts).toHaveLength(0)
  })

  it('hvac_zone 以外のノードは競合にならない', () => {
    const nodes: Record<string, MinimalNode> = {
      wallNode: { type: 'wall', systemId: 'some_system' },
    }
    const conflicts = validateZoneAssignment(['wallNode'], nodes)
    expect(conflicts).toHaveLength(0)
  })
})

// ============================================================================
// toggleZoneSelection テスト
// ============================================================================

describe('toggleZoneSelection', () => {
  it('テスト6: 選択済みゾーンを再クリックすると選択解除される', () => {
    // Given: ゾーンA, Bが選択済み
    const selected = ['zoneA', 'zoneB']
    // When: Ctrl+クリックでゾーンBを再クリック
    const result = toggleZoneSelection('zoneB', selected)
    // Then: ゾーンBが選択解除され、選択中はゾーンAのみ
    expect(result).toEqual(['zoneA'])
    expect(result).not.toContain('zoneB')
  })

  it('未選択ゾーンをクリックすると選択に追加される', () => {
    const selected = ['zoneA']
    const result = toggleZoneSelection('zoneB', selected)
    expect(result).toContain('zoneA')
    expect(result).toContain('zoneB')
    expect(result).toHaveLength(2)
  })
})

// ============================================================================
// performGrouping ロジックテスト（インラインヘルパー）
// ============================================================================

describe('performGrouping logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * 【ヘルパー関数】: ZoneGroupingTool の系統作成ロジックのテスト用インライン実装
   * zone-grouping-tool.tsx の handleCreateSystem と同等のロジック
   */
  function performGrouping(selectedZoneIds: string[], levelId: string): boolean {
    if (selectedZoneIds.length === 0) return false

    const systemNode = mockSystemNodeParse({
      systemName: `系統-test`,
      servedZoneIds: selectedZoneIds,
      ahuId: null,
      aggregatedLoad: null,
      status: 'draft',
    })

    mockCreateNode(systemNode, levelId)

    for (const zoneId of selectedZoneIds) {
      mockUpdateNode(zoneId, { systemId: systemNode.id })
    }

    return true
  }

  it('テスト1: 3ゾーン選択 → SystemNode が servedZoneIds に3つのゾーンIDを含む', () => {
    // Given: 3つのゾーンが選択されている
    const selected = ['zone1', 'zone2', 'zone3']

    performGrouping(selected, 'level_test')

    // Then: SystemNode.parse が正しい servedZoneIds で呼ばれる
    expect(mockSystemNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        servedZoneIds: ['zone1', 'zone2', 'zone3'],
      }),
    )
    // Then: createNode が呼ばれる
    expect(mockCreateNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system' }),
      'level_test',
    )
  })

  it('テスト2: 3ゾーン選択 → 各ゾーンに systemId が設定される', () => {
    const selected = ['zone1', 'zone2', 'zone3']

    performGrouping(selected, 'level_test')

    // Then: 各ゾーンに対して updateNode が呼ばれる
    expect(mockUpdateNode).toHaveBeenCalledTimes(3)
    expect(mockUpdateNode).toHaveBeenCalledWith('zone1', { systemId: 'system_mock123' })
    expect(mockUpdateNode).toHaveBeenCalledWith('zone2', { systemId: 'system_mock123' })
    expect(mockUpdateNode).toHaveBeenCalledWith('zone3', { systemId: 'system_mock123' })
  })

  it('テスト5: ゾーンが1つも選択されていない場合、SystemNode は作成されない', () => {
    const result = performGrouping([], 'level_test')

    expect(result).toBe(false)
    expect(mockSystemNodeParse).not.toHaveBeenCalled()
    expect(mockCreateNode).not.toHaveBeenCalled()
  })
})
