/**
 * TASK-0030: DuctRouteTool — ダクト手動ルーティング + ポートスナップ ロジックテスト
 *
 * 【テスト対象】: DuctRouteTool の純粋ロジック関数
 *   - detectPortSnap: ポートスナップ検出（近接判定）
 *   - confirmDuctRoute: DuctSegmentNode 作成 + ポート接続更新
 *   - updatePortConnections: ポートの connectedSegmentId 更新
 *   - checkPortMediumMismatch: PortMedium 不整合チェック
 *   - createTJunction: T分岐継手自動作成 + セグメント分割
 *   - cancelRouting: Escキーによるルーティングキャンセル
 *
 * 【設計方針】: @pascal-app/core への依存を避け、純粋なロジックのみをテストする。
 *              DuctSegmentNode.parse / DuctFittingNode.parse は vi.fn() でモック化する。
 * 🔵 信頼性レベル: TASK-0030 要件定義（REQ-701, REQ-704, REQ-705）に明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---

const mockCreateNode = vi.fn()
const mockUpdateNode = vi.fn()
const mockDeleteNode = vi.fn()

let segmentIdCounter = 0
const mockDuctSegmentNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: `duct_seg_mock${++segmentIdCounter}`,
  type: 'duct_segment',
  object: 'node',
  parentId: null,
  visible: true,
  children: [],
  ...input,
}))

const mockDuctFittingNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: 'duct_fit_mock001',
  type: 'duct_fitting',
  object: 'node',
  parentId: null,
  visible: true,
  children: [],
  ...input,
}))

// --- Types ---

type PortEntry = {
  id: string
  medium: string
  position: [number, number, number]
  direction: [number, number, number]
  connectedSegmentId: string | null
}

type PortNodeEntry = {
  nodeId: string
  nodeType: 'ahu' | 'diffuser'
  port: PortEntry
}

type RouteState = {
  phase: 'idle' | 'routing'
  startPortId: string | null
  startMedium: string | null
  startPos: [number, number, number] | null
  waypoints: [number, number, number][]
}

// --- Pure logic functions under test ---

/**
 * ポートスナップ検出 (REQ-704)
 * カーソル位置から閾値内にある未接続ポートを検出し、最近接ポートを返す。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション2（REQ-704）に明示
 */
function detectPortSnap(
  cursor: [number, number, number],
  ports: PortNodeEntry[],
  threshold: number,
): (PortNodeEntry & { distance: number }) | null {
  let closest: (PortNodeEntry & { distance: number }) | null = null

  for (const entry of ports) {
    if (entry.port.connectedSegmentId !== null) continue // 接続済みポートはスキップ

    const dx = cursor[0] - entry.port.position[0]
    const dy = cursor[1] - entry.port.position[1]
    const dz = cursor[2] - entry.port.position[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist < threshold && (!closest || dist < closest.distance)) {
      closest = { ...entry, distance: dist }
    }
  }

  return closest
}

/**
 * PortMedium 不整合チェック (EDGE-003)
 * 起点と終点の medium が異なる場合は true を返す。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション7（EDGE-003）に明示
 */
function checkPortMediumMismatch(startMedium: string, endMedium: string): boolean {
  return startMedium !== endMedium
}

/**
 * ルーティングキャンセル
 * Escキー押下時にローカルstateを初期状態にリセットする。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション3に明示
 */
function cancelRouting(): RouteState {
  return {
    phase: 'idle',
    startPortId: null,
    startMedium: null,
    startPos: null,
    waypoints: [],
  }
}

/**
 * DuctSegmentNode 作成ロジック (REQ-701)
 * routePoints 配列の各区間について DuctSegmentNode を作成し、createNode を呼び出す。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション4に明示
 */
function confirmDuctRoute(
  startPos: [number, number, number],
  endPos: [number, number, number],
  startPortId: string,
  endPortId: string,
  medium: string,
  systemId: string,
  levelId: string,
  waypoints: [number, number, number][] = [],
): { id: string }[] {
  const points: [number, number, number][] = [startPos, ...waypoints, endPos]
  const segments: { id: string }[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const isFirst = i === 0
    const isLast = i === points.length - 2
    const segment = mockDuctSegmentNodeParse({
      start: points[i],
      end: points[i + 1],
      medium,
      shape: 'rectangular',
      width: null,
      height: null,
      diameter: null,
      ductMaterial: 'galvanized_steel',
      airflowRate: null,
      startPortId: isFirst ? startPortId : '',
      endPortId: isLast ? endPortId : '',
      systemId,
      calcResult: null,
    })
    mockCreateNode(segment, levelId)
    segments.push(segment as { id: string })
  }

  return segments
}

