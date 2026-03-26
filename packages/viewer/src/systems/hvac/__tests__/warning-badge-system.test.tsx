/**
 * TASK-0039: WarningBadgeSystem — ノード上警告バッジ表示 単体テスト
 *
 * 【テスト対象】: warning-badge-system.tsx のエクスポートされた純粋ヘルパー関数
 *   - getBadgeCountByNode: warnings配列をnodeId別にカウント
 *   - createBadgeTexture: CanvasTextureのバッジ生成（モック環境）
 *
 * 【テストフレームワーク】: Vitest (packages/viewer/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0039 要件定義（REQ-1202）に明示
 */

import { describe, expect, it, vi } from 'vitest'

// Three.js をモック
vi.mock('three', () => ({
  CanvasTexture: class {
    dispose = vi.fn()
  },
  Sprite: class {
    position = { set: vi.fn() }
    scale = { set: vi.fn() }
    layers = { set: vi.fn() }
    userData: Record<string, unknown> = {}
    parent: { remove: ReturnType<typeof vi.fn> } | null = null
    add = vi.fn()
    material = {
      map: { dispose: vi.fn() },
      dispose: vi.fn(),
    }
  },
  SpriteMaterial: class {
    map: { dispose: ReturnType<typeof vi.fn> } | null = null
    dispose = vi.fn()
    constructor(opts: { map: unknown }) {
      this.map = opts?.map as { dispose: ReturnType<typeof vi.fn> } | null
    }
  },
}))

// @react-three/fiber をモック
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}))

// @pascal-app/core をモック（sceneRegistry + useValidation を含む）
vi.mock('@pascal-app/core', () => ({
  sceneRegistry: {
    nodes: new Map(),
    byType: {},
  },
  useValidation: {
    getState: vi.fn(() => ({ warnings: [] })),
  },
}))

import type { Warning } from '@pascal-app/core'
import { getBadgeCountByNode } from '../warning-badge-system'

// ============================================================================
// テストデータヘルパー
// ============================================================================

function makeWarning(
  nodeId: string,
  code = 'unconnected_port',
  severity: 'error' | 'warning' | 'info' = 'error',
): Warning {
  return {
    id: `warning_${code}_${nodeId}_${Math.random()}`,
    nodeId,
    nodeType: 'ahu',
    severity,
    code: code as Warning['code'],
    message: `Test warning for ${nodeId}`,
  }
}

// ============================================================================
// テスト1: getBadgeCountByNode — nodeAに2件の警告 (REQ-1202)
// ============================================================================

describe('getBadgeCountByNode — nodeId別警告件数カウント', () => {
  it('テスト1: nodeAに2件の警告 → Map.get(nodeA)=2', () => {
    // 【テスト目的】: 同一ノードの複数警告が正しくカウントされることを検証
    // 🔵 信頼性レベル: REQ-1202（警告数カウント）に明示

    const warnings: Warning[] = [
      makeWarning('ahu_nodeA'),
      makeWarning('ahu_nodeA', 'airflow_not_set', 'warning'),
    ]

    const result = getBadgeCountByNode(warnings)

    expect(result.get('ahu_nodeA')).toBe(2)
  })

  it('テスト2: 複数ノードへの同時バッジ — nodeA=3件, nodeB=1件', () => {
    // 【テスト目的】: 複数ノードへの警告が個別にカウントされることを検証
    // 🔵 信頼性レベル: REQ-1202（複数ノード同時バッジ）に明示

    const warnings: Warning[] = [
      makeWarning('ahu_nodeA'),
      makeWarning('ahu_nodeA', 'airflow_not_set', 'warning'),
      makeWarning('ahu_nodeA', 'velocity_exceeded', 'warning'),
      makeWarning('diffuser_nodeB', 'zone_no_system', 'warning'),
    ]

    const result = getBadgeCountByNode(warnings)

    expect(result.get('ahu_nodeA')).toBe(3)
    expect(result.get('diffuser_nodeB')).toBe(1)
    expect(result.size).toBe(2)
  })

  it('テスト3: 空配列 → 空のMap', () => {
    // 【テスト目的】: 警告なしの場合に空のMapが返されることを検証
    // 🔵 信頼性レベル: REQ-1202（警告0件バッジ非表示）に明示

    const result = getBadgeCountByNode([])

    expect(result.size).toBe(0)
  })

  it('テスト4: 1件の警告 → Map.size=1, 正しいnodeIdにカウント=1', () => {
    const warnings: Warning[] = [makeWarning('pipe_seg_001', 'pipe_not_connected')]

    const result = getBadgeCountByNode(warnings)

    expect(result.size).toBe(1)
    expect(result.get('pipe_seg_001')).toBe(1)
  })

  it('テスト5: 異なるnodeIdが5件 → Map.size=5, 各nodeIdにカウント=1', () => {
    const warnings: Warning[] = [
      makeWarning('node_a'),
      makeWarning('node_b'),
      makeWarning('node_c'),
      makeWarning('node_d'),
      makeWarning('node_e'),
    ]

    const result = getBadgeCountByNode(warnings)

    expect(result.size).toBe(5)
    for (const nodeId of ['node_a', 'node_b', 'node_c', 'node_d', 'node_e']) {
      expect(result.get(nodeId)).toBe(1)
    }
  })

  it('テスト6: severity混在（error/warning/info）でも全てカウントされる', () => {
    const warnings: Warning[] = [
      makeWarning('ahu_001', 'unconnected_port', 'error'),
      makeWarning('ahu_001', 'velocity_exceeded', 'warning'),
      makeWarning('ahu_001', 'pressure_not_calculated', 'info'),
    ]

    const result = getBadgeCountByNode(warnings)

    expect(result.get('ahu_001')).toBe(3)
  })
})

// ============================================================================
// テスト: スキップ条件の確認 (REQ-1202)
// ============================================================================

describe('getBadgeCountByNode — sceneRegistryに未登録ノードのスキップ確認', () => {
  it('テスト5: getBadgeCountByNodeは全警告をカウント（スキップはWarningBadgeSystem側で行う）', () => {
    // 【テスト目的】: getBadgeCountByNodeはsceneRegistry参照なしに警告件数を返すことを検証
    // スキップロジックはWarningBadgeSystemコンポーネント内（sceneRegistry.nodes.get()）で行われる

    const warnings: Warning[] = [makeWarning('ahu_unregistered_001')]

    const result = getBadgeCountByNode(warnings)

    // getBadgeCountByNode はsceneRegistry参照なしにカウントを返す
    expect(result.get('ahu_unregistered_001')).toBe(1)
  })
})
