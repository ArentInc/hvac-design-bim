/**
 * TASK-0036: PipeRouteTool — 配管ルーティングツール ロジックテスト
 *
 * 【テスト対象】: PipeRouteTool の純粋ロジック関数
 *   - detectPipePortSnap: 冷水ポートスナップ検出（近接判定）
 *   - startPipeRouting: ルーティング開始（medium設定）
 *   - confirmPipeRoute: PipeSegmentNode 作成 + ポート接続更新
 *   - updatePipePortConnection: AHU ポートの connectedSegmentId 更新
 *   - checkPortAlreadyConnected: 既接続ポートへの二重接続チェック
 *   - cancelPipeRouting: Escキーによるルーティングキャンセル
 *
 * 【設計方針】:
 *   - DuctRouteToolのパターンに倣い、純粋なロジックのみをテスト
 *   - PipeSegmentNode.parse / useScene は vi.fn() でモック化
 *   - @pascal-app/viewer からはインポートしない（Viewer隔離ルール）
 *
 * 【テストフレームワーク】: Vitest (packages/editor/vitest.config.ts)
 * 🔵 信頼性レベル: TASK-0036 要件定義（REQ-1101, REQ-1102, REQ-1105）に明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---

const mockCreateNode = vi.fn()
const mockUpdateNode = vi.fn()

let pipeSegIdCounter = 0
const mockPipeSegmentNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: `pipe_seg_mock${++pipeSegIdCounter}`,
  type: 'pipe_segment',
  object: 'node',
  parentId: null,
  visible: true,
  children: [],
  ...input,
}))

// --- Types ---

type PipePortEntry = {
  id: string
  label: string
  medium: string
  position: [number, number, number]
  direction: [number, number, number]
  connectedSegmentId: string | null
}

type PipePortNodeEntry = {
  nodeId: string
  nodeType: 'ahu'
  port: PipePortEntry
}

type PipeRouteState = {
  phase: 'idle' | 'routing'
  startPortId: string | null
  startMedium: string | null
  startPos: [number, number, number] | null
  waypoints: [number, number, number][]
}

// --- Pure logic functions under test ---
// （これらはGreenフェーズで実装される関数のインターフェース定義として機能する）

/**
 * 配管ポートスナップ検出 (REQ-1101)
 * カーソル位置から閾値内にある未接続の冷水ポートを検出し、最近接ポートを返す。
 * 🔵 信頼性レベル: REQ-1101「AHU冷温水入出口から配管ルーティング」に明示
 */