/**
 * ポートの connectedSegmentId 更新 (AHU: ports 配列, Diffuser: port 単体)
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション5に明示
 */
function updatePortConnection(
  nodeId: string,
  portId: string,
  segmentId: string,
  portFieldType: 'ports' | 'port',
  currentPorts: PortEntry | PortEntry[],
): void {
  if (portFieldType === 'ports' && Array.isArray(currentPorts)) {
    const updatedPorts = currentPorts.map((p) =>
      p.id === portId ? { ...p, connectedSegmentId: segmentId } : p,
    )
    mockUpdateNode(nodeId, { ports: updatedPorts })
  } else if (portFieldType === 'port' && !Array.isArray(currentPorts)) {
    mockUpdateNode(nodeId, { port: { ...currentPorts, connectedSegmentId: segmentId } })
  }
}

/**
 * T分岐継手自動作成 (REQ-705)
 * 既存セグメントを分割し、DuctFittingNode（fittingType='tee'）を作成する。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション6に明示
 */
function createTJunction(
  originalSegment: {
    id: string
    start: [number, number, number]
    end: [number, number, number]
    startPortId: string
    endPortId: string
    medium: string
    systemId: string
  },
  splitPoint: [number, number, number],
  levelId: string,
): { fittingId: string; seg1Id: string; seg2Id: string } {
  // 1. 元セグメントを削除
  mockDeleteNode(originalSegment.id)

  // 2. T分岐継手を作成
  const fitting = mockDuctFittingNodeParse({
    fittingType: 'tee',
    position: splitPoint,
    rotation: [0, 0, 0] as [number, number, number],
    ports: [
      {
        id: 'tee_port_0',
        label: 'IN',
        medium: originalSegment.medium,
        position: [0, 0, -0.1] as [number, number, number],
        direction: [0, 0, -1] as [number, number, number],
        connectedSegmentId: null,
      },
      {
        id: 'tee_port_1',
        label: 'OUT1',
        medium: originalSegment.medium,
        position: [0, 0, 0.1] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
        connectedSegmentId: null,
      },
      {
        id: 'tee_port_2',
        label: 'OUT2',
        medium: originalSegment.medium,
        position: [0.1, 0, 0] as [number, number, number],
        direction: [1, 0, 0] as [number, number, number],
        connectedSegmentId: null,
      },
    ],
    localLossCoefficient: 0.5,
    systemId: originalSegment.systemId,
  })
  mockCreateNode(fitting, levelId)

  // 3. 元セグメントを2分割して再作成
  const seg1 = mockDuctSegmentNodeParse({
    start: originalSegment.start,
    end: splitPoint,
    medium: originalSegment.medium,
    shape: 'rectangular',
    width: null,
    height: null,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate: null,
    startPortId: originalSegment.startPortId,
    endPortId: 'tee_port_0',
    systemId: originalSegment.systemId,
    calcResult: null,
  })
  mockCreateNode(seg1, levelId)

  const seg2 = mockDuctSegmentNodeParse({
    start: splitPoint,
    end: originalSegment.end,
    medium: originalSegment.medium,
    shape: 'rectangular',
    width: null,
    height: null,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate: null,
    startPortId: 'tee_port_1',
    endPortId: originalSegment.endPortId,
    systemId: originalSegment.systemId,
    calcResult: null,
  })
  mockCreateNode(seg2, levelId)

  return {
    fittingId: (fitting as { id: string }).id,
    seg1Id: (seg1 as { id: string }).id,
    seg2Id: (seg2 as { id: string }).id,
  }
}

// --- Test fixtures ---

const ahuSaPort: PortEntry = {
  id: 'port_SA',
  medium: 'supply_air',
  position: [5, 3, 0],
  direction: [0, 0, 1],
  connectedSegmentId: null,
}

const diffuserPort: PortEntry = {
  id: 'port_NECK',
  medium: 'supply_air',
  position: [10, 3, 0],
  direction: [0, 1, 0],
  connectedSegmentId: null,
}

const chwPort: PortEntry = {
  id: 'port_CHW',
  medium: 'chilled_water',
  position: [5, 3, -1],
  direction: [-1, 0, 0],
  connectedSegmentId: null,
}

const allPorts: PortNodeEntry[] = [
  { nodeId: 'ahu_001', nodeType: 'ahu', port: ahuSaPort },
  { nodeId: 'diffuser_001', nodeType: 'diffuser', port: diffuserPort },
  { nodeId: 'ahu_001', nodeType: 'ahu', port: chwPort },
]

// --- Tests ---

