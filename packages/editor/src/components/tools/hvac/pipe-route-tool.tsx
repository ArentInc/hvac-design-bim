/**
 * 【機能概要】: PipeRouteTool — 配管手動ルーティング + ポートスナップ
 * 【設計方針】:
 *   - AHUの冷水ポート(CHW_S/CHW_R)から配管を手動でルーティングする
 *   - DuctRouteToolと同じ操作パターン（起点クリック→折点→終点スナップ）
 *   - medium=chilled_water のポートのみスナップ対象
 *   - PipeSegmentNode を作成
 * 【参照】: TASK-0036, REQ-1101, REQ-1102, REQ-1105
 * 🔵 信頼性レベル: TASK-0036 要件定義に明示
 */

import {
  type AnyNodeId,
  emitter,
  type GridEvent,
  PipeSegmentNode,
  useScene,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useState } from 'react'
import { EDITOR_LAYER } from '../../../lib/constants'

// --- Constants ---

export const PIPE_SNAP_THRESHOLD = 0.3

// --- Types ---

type PipePortEntry = {
  id: string
  medium: string
  position: [number, number, number]
  direction: [number, number, number]
  connectedSegmentId: string | null
}

type PipePortNodeEntry = {
  nodeId: string
  nodeType: 'ahu'
  portFieldType: 'ports'
  port: PipePortEntry
}

type PipeRouteState =
  | { phase: 'idle' }
  | {
      phase: 'routing'
      startPortId: string
      startMedium: string
      startPos: [number, number, number]
      waypoints: [number, number, number][]
      snapTarget: PipePortNodeEntry | null
    }

// --- Pure Logic Functions ---

/**
 * 配管ポートスナップ検出 (REQ-1101)
 * 冷水ポートのみスナップ対象。接続済みポートは除外。
 */
export function detectPipePortSnap(
  cursor: [number, number, number],
  ports: PipePortNodeEntry[],
  threshold: number,
): (PipePortNodeEntry & { distance: number }) | null {
  let closest: (PipePortNodeEntry & { distance: number }) | null = null

  for (const entry of ports) {
    if (entry.port.connectedSegmentId !== null) continue
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
 * PipeSegmentNode 作成 (REQ-1102)
 */
export function confirmPipeRoute(
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

    const segment = PipeSegmentNode.parse({
      start: points[i],
      end: points[i + 1],
      medium: medium as 'chilled_water' | 'hot_water' | 'condensate',
      nominalSize: null,
      outerDiameter: null,
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
 * ポートの connectedSegmentId を更新
 */
export function updatePipePortConnection(
  nodeId: string,
  portId: string,
  segmentId: string,
  currentPorts: PipePortEntry[],
): void {
  const { updateNode } = useScene.getState()
  const updatedPorts = currentPorts.map((p) =>
    p.id === portId ? { ...p, connectedSegmentId: segmentId } : p,
  )
  updateNode(nodeId as AnyNodeId, { ports: updatedPorts } as never)
}

// --- Component ---

export const PipeRouteTool: React.FC = () => {
  const [routeState, setRouteState] = useState<PipeRouteState>({ phase: 'idle' })

  const levelId = useViewer((state) => state.selection.levelId)

  // Escキーでキャンセル
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRouteState({ phase: 'idle' })
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

  // プレビュー描画
  if (routeState.phase === 'routing') {
    const { startPos, waypoints } = routeState
    const points = [startPos, ...waypoints]

    return (
      <>
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
                  <cylinderGeometry args={[0.015, 0.015, length, 8]} />
                  <meshBasicMaterial color="#3b82f6" depthTest={false} opacity={0.6} transparent />
                </mesh>
              )
            })}
          </group>
        )}
      </>
    )
  }

  return null
}
