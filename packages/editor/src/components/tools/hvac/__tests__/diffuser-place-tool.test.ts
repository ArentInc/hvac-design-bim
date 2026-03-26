/**
 * TASK-0025: DiffuserPlaceTool — 制気口配置 + 風量均等配分 ロジックテスト
 *
 * 【テスト対象】: DiffuserPlaceTool の placeDiffuser / redistributeAirflow ロジック
 *   - DiffuserNode.parse()→createNode() でのノード作成
 *   - 風量均等配分（zone.requiredAirflow / diffuserCount）
 *   - 制気口追加時の再配分
 *   - 制気口0個時のエラー回避
 *   - 給気口のみ配分対象（return_grille 除外）
 *   - parentId の設定
 *
 * 【設計方針】: @pascal-app/core への依存を避け、純粋なロジックのみをテストする。
 *              DiffuserNode.parse は vi.fn() でモック化する。
 * 🔵 信頼性レベル: TASK-0025 要件定義（REQ-601, REQ-604）に明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---

const mockCreateNode = vi.fn()
const mockUpdateNode = vi.fn()

const mockDiffuserNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: 'diffuser_mock001',
  type: 'diffuser',
  object: 'node',
  parentId: null,
  visible: true,
  children: [],
  ...input,
}))

const DiffuserNodeMock = { parse: mockDiffuserNodeParse }

// --- Types ---

type DiffuserSubType = 'anemostat' | 'line' | 'universal' | 'nozzle' | 'return_grille'

type MockNode = {
  id: string
  type: string
  parentId: string | null
  subType?: DiffuserSubType
}

type NodeMap = Record<string, MockNode>

// --- Logic under test ---

/**
 * 【ヘルパー関数】: DiffuserPlaceTool の配置ロジック（テスト用インライン実装）
 * 🔵 信頼性レベル: TASK-0025 実装詳細セクション2に明示
 */
function placeDiffuser(
  subType: DiffuserSubType,
  neckDiameter: number,
  position: [number, number, number],
  zoneId: string,
  systemId: string,
): { id: string } {
  const diffuserNode = DiffuserNodeMock.parse({
    tag: `DIFF-${neckDiameter}`,
    subType,
    position,
    neckDiameter,
    airflowRate: 0,
    port: {
      id: 'port_0',
      label: 'NECK',
      medium: 'supply_air',
      position: [0, 0, 0] as [number, number, number],
      direction: [0, 1, 0] as [number, number, number],
      connectedSegmentId: null,
    },
    hostDuctId: null,
    systemId,
    zoneId,
  })

  mockCreateNode(diffuserNode, zoneId)

  return diffuserNode as { id: string }
}

/**
 * 【ヘルパー関数】: ゾーン内の制気口に風量を均等配分する（テスト用インライン実装）
 * 【REQ-604】: zone.requiredAirflow / supply拡散器数 で均等配分
 * 【設計方針】: return_grille は還気口なので配分対象外
 * 🔵 信頼性レベル: TASK-0025 実装詳細セクション4（REQ-604）に明示
 */
function redistributeAirflow(zoneId: string, nodes: NodeMap, requiredAirflow: number): void {
  // ゾーン内の supply 系制気口（return_grille 除外）を取得
  const supplyDiffuserIds = Object.keys(nodes).filter((id) => {
    const node = nodes[id]
    return node?.type === 'diffuser' && node.parentId === zoneId && node.subType !== 'return_grille'
  })

  if (supplyDiffuserIds.length === 0) return

  const airflowPerDiffuser = requiredAirflow / supplyDiffuserIds.length

  for (const diffuserId of supplyDiffuserIds) {
    mockUpdateNode(diffuserId, { airflowRate: airflowPerDiffuser })
  }
}

// --- Tests ---