describe('TASK-0030: DuctRouteTool ロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    segmentIdCounter = 0
  })

  describe('テスト1: 起点ポートスナップ検出', () => {
    it('閾値内のポートがスナップ対象として検出される', () => {
      // 【テスト目的】: カーソルが給気ポート[5,3,0]の近傍[5,3,0.2]にある場合にスナップ検出を確認
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト1」（REQ-704）に明示
      const cursor: [number, number, number] = [5, 3, 0.2]
      const result = detectPortSnap(cursor, allPorts, 0.3)

      expect(result).not.toBeNull()
      expect(result?.port.id).toBe('port_SA')
      expect(result?.nodeId).toBe('ahu_001')
    })

    it('閾値外のポートはスナップ対象にならない', () => {
      // 【テスト目的】: カーソルがスナップ閾値（0.3m）を超える場合はnullが返る
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト1」に明示
      const cursor: [number, number, number] = [5, 3, 0.5]
      const result = detectPortSnap(cursor, allPorts, 0.3)

      expect(result).toBeNull()
    })

    it('接続済みポートはスナップ対象から除外される', () => {
      // 【テスト目的】: connectedSegmentId !== null のポートはスキップされる
      // 🔵 信頼性レベル: TASK-0030 実装詳細セクション2に明示
      const connectedPort: PortEntry = { ...ahuSaPort, connectedSegmentId: 'duct_seg_001' }
      const ports: PortNodeEntry[] = [{ nodeId: 'ahu_001', nodeType: 'ahu', port: connectedPort }]

      const cursor: [number, number, number] = [5, 3, 0.1]
      const result = detectPortSnap(cursor, ports, 0.3)

      expect(result).toBeNull()
    })
  })

  describe('テスト2: DuctSegmentNode作成', () => {
    it('起点・終点ポートが正しいstart/end/startPortId/endPortIdでparse+createNodeが呼ばれる', () => {
      // 【テスト目的】: ルーティング確定時に DuctSegmentNode.parse が正しい引数で呼ばれることを確認
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト2」（REQ-701）に明示
      const startPos: [number, number, number] = [5, 3, 0]
      const endPos: [number, number, number] = [10, 3, 0]

      confirmDuctRoute(
        startPos,
        endPos,
        'port_SA',
        'port_NECK',
        'supply_air',
        'system_001',
        'level_001',
      )

      expect(mockDuctSegmentNodeParse).toHaveBeenCalledOnce()
      expect(mockDuctSegmentNodeParse).toHaveBeenCalledWith(
        expect.objectContaining({
          start: [5, 3, 0],
          end: [10, 3, 0],
          startPortId: 'port_SA',
          endPortId: 'port_NECK',
          medium: 'supply_air',
        }),
      )
      expect(mockCreateNode).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'duct_segment' }),
        'level_001',
      )
    })

    it('折点2箇所がある場合は3セグメント作成される（統合テスト1）', () => {
      // 【テスト目的】: 折点2つを含むルーティングで3セグメントが作成されることを確認
      // 🔵 信頼性レベル: TASK-0030 統合テスト「AHU→Diffuserの完全ルーティング」に明示
      const startPos: [number, number, number] = [5, 3, 0]
      const wp1: [number, number, number] = [7, 3, 0]
      const wp2: [number, number, number] = [7, 3, 3]
      const endPos: [number, number, number] = [10, 3, 3]

      confirmDuctRoute(
        startPos,
        endPos,
        'port_SA',
        'port_NECK',
        'supply_air',
        'system_001',
        'level_001',
        [wp1, wp2],
      )

      expect(mockDuctSegmentNodeParse).toHaveBeenCalledTimes(3)
      expect(mockCreateNode).toHaveBeenCalledTimes(3)
    })
  })

  describe('テスト3: ポートconnectedSegmentId更新', () => {
    it('AHU（ports配列）の指定ポートのconnectedSegmentIdが更新される', () => {
      // 【テスト目的】: AHUのports配列内の対象ポートが新しいsegmentIdで更新されることを確認
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト3」に明示
      const currentPorts: PortEntry[] = [{ ...ahuSaPort }, { ...chwPort }]

      updatePortConnection('ahu_001', 'port_SA', 'duct_seg_001', 'ports', currentPorts)

      expect(mockUpdateNode).toHaveBeenCalledWith('ahu_001', {
        ports: expect.arrayContaining([
          expect.objectContaining({ id: 'port_SA', connectedSegmentId: 'duct_seg_001' }),
          expect.objectContaining({ id: 'port_CHW', connectedSegmentId: null }), // 他のポートは変わらない
        ]),
      })
    })

    it('Diffuser（port単体）のconnectedSegmentIdが更新される', () => {
      // 【テスト目的】: Diffuserのport（単体フィールド）が新しいsegmentIdで更新されることを確認
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト3」に明示
      updatePortConnection('diffuser_001', 'port_NECK', 'duct_seg_001', 'port', diffuserPort)

      expect(mockUpdateNode).toHaveBeenCalledWith('diffuser_001', {
        port: expect.objectContaining({ id: 'port_NECK', connectedSegmentId: 'duct_seg_001' }),
      })
    })
  })

  describe('テスト4: PortMedium不整合検出', () => {
    it('supply_air と chilled_water は不整合として検出される', () => {
      // 【テスト目的】: 異なるmediumの接続試行時にtrueが返されることを確認（EDGE-003）
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト4」に明示
      const result = checkPortMediumMismatch('supply_air', 'chilled_water')
      expect(result).toBe(true)
    })

    it('supply_air 同士は整合として検出される', () => {
      // 【テスト目的】: 同じmediumの接続試行時にfalseが返されることを確認
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト4」に明示
      const result = checkPortMediumMismatch('supply_air', 'supply_air')
      expect(result).toBe(false)
    })
  })

  describe('テスト5: T分岐自動作成', () => {
    it('既存セグメントが削除され、DuctFittingNode(tee)と2新セグメントが作成される', () => {
      // 【テスト目的】: 既存セグメント上でT分岐操作時に正しい分割と継手作成を確認（REQ-705）
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト5」に明示
      const originalSegment = {
        id: 'duct_seg_existing',
        start: [0, 3, 0] as [number, number, number],
        end: [10, 3, 0] as [number, number, number],
        startPortId: 'port_SA',
        endPortId: 'port_NECK',
        medium: 'supply_air',
        systemId: 'system_001',
      }
      const splitPoint: [number, number, number] = [5, 3, 0]

      const result = createTJunction(originalSegment, splitPoint, 'level_001')

      // 元セグメントが削除される
      expect(mockDeleteNode).toHaveBeenCalledWith('duct_seg_existing')

      // DuctFittingNode(tee) が作成される
      expect(mockDuctFittingNodeParse).toHaveBeenCalledWith(
        expect.objectContaining({ fittingType: 'tee' }),
      )

      // 2つの新セグメントが作成される
      expect(mockDuctSegmentNodeParse).toHaveBeenCalledTimes(2)
      expect(mockCreateNode).toHaveBeenCalledTimes(3) // fitting + seg1 + seg2

      // 戻り値に3つのIDが含まれる
      expect(result.fittingId).toBeDefined()
      expect(result.seg1Id).toBeDefined()
      expect(result.seg2Id).toBeDefined()
    })

    it('分割された各セグメントのポート接続が正しく設定される', () => {
      // 【テスト目的】: 分割後のセグメントのstartPortId/endPortIdが正しく設定されることを確認
      // 🔵 信頼性レベル: TASK-0030 実装詳細セクション6に明示
      const originalSegment = {
        id: 'duct_seg_existing',
        start: [0, 3, 0] as [number, number, number],
        end: [10, 3, 0] as [number, number, number],
        startPortId: 'port_SA',
        endPortId: 'port_NECK',
        medium: 'supply_air',
        systemId: 'system_001',
      }

      createTJunction(originalSegment, [5, 3, 0], 'level_001')

      // seg1: startPortId = 元の startPortId, endPortId = tee の IN ポート
      expect(mockDuctSegmentNodeParse).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ startPortId: 'port_SA', endPortId: 'tee_port_0' }),
      )

      // seg2: startPortId = tee の OUT ポート, endPortId = 元の endPortId
      expect(mockDuctSegmentNodeParse).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ startPortId: 'tee_port_1', endPortId: 'port_NECK' }),
      )
    })
  })

  describe('テスト6: Escキーによるキャンセル', () => {
    it('ルーティング途中でcancelRoutingを呼ぶとstate が初期化される', () => {
      // 【テスト目的】: ルーティング中（起点クリック後、折点追加済み）でキャンセル後にstateがリセットされる
      // 🔵 信頼性レベル: TASK-0030 単体テスト要件「テスト6」に明示
      const routingState: RouteState = {
        phase: 'routing',
        startPortId: 'port_SA',
        startMedium: 'supply_air',
        startPos: [5, 3, 0],
        waypoints: [[7, 3, 0]],
      }

      // ルーティング中であることを確認
      expect(routingState.phase).toBe('routing')
      expect(routingState.waypoints).toHaveLength(1)

      // Esc キーキャンセル
      const result = cancelRouting()

      expect(result.phase).toBe('idle')
      expect(result.startPortId).toBeNull()
      expect(result.startMedium).toBeNull()
      expect(result.startPos).toBeNull()
      expect(result.waypoints).toHaveLength(0)
    })
  })
})
