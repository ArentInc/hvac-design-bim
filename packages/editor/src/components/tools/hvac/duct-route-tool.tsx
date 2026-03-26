/**
 * 【機能概要】: DuctRouteTool — ダクト手動ルーティング + ポートスナップ
 * 【設計方針】:
 *   - AHUの給気ポートから制気口までダクトを手動でルーティングする
 *   - ポートへの近接スナップ、折点クリックによる経路指定
 *   - T分岐操作時の自動 DuctFittingNode 作成
 *   - PortMedium 不整合チェック
 *   - プレビューはローカルステートで管理
 * 【参照】: TASK-0030, REQ-701, REQ-704, REQ-705, EDGE-003, dataflow.md 機能3
 * 🔵 信頼性レベル: TASK-0030 要件定義に明示
 */

import {
  type AnyNodeId,
  DuctFittingNode,
  DuctSegmentNode,
  emitter,
  type GridEvent,
  useScene,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useState } from 'react'
import { EDITOR_LAYER } from '../../../lib/constants'

// --- Constants ---

export const SNAP_THRESHOLD = 0.3 // meters

// --- Types ---

export type PortEntry = {
  id: string
  medium: string
  position: [number, number, number]
  direction: [number, number, number]
  connectedSegmentId: string | null
}

export type PortNodeEntry = {
  nodeId: string
  nodeType: 'ahu' | 'diffuser'
  portFieldType: 'ports' | 'port'
  port: PortEntry
}

type RouteState =
  | { phase: 'idle' }
  | {
      phase: 'routing'
      startPortId: string
      startMedium: string
      startPos: [number, number, number]
      waypoints: [number, number, number][]
      snapTarget: PortNodeEntry | null
    }

// --- Pure Logic Functions ---

/**
 * ポートスナップ検出 (REQ-704)
 * カーソル位置から閾値内にある未接続ポートを検出し、最近接ポートを返す。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション2に明示
 */
