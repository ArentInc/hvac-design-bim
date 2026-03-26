/**
 * 【機能概要】: AHU配置ツール
 * 【設計方針】: カタログからAHUを選択し、フロア上にクリックで配置する。
 *              AhuNode.parse()でバリデーション後にcreateNodeで作成し、
 *              SystemNodeのahuIdを更新する。プレビューはローカルステートで管理する。
 * 【参照】: TASK-0023, dataflow.md機能2
 * 🔵 信頼性レベル: TASK-0023 要件定義に明示
 */

import { AhuNode, type AnyNodeId, emitter, type GridEvent, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { EDITOR_LAYER } from '../../../lib/constants'
import { CursorSphere } from '../shared/cursor-sphere'

// --- Catalog types ---

type CatalogPort = {
  label: string
  medium: string
  position: [number, number, number]
}

export type AhuCatalogEntry = {
  modelId: string
  modelName: string
  airflowRate: number
  coolingCapacity: number
  heatingCapacity: number
  staticPressure: number
  dimensions: { width: number; height: number; depth: number }
  ports: CatalogPort[]
}

// --- AHU Catalog data (inlined from packages/core/src/data/catalog-ahu.json) ---

const AHU_CATALOG: AhuCatalogEntry[] = [
  {
    modelId: 'AHU-S-2000',
    modelName: '小型AHU 2000',
    airflowRate: 2000,
    coolingCapacity: 12.0,
    heatingCapacity: 8.0,
    staticPressure: 300,
    dimensions: { width: 1.2, height: 1.0, depth: 0.8 },
    ports: [
      { label: 'SA', medium: 'supply_air', position: [0.0, 0.5, 0.4] },
      { label: 'RA', medium: 'return_air', position: [0.0, 0.5, -0.4] },
      { label: 'CHW_S', medium: 'chilled_water', position: [-0.6, 0.3, 0.2] },
      { label: 'CHW_R', medium: 'chilled_water', position: [-0.6, 0.3, -0.2] },
    ],
  },
  {
    modelId: 'AHU-S-5000',
    modelName: '中小型AHU 5000',
    airflowRate: 5000,
    coolingCapacity: 30.0,
    heatingCapacity: 20.0,
    staticPressure: 350,
    dimensions: { width: 1.8, height: 1.4, depth: 1.2 },
    ports: [
      { label: 'SA', medium: 'supply_air', position: [0.0, 0.7, 0.6] },
      { label: 'RA', medium: 'return_air', position: [0.0, 0.7, -0.6] },
      { label: 'CHW_S', medium: 'chilled_water', position: [-0.9, 0.4, 0.3] },
      { label: 'CHW_R', medium: 'chilled_water', position: [-0.9, 0.4, -0.3] },
    ],
  },
  {
    modelId: 'AHU-M-10000',
    modelName: '中型AHU 10000',
    airflowRate: 10000,
    coolingCapacity: 60.0,
    heatingCapacity: 40.0,
    staticPressure: 400,
    dimensions: { width: 2.4, height: 1.8, depth: 1.6 },
    ports: [
      { label: 'SA', medium: 'supply_air', position: [0.0, 0.9, 0.8] },
      { label: 'RA', medium: 'return_air', position: [0.0, 0.9, -0.8] },
      { label: 'CHW_S', medium: 'chilled_water', position: [-1.2, 0.5, 0.4] },
      { label: 'CHW_R', medium: 'chilled_water', position: [-1.2, 0.5, -0.4] },
      { label: 'HW_S', medium: 'hot_water', position: [-1.2, 0.3, 0.4] },
      { label: 'HW_R', medium: 'hot_water', position: [-1.2, 0.3, -0.4] },
    ],
  },
  {
    modelId: 'AHU-L-20000',
    modelName: '大型AHU 20000',
    airflowRate: 20000,
    coolingCapacity: 120.0,
    heatingCapacity: 80.0,
    staticPressure: 450,
    dimensions: { width: 3.6, height: 2.2, depth: 2.0 },
    ports: [
      { label: 'SA', medium: 'supply_air', position: [0.0, 1.1, 1.0] },
      { label: 'RA', medium: 'return_air', position: [0.0, 1.1, -1.0] },
      { label: 'CHW_S', medium: 'chilled_water', position: [-1.8, 0.6, 0.5] },
      { label: 'CHW_R', medium: 'chilled_water', position: [-1.8, 0.6, -0.5] },
      { label: 'HW_S', medium: 'hot_water', position: [-1.8, 0.4, 0.5] },
      { label: 'HW_R', medium: 'hot_water', position: [-1.8, 0.4, -0.5] },
    ],
  },
  {
    modelId: 'AHU-XL-30000',
    modelName: '特大型AHU 30000',
    airflowRate: 30000,
    coolingCapacity: 180.0,
    heatingCapacity: 120.0,
    staticPressure: 500,
    dimensions: { width: 4.8, height: 2.6, depth: 2.4 },
    ports: [
      { label: 'SA', medium: 'supply_air', position: [0.0, 1.3, 1.2] },
      { label: 'RA', medium: 'return_air', position: [0.0, 1.3, -1.2] },
      { label: 'CHW_S', medium: 'chilled_water', position: [-2.4, 0.8, 0.6] },
      { label: 'CHW_R', medium: 'chilled_water', position: [-2.4, 0.8, -0.6] },
      { label: 'HW_S', medium: 'hot_water', position: [-2.4, 0.5, 0.6] },
      { label: 'HW_R', medium: 'hot_water', position: [-2.4, 0.5, -0.6] },
    ],
  },
]

// --- Helper ---

/**
 * 【ヘルパー関数】: カタログポートを AhuNode の Port 形式に変換する
 * 🔵 信頼性レベル: TASK-0023 実装詳細セクション5に明示
 */
function transformPorts(catalogPorts: CatalogPort[]) {
  return catalogPorts.map((p, i) => ({
    id: `port_${i}`,
    label: p.label,
    medium: p.medium,
    position: p.position as [number, number, number],
    direction: [0, 0, 1] as [number, number, number],
    connectedSegmentId: null,
  }))
}

/**
 * 【ヘルパー関数】: AhuNode を作成してシーンストアに追加し、SystemNode.ahuId を更新する
 * 🔵 信頼性レベル: TASK-0023 実装詳細セクション3、4に明示
 */
export function placeAhu(
  catalogEntry: AhuCatalogEntry,
  position: [number, number, number],
  levelId: string,
  systemId: string | null,
): AhuNode {
  const { createNode, updateNode } = useScene.getState()

  const ports = transformPorts(catalogEntry.ports)

  const ahuNode = AhuNode.parse({
    tag: catalogEntry.modelId,
    equipmentName: catalogEntry.modelName,
    position,
    rotation: [0, 0, 0] as [number, number, number],
    dimensions: catalogEntry.dimensions,
    ports,
    airflowRate: catalogEntry.airflowRate,
    coolingCapacity: catalogEntry.coolingCapacity,
    heatingCapacity: catalogEntry.heatingCapacity,
    staticPressure: catalogEntry.staticPressure,
    systemId: systemId ?? '',
  })

  createNode(ahuNode, levelId as AnyNodeId)

  if (systemId) {
    updateNode(systemId as AnyNodeId, { ahuId: ahuNode.id })
  }

  return ahuNode
}

// --- Component ---

/**
 * 【機能概要】: AHU配置ツール（React コンポーネント）
 * 【設計方針】: ToolManager から phase=equip, mode=build, tool=ahu_place 時にアクティベートされる。
 *              カタログ選択後、グリッドクリックで AHU を配置する。
 *              プレビューはローカルステートで管理し、useScene には保存しない。
 * 【アーキテクチャ制約】: Three.js API を直接呼び出さず、JSX（R3F）で描画する。
 * 🔵 信頼性レベル: TASK-0023 要件定義セクション1に明示
 */
export const AhuPlaceTool: React.FC = () => {
  const cursorRef = useRef<Group>(null)
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState<AhuCatalogEntry | null>(
    AHU_CATALOG[1] ?? null,
  )
  const [previewPosition, setPreviewPosition] = useState<[number, number, number] | null>(null)

  const levelId = useViewer((state) => state.selection.levelId)

  useEffect(() => {
    if (!levelId) return

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
      if (!selectedCatalogEntry || !levelId) return
      const pos: [number, number, number] = [
        event.position[0],
        event.position[1],
        event.position[2],
      ]
      placeAhu(selectedCatalogEntry, pos, levelId, null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCatalogEntry(null)
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
  }, [levelId, selectedCatalogEntry])

  const dims = selectedCatalogEntry?.dimensions

  return (
    <group>
      {/* カーソルマーカー */}
      <CursorSphere ref={cursorRef} />

      {/* 配置プレビュー（半透明直方体） */}
      {dims && previewPosition && (
        <mesh
          layers={EDITOR_LAYER}
          position={[previewPosition[0], previewPosition[1] + dims.height / 2, previewPosition[2]]}
        >
          <boxGeometry args={[dims.width, dims.height, dims.depth]} />
          <meshBasicMaterial color="#f97316" depthTest={false} opacity={0.35} transparent />
        </mesh>
      )}
    </group>
  )
}

export { AHU_CATALOG }