function detectPipePortSnap(
  cursor: [number, number, number],
  ports: PipePortNodeEntry[],
  threshold: number,
): (PipePortNodeEntry & { distance: number }) | null {
  let closest: (PipePortNodeEntry & { distance: number }) | null = null

  for (const entry of ports) {
    // 接続済みポートはスキップ
    if (entry.port.connectedSegmentId !== null) continue
    // 冷水ポート以外はスキップ（配管ツールは冷水のみ対象）
    if (!entry.port.medium.includes('chilled_water')) continue

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
 * 配管ルーティング開始 (REQ-1101, REQ-1105)
 * CHW_S / CHW_R ポートをクリックしてルーティングを開始する。
 * medium を対応するポートの medium で設定する。
 * 🔵 信頼性レベル: TASK-0036 テスト8（CHW_Sポートクリック → medium='chilled_water'でルーティング開始）に明示
 */
function startPipeRouting(port: PipePortEntry, pos: [number, number, number]): PipeRouteState {
  return {
    phase: 'routing',
    startPortId: port.id,
    startMedium: port.medium,
    startPos: pos,
    waypoints: [],
  }
}

/**
 * PipeSegmentNode 作成ロジック (REQ-1102)
 * ルーティング完了時に PipeSegmentNode を作成し、createNode を呼び出す。
 * nominalSize=null, calcResult=null の初期値で作成する（PipeSizingSystemが後で設定）。
 * 🔵 信頼性レベル: TASK-0036 テスト9（PipeSegmentNodeがmedium='chilled_water'で作成される）に明示
 */
function confirmPipeRoute(
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
    const segment = mockPipeSegmentNodeParse({
      start: points[i],
      end: points[i + 1],
      medium,
      nominalSize: null, // PipeSizingSystem が後で設定
      outerDiameter: null,
      startPortId: isFirst ? startPortId : '',
      endPortId: isLast ? endPortId : '',
      systemId,
      calcResult: null, // PipeSizingSystem が後で設定
    })
    mockCreateNode(segment, levelId)
    segments.push(segment as { id: string })
  }

  return segments
}

/**
 * AHU ポートの connectedSegmentId 更新 (REQ-1101)
 * 配管作成後に AHU の ports 配列内の対象ポートを更新する。
 * 🔵 信頼性レベル: REQ-1101, Port.connectedSegmentId定義に明示
 */
function updatePipePortConnection(
  nodeId: string,
  portId: string,
  segmentId: string,
  currentPorts: PipePortEntry[],
): void {
  const updatedPorts = currentPorts.map((p) =>
    p.id === portId ? { ...p, connectedSegmentId: segmentId } : p,
  )
  mockUpdateNode(nodeId, { ports: updatedPorts })
}

/**
 * 既接続ポートへの二重接続チェック (REQ-1101)
 * ポートの connectedSegmentId が既に設定済みの場合は true を返す。
 * 🔵 信頼性レベル: 要件定義4.6「ポート未接続: 既に接続済みポートへの二重接続は不可」に明示
 */
function checkPortAlreadyConnected(port: PipePortEntry): boolean {
  return port.connectedSegmentId !== null
}

/**
 * 配管ルーティングキャンセル
 * Escキー押下時にローカルstateを初期状態にリセットする。
 * 🔵 信頼性レベル: DuctRouteToolのパターンに倣った設計
 */
function cancelPipeRouting(): PipeRouteState {
  return {
    phase: 'idle',
    startPortId: null,
    startMedium: null,
    startPos: null,
    waypoints: [],
  }
}

// --- Test fixtures ---

const chwSPort: PipePortEntry = {
  id: 'port_CHW_S',
  label: 'CHW_S',
  medium: 'chilled_water',
  position: [5, 1, 0],
  direction: [-1, 0, 0],
  connectedSegmentId: null,
}

const chwRPort: PipePortEntry = {
  id: 'port_CHW_R',
  label: 'CHW_R',
  medium: 'chilled_water',
  position: [5, 1, 2.0], // CHW_Sと十分な距離を確保（2m離れた位置）
  direction: [-1, 0, 0],
  connectedSegmentId: null,
}

const saPort: PipePortEntry = {
  id: 'port_SA',
  label: 'SA',
  medium: 'supply_air',
  position: [5, 3, 0],
  direction: [0, 0, 1],
  connectedSegmentId: null,
}

const allPipePortEntries: PipePortNodeEntry[] = [
  { nodeId: 'ahu_001', nodeType: 'ahu', port: chwSPort },
  { nodeId: 'ahu_001', nodeType: 'ahu', port: chwRPort },
  { nodeId: 'ahu_001', nodeType: 'ahu', port: saPort },
]

// --- Tests ---

describe('TASK-0036: PipeRouteTool ロジック', () => {
  beforeEach(() => {
    // 【テスト前準備】: モックを初期化し、前テストの呼び出し履歴をクリア
    // 【環境初期化】: 各テストが独立して実行されるよう状態をリセット
    vi.clearAllMocks()
    pipeSegIdCounter = 0
  })

  describe('TC-007: 冷水ポートスナップ検出', () => {
    it('閾値内の冷水ポート（CHW_S）がスナップ対象として検出される', () => {
      // 【テスト目的】: AHUのCHW_Sポート近傍のカーソル位置でスナップが正しく検出されること
      // 【テスト内容】: カーソル位置[5,1,0.2]がCHW_Sポート[5,1,0]の閾値内にある場合にスナップ検出
      // 【期待される動作】: CHW_Sポートがスナップ対象として返される
      // 🔵 信頼性レベル: TASK-0036 テスト8（CHW_Sポートクリック → ルーティング開始）に明記

      // 【テストデータ準備】: CHW_Sポート[5,1,0]から0.2m離れたカーソル位置
      const cursor: [number, number, number] = [5, 1, 0.2]

      // 【実際の処理実行】: detectPipePortSnap 関数を呼び出し
      const result = detectPipePortSnap(cursor, allPipePortEntries, 0.3)

      // 【結果検証】: CHW_Sポートがスナップ対象として検出されること
      expect(result).not.toBeNull() // 【確認内容】: スナップ対象が存在すること 🔵
      expect(result?.port.id).toBe('port_CHW_S') // 【確認内容】: CHW_Sポートが選択されること 🔵
      expect(result?.nodeId).toBe('ahu_001') // 【確認内容】: AHUノードIDが正しいこと 🔵
    })

    it('給気ポート（supply_air）は配管ツールのスナップ対象にならない', () => {
      // 【テスト目的】: 冷水以外のポートは配管ルーティングに使用できないことを確認
      // 【テスト内容】: 給気ポート（supply_air）の近傍でもスナップが発生しないこと
      // 【期待される動作】: null が返される（冷水ポート以外は除外）
      // 🔵 信頼性レベル: REQ-1101「AHU冷温水入出口から配管ルーティング」に明記

      // 【テストデータ準備】: 給気ポートのみがあるリスト、その近傍カーソル
      const saOnlyPorts: PipePortNodeEntry[] = [
        { nodeId: 'ahu_001', nodeType: 'ahu', port: saPort },
      ]
      const cursor: [number, number, number] = [5, 3, 0.1]

      // 【実際の処理実行】: detectPipePortSnap 関数を呼び出し
      const result = detectPipePortSnap(cursor, saOnlyPorts, 0.5)

      // 【結果検証】: スナップが発生しないこと
      expect(result).toBeNull() // 【確認内容】: 給気ポートはスナップ対象外であること 🔵
    })

    it('接続済み冷水ポートはスナップ対象から除外される', () => {
      // 【テスト目的】: 既に配管が接続されたポートは再接続対象にならないことを確認
      // 【テスト内容】: connectedSegmentId が設定済みのCHW_Sポートはスナップ対象外
      // 【期待される動作】: null が返される
      // 🔵 信頼性レベル: 要件定義4.6「既に接続済みポートへの二重接続は不可」に明記

      // 【テストデータ準備】: 接続済みのCHW_Sポート
      const connectedCHWPort: PipePortEntry = {
        ...chwSPort,
        connectedSegmentId: 'pipe_seg_existing_001',
      }
      const connectedPorts: PipePortNodeEntry[] = [
        { nodeId: 'ahu_001', nodeType: 'ahu', port: connectedCHWPort },
      ]
      const cursor: [number, number, number] = [5, 1, 0.1]

      // 【実際の処理実行】: detectPipePortSnap 関数を呼び出し
      const result = detectPipePortSnap(cursor, connectedPorts, 0.3)

      // 【結果検証】: 接続済みポートはスナップ対象外であること
      expect(result).toBeNull() // 【確認内容】: 接続済みポートが除外されること 🔵
    })
  })

  describe('TC-007拡張: ルーティング開始状態の設定', () => {
    it('CHW_Sポートクリックでルーティングが開始され、mediumが正しく設定される', () => {
      // 【テスト目的】: AHUのCHW_Sポートクリック時にルーティング状態が正しく初期化されること
      // 【テスト内容】: startPipeRoutingにCHW_Sポートと始点座標を渡し、状態遷移を確認
      // 【期待される動作】: phase='routing', medium='chilled_water' でルーティング開始
      // 🔵 信頼性レベル: TASK-0036 テスト8（CHW_SポートクリックでルーティングがmediumでURLセットされる）に明記

      // 【テストデータ準備】: CHW_Sポートの始点座標
      const startPos: [number, number, number] = [5, 1, 0]

      // 【実際の処理実行】: startPipeRouting 関数を呼び出し
      const state = startPipeRouting(chwSPort, startPos)

      // 【結果検証】: ルーティング状態が正しく設定されること
      expect(state.phase).toBe('routing') // 【確認内容】: ルーティングフェーズに遷移 🔵
      expect(state.startPortId).toBe('port_CHW_S') // 【確認内容】: 始点ポートIDが設定されること 🔵
      expect(state.startMedium).toBe('chilled_water') // 【確認内容】: mediumがchilled_waterに設定されること 🔵
      expect(state.startPos).toEqual([5, 1, 0]) // 【確認内容】: 始点座標が設定されること 🔵
      expect(state.waypoints).toHaveLength(0) // 【確認内容】: 折点リストが空であること 🔵
    })
  })

  describe('TC-008, TC-009: PipeSegmentNode作成', () => {
    it('TC-008: ルーティング完了時にPipeSegmentNodeが正しいフィールドで作成される', () => {
      // 【テスト目的】: ルーティング完了時のPipeSegmentNode作成の正確性確認
      // 【テスト内容】: confirmPipeRouteがPipeSegmentNode.parseを正しい引数で呼び出すこと
      // 【期待される動作】: medium='chilled_water', nominalSize=null, calcResult=null で初期化
      // 🔵 信頼性レベル: TASK-0036 テスト9、要件定義2.1（PipeSegmentNodeフィールド仕様）に明記

      // 【テストデータ準備】: 直角ルートの座標（始点→折点→終点）
      const startPos: [number, number, number] = [5, 1, 0]
      const endPos: [number, number, number] = [5, 1, 10]

      // 【実際の処理実行】: confirmPipeRoute 関数を呼び出し
      confirmPipeRoute(
        startPos,
        endPos,
        'port_CHW_S',
        'port_CHW_END',
        'chilled_water',
        'sys_001',
        'level_001',
      )

      // 【結果検証】: PipeSegmentNode.parseが正しい引数で呼ばれること
      expect(mockPipeSegmentNodeParse).toHaveBeenCalledOnce() // 【確認内容】: 1回だけ呼ばれること 🔵
      expect(mockPipeSegmentNodeParse).toHaveBeenCalledWith(
        expect.objectContaining({
          start: [5, 1, 0],
          end: [5, 1, 10],
          medium: 'chilled_water', // 【確認内容】: mediumがchilled_waterであること 🔵
          nominalSize: null, // 【確認内容】: 初期値null（PipeSizingSystemが後で設定）🔵
          calcResult: null, // 【確認内容】: 初期値null（PipeSizingSystemが後で設定）🔵
          startPortId: 'port_CHW_S',
          endPortId: 'port_CHW_END',
          systemId: 'sys_001',
        }),
      )
      expect(mockCreateNode).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pipe_segment' }),
        'level_001',
      ) // 【確認内容】: createNodeがpipe_segmentタイプで呼ばれること 🔵
    })

    it('TC-009: 折点ありのルーティングで複数PipeSegmentNodeが作成される', () => {
      // 【テスト目的】: 折点を含むルーティングで区間数分のノードが作成されることを確認
      // 【テスト内容】: 折点2箇所で3セグメントが作成されること
      // 【期待される動作】: 点列[start, wp1, wp2, end]の各区間でPipeSegmentNodeが作成される
      // 🔵 信頼性レベル: TASK-0036 テスト9「PipeSegmentNodeがmedium='chilled_water'で作成される」に明記

      // 【テストデータ準備】: 折点2箇所のルート
      const startPos: [number, number, number] = [5, 1, 0]
      const wp1: [number, number, number] = [5, 1, 5]
      const wp2: [number, number, number] = [10, 1, 5]
      const endPos: [number, number, number] = [10, 1, 10]

      // 【実際の処理実行】: confirmPipeRoute 関数を折点付きで呼び出し
      const segments = confirmPipeRoute(
        startPos,
        endPos,
        'port_CHW_S',
        'port_CHW_END',
        'chilled_water',
        'sys_001',
        'level_001',
        [wp1, wp2],
      )

      // 【結果検証】: 3セグメントが作成されること
      expect(mockPipeSegmentNodeParse).toHaveBeenCalledTimes(3) // 【確認内容】: 3区間分のparse呼び出し 🔵
      expect(mockCreateNode).toHaveBeenCalledTimes(3) // 【確認内容】: 3回のcreateNode呼び出し 🔵
      expect(segments).toHaveLength(3) // 【確認内容】: 戻り値に3セグメントが含まれること 🔵
    })
  })

  describe('TC-014: ポートconnectedSegmentId更新と二重接続防止', () => {
    it('ルーティング完了後にAHUポートのconnectedSegmentIdが更新される', () => {
      // 【テスト目的】: 配管作成後にAHUポートの接続状態が正しく更新されること
      // 【テスト内容】: updatePipePortConnectionがcreateNode後に呼ばれ、対象ポートが更新される
      // 【期待される動作】: CHW_Sポートのconnectedが新しいセグメントIDで設定される
      // 🔵 信頼性レベル: 要件定義4.6、Port.connectedSegmentId定義に明記

      // 【テストデータ準備】: AHUの2つのポート（CHW_S, CHW_R）
      const currentPorts: PipePortEntry[] = [{ ...chwSPort }, { ...chwRPort }]

      // 【実際の処理実行】: updatePipePortConnection 関数を呼び出し
      updatePipePortConnection('ahu_001', 'port_CHW_S', 'pipe_seg_new_001', currentPorts)

      // 【結果検証】: CHW_Sポートのconnectedが更新され、CHW_Rは変わらないこと
      expect(mockUpdateNode).toHaveBeenCalledWith('ahu_001', {
        ports: expect.arrayContaining([
          expect.objectContaining({ id: 'port_CHW_S', connectedSegmentId: 'pipe_seg_new_001' }),
          expect.objectContaining({ id: 'port_CHW_R', connectedSegmentId: null }), // 他のポートは変わらない
        ]),
      }) // 【確認内容】: CHW_Sのみが更新され、CHW_Rは変わらないこと 🔵
    })

    it('TC-014: 接続済みポートへのルーティングがcheckPortAlreadyConnectedで検出される', () => {
      // 【テスト目的】: 既に配管が接続されたポートへの二重接続チェックの確認
      // 【テスト内容】: connectedSegmentIdが設定済みのポートをチェックするとtrueが返ること
      // 【期待される動作】: 接続済みポートはtrueが返される（ルーティング不可）
      // 🔵 信頼性レベル: 要件定義4.6「既に接続済みポートへの二重接続は不可」に明記

      // 【テストデータ準備】: 接続済みのCHW_Sポート
      const connectedPort: PipePortEntry = {
        ...chwSPort,
        connectedSegmentId: 'pipe_seg_existing_001',
      }

      // 【実際の処理実行】: checkPortAlreadyConnected 関数を呼び出し
      const result = checkPortAlreadyConnected(connectedPort)

      // 【結果検証】: 接続済みであることが検出されること
      expect(result).toBe(true) // 【確認内容】: 接続済みポートがtrueを返すこと 🔵

      // 未接続ポートはfalseが返ること
      const unconnectedResult = checkPortAlreadyConnected(chwSPort)
      expect(unconnectedResult).toBe(false) // 【確認内容】: 未接続ポートがfalseを返すこと 🔵
    })
  })

  describe('キャンセル動作', () => {
    it('ルーティング途中でcancelPipeRoutingを呼ぶとstateが初期化される', () => {
      // 【テスト目的】: Escキーによるルーティングキャンセル後の状態リセット確認
      // 【テスト内容】: ルーティング中（折点追加済み）でキャンセルするとstateがidle状態に戻ること
      // 【期待される動作】: phase='idle', 全フィールドnull/空リストにリセット
      // 🔵 信頼性レベル: DuctRouteToolのパターンに倣った設計

      // 【テストデータ準備】: ルーティング中の状態
      const routingState: PipeRouteState = {
        phase: 'routing',
        startPortId: 'port_CHW_S',
        startMedium: 'chilled_water',
        startPos: [5, 1, 0],
        waypoints: [[5, 1, 5]],
      }

      // ルーティング中であることを確認
      expect(routingState.phase).toBe('routing')
      expect(routingState.waypoints).toHaveLength(1)

      // 【実際の処理実行】: cancelPipeRouting 関数を呼び出し
      const result = cancelPipeRouting()

      // 【結果検証】: 全フィールドが初期化されること
      expect(result.phase).toBe('idle') // 【確認内容】: idleフェーズに戻ること 🔵
      expect(result.startPortId).toBeNull() // 【確認内容】: 始点ポートIDがクリアされること 🔵
      expect(result.startMedium).toBeNull() // 【確認内容】: mediumがクリアされること 🔵
      expect(result.startPos).toBeNull() // 【確認内容】: 始点座標がクリアされること 🔵
      expect(result.waypoints).toHaveLength(0) // 【確認内容】: 折点リストが空になること 🔵
    })
  })
})