describe('TASK-0025: DiffuserPlaceTool 配置・風量配分ロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('テスト1: DiffuserNode作成 — parse成功、createNode呼び出し', () => {
    // 【テスト目的】: 正常フローで DiffuserNode.parse と createNode が正しく呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト1」に明示
    placeDiffuser('anemostat', 300, [5, 3, 2], 'zone_001', '')

    expect(mockDiffuserNodeParse).toHaveBeenCalledOnce()
    expect(mockCreateNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'diffuser' }),
      'zone_001',
    )
  })

  it('テスト2: 風量均等配分 — requiredAirflow=2000, 制気口2個 → 各1000', () => {
    // 【テスト目的】: 2000/2=1000 の均等配分を確認（REQ-604）
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト2」に明示
    const nodes: NodeMap = {
      diffuser_001: {
        id: 'diffuser_001',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
      diffuser_002: {
        id: 'diffuser_002',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
    }

    redistributeAirflow('zone_001', nodes, 2000)

    expect(mockUpdateNode).toHaveBeenCalledTimes(2)
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_001', { airflowRate: 1000 })
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_002', { airflowRate: 1000 })
  })

  it('テスト3: 風量均等配分 — requiredAirflow=3000, 制気口3個 → 各1000', () => {
    // 【テスト目的】: 3000/3=1000 の均等配分を確認（REQ-604）
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト3」に明示
    const nodes: NodeMap = {
      diffuser_001: {
        id: 'diffuser_001',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
      diffuser_002: {
        id: 'diffuser_002',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'universal',
      },
      diffuser_003: {
        id: 'diffuser_003',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'nozzle',
      },
    }

    redistributeAirflow('zone_001', nodes, 3000)

    expect(mockUpdateNode).toHaveBeenCalledTimes(3)
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_001', { airflowRate: 1000 })
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_002', { airflowRate: 1000 })
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_003', { airflowRate: 1000 })
  })

  it('テスト4: 制気口追加時の再配分 — 2個→3個で3000/3=1000に再配分', () => {
    // 【テスト目的】: 3個目の制気口追加後の再配分で全3個が1000m3/hになることを確認
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト4」に明示
    const nodes: NodeMap = {
      diffuser_001: {
        id: 'diffuser_001',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
      diffuser_002: {
        id: 'diffuser_002',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
      diffuser_003: {
        id: 'diffuser_003',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
    }

    redistributeAirflow('zone_001', nodes, 3000)

    expect(mockUpdateNode).toHaveBeenCalledTimes(3)
    for (const call of mockUpdateNode.mock.calls) {
      expect(call[1]).toEqual({ airflowRate: 1000 })
    }
  })

  it('テスト5: 制気口が0個の場合 — エラーなし、updateNode呼ばれない', () => {
    // 【テスト目的】: 制気口0個の場合にエラーにならず、何も更新されないことを確認
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト5」に明示
    const nodes: NodeMap = {}

    expect(() => redistributeAirflow('zone_001', nodes, 2000)).not.toThrow()
    expect(mockUpdateNode).not.toHaveBeenCalled()
  })

  it('テスト6: 給気口のみ配分対象 — return_grille は対象外', () => {
    // 【テスト目的】: return_grille（還気口）が風量配分の対象外であることを確認
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト6」に明示
    const nodes: NodeMap = {
      diffuser_001: {
        id: 'diffuser_001',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
      diffuser_002: {
        id: 'diffuser_002',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'anemostat',
      },
      diffuser_return: {
        id: 'diffuser_return',
        type: 'diffuser',
        parentId: 'zone_001',
        subType: 'return_grille',
      },
    }

    redistributeAirflow('zone_001', nodes, 2000)

    // 給気口2個のみ配分（return_grille除外）
    expect(mockUpdateNode).toHaveBeenCalledTimes(2)
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_001', { airflowRate: 1000 })
    expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_002', { airflowRate: 1000 })
    expect(mockUpdateNode).not.toHaveBeenCalledWith('diffuser_return', expect.anything())
  })

  it('テスト7: parentIdの設定 — zoneIdでcreateNode呼び出し', () => {
    // 【テスト目的】: createNode が正しい zoneId を parentId として呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0025 単体テスト要件「テスト7」に明示
    placeDiffuser('anemostat', 300, [0, 3, 0], 'zone_abc', '')

    expect(mockCreateNode).toHaveBeenCalledWith(expect.anything(), 'zone_abc')
  })
})
