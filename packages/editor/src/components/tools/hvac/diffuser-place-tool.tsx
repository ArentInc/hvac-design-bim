/**
 * 【機能概要】: 制気口（ディフューザー）配置ツール
 * 【設計方針】: カタログからネック径とサブタイプを選択し、ゾーン天井面にクリックで配置する。
 *              配置後に ゾーンの必要風量を制気口数で均等配分する（REQ-604）。
 *              プレビューはローカルステートで管理する。
 * 【参照】: TASK-0025, REQ-601, REQ-604
 * 🔵 信頼性レベル: TASK-0025 要件定義に明示
 */

import { type AnyNodeId, DiffuserNode, emitter, type GridEvent, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { EDITOR_LAYER } from '../../../lib/constants'
import { CursorSphere } from '../shared/cursor-sphere'

// --- Types ---

type DiffuserSubType = 'anemostat' | 'line' | 'universal' | 'nozzle' | 'return_grille'

export type DiffuserCatalogEntry = {
  modelId: string
  neckDiameter: number
  ratedAirflow: number
  maxAirflow: number
  subTypes: DiffuserSubType[]
}

// --- Catalog data (inlined from packages/core/src/data/catalog-diffuser.json) ---

const DIFFUSER_CATALOG: DiffuserCatalogEntry[] = [
  {
    modelId: 'DIFF-250',
    neckDiameter: 250,
    ratedAirflow: 300,
    maxAirflow: 450,
    subTypes: ['anemostat', 'universal'],
  },
  {
    modelId: 'DIFF-300',
    neckDiameter: 300,
    ratedAirflow: 450,
    maxAirflow: 650,
    subTypes: ['anemostat', 'universal', 'nozzle'],
  },
  {
    modelId: 'DIFF-350',
    neckDiameter: 350,
    ratedAirflow: 600,
    maxAirflow: 900,
    subTypes: ['anemostat', 'universal', 'nozzle'],
  },
  {
    modelId: 'DIFF-400',
    neckDiameter: 400,
    ratedAirflow: 800,
    maxAirflow: 1200,
    subTypes: ['anemostat', 'universal', 'nozzle', 'line'],
  },
  {
    modelId: 'DIFF-500',
    neckDiameter: 500,
    ratedAirflow: 1200,
    maxAirflow: 1800,
    subTypes: ['anemostat', 'universal', 'nozzle', 'line'],
  },
  {
    modelId: 'DIFF-600',
    neckDiameter: 600,
    ratedAirflow: 1800,
    maxAirflow: 2500,
    subTypes: ['anemostat', 'universal', 'nozzle', 'line', 'return_grille'],
  },
]

// --- Helper functions ---

/**
 * 【ヘルパー関数】: ゾーン内の給気制気口に風量を均等配分する
 * 【REQ-604】: zone.calcResult.requiredAirflow / supply拡散器数 で均等配分
 * 【設計方針】: return_grille（還気口）は配分対象外
 * 🔵 信頼性レベル: TASK-0025 実装詳細セクション4（REQ-604）に明示
 */
export function redistributeAirflow(zoneId: string): void {
  const { nodes, updateNode } = useScene.getState()
  const zone = nodes[zoneId as AnyNodeId]
  if (!zone || zone.type !== 'hvac_zone') return

  const requiredAirflow = zone.calcResult?.requiredAirflow ?? 0

  // ゾーン内の supply 系制気口（return_grille 除外）を取得
  const supplyDiffuserIds = (Object.keys(nodes) as AnyNodeId[]).filter((id) => {
    const node = nodes[id]
    return node?.type === 'diffuser' && node.parentId === zoneId && node.subType !== 'return_grille'
  })

  if (supplyDiffuserIds.length === 0) return

  const airflowPerDiffuser = requiredAirflow / supplyDiffuserIds.length

  for (const diffuserId of supplyDiffuserIds) {
    updateNode(diffuserId, { airflowRate: airflowPerDiffuser })
  }
}

/**
 * 【ヘルパー関数】: DiffuserNode を作成してシーンストアに追加し、風量を再配分する
 * 🔵 信頼性レベル: TASK-0025 実装詳細セクション2、4に明示
 */
export function placeDiffuser(
  subType: DiffuserSubType,
  neckDiameter: number,
  position: [number, number, number],
  zoneId: string,
  systemId: string,
): DiffuserNode {
  const { createNode } = useScene.getState()

  const diffuserNode = DiffuserNode.parse({
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

  createNode(diffuserNode, zoneId as AnyNodeId)
  redistributeAirflow(zoneId)

  return diffuserNode
}

// --- Component ---

/**
 * 【機能概要】: 制気口配置ツール（React コンポーネント）
 * 【設計方針】: ToolManager から phase=equip, mode=build, tool=diffuser_place 時にアクティベートされる。
 *              ネック径・サブタイプを選択後、グリッドクリックで制気口を配置する。
 *              配置後に風量を自動均等配分する。プレビューはローカルステートで管理する。
 * 【アーキテクチャ制約】: Three.js API を直接呼び出さず、JSX（R3F）で描画する。
 * 🔵 信頼性レベル: TASK-0025 要件定義セクション1に明示
 */
export const DiffuserPlaceTool: React.FC = () => {
  const cursorRef = useRef<Group>(null)
  const [selectedNeckDiameter, setSelectedNeckDiameter] = useState<number>(300)
  const [selectedSubType, setSelectedSubType] = useState<DiffuserSubType>('anemostat')
  const [previewPosition, setPreviewPosition] = useState<[number, number, number] | null>(null)

  const zoneId = useViewer((state) => state.selection.zoneId)

  const availableSubTypes = DIFFUSER_CATALOG.find((e) => e.neckDiameter === selectedNeckDiameter)
    ?.subTypes ?? ['anemostat']

  // subType が選択可能でない場合はリセット
  useEffect(() => {
    if (!availableSubTypes.includes(selectedSubType)) {
      setSelectedSubType(availableSubTypes[0] ?? 'anemostat')
    }
  }, [availableSubTypes, selectedSubType])

  useEffect(() => {
    if (!zoneId) return

    const onGridMove = (event: GridEvent) => {
      if (!cursorRef.current) return
      const pos: [number, number, number] = [
        event.position[0],
        event.position[1],
        event.position[2],
      ]
      cursorRef.current.position.set(pos[0], pos[1], pos[2])
      setPreviewPosition(pos)
    }

    const onGridClick = (event: GridEvent) => {
      if (!zoneId) return
      const pos: [number, number, number] = [
        event.position[0],
        event.position[1],
        event.position[2],
      ]
      placeDiffuser(selectedSubType, selectedNeckDiameter, pos, zoneId, '')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewPosition(null)
      }
    }

    emitter.on('grid:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      emitter.off('grid:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [zoneId, selectedSubType, selectedNeckDiameter])

  // ネック径をメートル換算（mm → m）
  const radiusM = selectedNeckDiameter / 2000

  return (
    <group>
      {/* カーソルマーカー */}
      <CursorSphere ref={cursorRef} />

      {/* 配置プレビュー（半透明円柱） */}
      {previewPosition && (
        <mesh
          layers={EDITOR_LAYER}
          position={[previewPosition[0], previewPosition[1] + 0.05, previewPosition[2]]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[radiusM, radiusM, 0.05, 16]} />
          <meshBasicMaterial color="#22c55e" depthTest={false} opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  )
}

export { DIFFUSER_CATALOG }