export function detectPortSnap(
  cursor: [number, number, number],
  ports: PortNodeEntry[],
  threshold: number,
): (PortNodeEntry & { distance: number }) | null {
  let closest: (PortNodeEntry & { distance: number }) | null = null

  for (const entry of ports) {
    if (entry.port.connectedSegmentId !== null) continue

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
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション7に明示
 */
export function checkPortMediumMismatch(startMedium: string, endMedium: string): boolean {
  return startMedium !== endMedium
}

/**
 * DuctSegmentNode 作成 + createNode 呼び出し (REQ-701)
 * routePoints 配列の各区間について DuctSegmentNode を作成する。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション4に明示
 */
export function confirmDuctRoute(
  startPos: [number, number, number],
  endPos: [number, number, number],
  startPortId: string,
  endPortId: string,
  medium: string,
  systemId: string,
  levelId: string,
  waypoints: [number, number, number][] = [],
): { id: string }[] {
  const { createNode } = useScene.getState()
  const points: [number, number, number][] = [startPos, ...waypoints, endPos]
  const segments: { id: string }[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const isFirst = i === 0
    const isLast = i === points.length - 2

    const segment = DuctSegmentNode.parse({
      start: points[i],
      end: points[i + 1],
      medium: medium as 'supply_air' | 'return_air' | 'exhaust_air',
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

    createNode(segment, levelId as AnyNodeId)
    segments.push(segment)
  }

  return segments
}

/**
 * ポートの connectedSegmentId を更新する
 * AHU: ports 配列の対象ポートを更新
 * Diffuser: port 単体フィールドを更新
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション5に明示
 */
export function updatePortConnection(
  nodeId: string,
  portId: string,
  segmentId: string,
  portFieldType: 'ports' | 'port',
  currentPorts: PortEntry | PortEntry[],
): void {
  const { updateNode } = useScene.getState()

  if (portFieldType === 'ports' && Array.isArray(currentPorts)) {
    const updatedPorts = currentPorts.map((p) =>
      p.id === portId ? { ...p, connectedSegmentId: segmentId } : p,
    )
    updateNode(nodeId as AnyNodeId, { ports: updatedPorts } as never)
  } else if (portFieldType === 'port' && !Array.isArray(currentPorts)) {
    updateNode(
      nodeId as AnyNodeId,
      {
        port: { ...currentPorts, connectedSegmentId: segmentId },
      } as never,
    )
  }
}

/**
 * T分岐継手自動作成 (REQ-705)
 * 既存セグメントを削除し、DuctFittingNode（tee）+ 2分割セグメントを作成する。
 * 🔵 信頼性レベル: TASK-0030 実装詳細セクション6に明示
 */
export function createTJunction(
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
  const { createNode, deleteNode } = useScene.getState()
  const ductMedium = originalSegment.medium as 'supply_air' | 'return_air' | 'exhaust_air'

  // 1. 元セグメントを削除
  deleteNode(originalSegment.id as AnyNodeId)

  // 2. T分岐継手を作成
  const fitting = DuctFittingNode.parse({
    fittingType: 'tee',
    position: splitPoint,
    rotation: [0, 0, 0] as [number, number, number],
    ports: [
      {
        id: 'tee_port_0',
        label: 'IN',
        medium: 'supply_air',
        position: [0, 0, -0.1] as [number, number, number],
        direction: [0, 0, -1] as [number, number, number],
        connectedSegmentId: null,
      },
      {
        id: 'tee_port_1',
        label: 'OUT1',
        medium: 'supply_air',
        position: [0, 0, 0.1] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
        connectedSegmentId: null,
      },
      {
        id: 'tee_port_2',
        label: 'OUT2',
        medium: 'supply_air',
        position: [0.1, 0, 0] as [number, number, number],
        direction: [1, 0, 0] as [number, number, number],
        connectedSegmentId: null,
      },
    ],
    localLossCoefficient: 0.5,
    systemId: originalSegment.systemId,
  })
  createNode(fitting, levelId as AnyNodeId)

  // 3. セグメント1: 元の start → 分岐点
  const seg1 = DuctSegmentNode.parse({
    start: originalSegment.start,
    end: splitPoint,
    medium: ductMedium,
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
  createNode(seg1, levelId as AnyNodeId)

  // 4. セグメント2: 分岐点 → 元の end
  const seg2 = DuctSegmentNode.parse({
    start: splitPoint,
    end: originalSegment.end,
    medium: ductMedium,
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
  createNode(seg2, levelId as AnyNodeId)

  return { fittingId: fitting.id, seg1Id: seg1.id, seg2Id: seg2.id }
}

// --- Component ---

/**
 * 【機能概要】: DuctRouteTool（React コンポーネント）
 * 【設計方針】:
 *   - ToolManager から phase=route, mode=build, tool=duct_route 時にアクティベートされる
 *   - 起点ポートクリック → 折点クリック(0回以上) → 終点ポートスナップ確定のフロー
 *   - プレビューはローカルステートで管理し、useScene には保存しない
 *   - Escキーでいつでもキャンセル可能
 * 【アーキテクチャ制約】: Three.js API を直接呼び出さず、JSX（R3F）で描画する。
 *                         @pascal-app/viewer からインポートしない（除: useViewer）
 * 🔵 信頼性レベル: TASK-0030 要件定義セクション1に明示
 */
export const DuctRouteTool: React.FC = () => {
  const [routeState, setRouteState] = useState<RouteState>({ phase: 'idle' })
  const [mediumError, setMediumError] = useState<string | null>(null)

  const levelId = useViewer((state) => state.selection.levelId)

  // Escキーでキャンセル
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRouteState({ phase: 'idle' })
        setMediumError(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // グリッドクリックで折点追加
  useEffect(() => {
    const onGridClick = (event: GridEvent) => {
      if (routeState.phase !== 'routing') return
      const pos: [number, number, number] = [
        event.position[0],
        event.position[1],
        event.position[2],
      ]
      setRouteState((prev) => {
        if (prev.phase !== 'routing') return prev
        return { ...prev, waypoints: [...prev.waypoints, pos] }
      })
    }

    emitter.on('grid:click', onGridClick)
    return () => emitter.off('grid:click', onGridClick)
  }, [routeState.phase])

  // コンポーネントはプレビュー線以外は null を返す（UI はパネルで別途実装）
  // プレビュー線: routeState.phase === 'routing' のとき描画
  if (routeState.phase === 'routing') {
    const { startPos, waypoints } = routeState
    const points = [startPos, ...waypoints]

    return (
      <>
        {/* ルーティングプレビュー（破線）: EDITOR_LAYER で描画 */}
        {points.length >= 2 && (
          <group layers={EDITOR_LAYER}>
            {points.slice(0, -1).map((p, i) => {
              const next = points[i + 1]!
              const midX = (p[0] + next[0]) / 2
              const midY = (p[1] + next[1]) / 2
              const midZ = (p[2] + next[2]) / 2
              const dx = next[0] - p[0]
              const dy = next[1] - p[1]
              const dz = next[2] - p[2]
              const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
              return (
                <mesh key={i} position={[midX, midY, midZ]}>
                  <cylinderGeometry args={[0.02, 0.02, length, 4]} />
                  <meshBasicMaterial color="#f97316" depthTest={false} opacity={0.6} transparent />
                </mesh>
              )
            })}
          </group>
        )}
        {/* Medium不整合エラー表示はUIレイヤー（HTMLオーバーレイ）で対応 */}
      </>
    )
  }

  return null
}
