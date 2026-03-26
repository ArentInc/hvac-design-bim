'use client'

import { parseArchitecture, type Architecture } from '@pascal-app/core'
import { useState } from 'react'

interface ArchitectureFallbackPanelProps {
  onArchitectureLoaded: (architecture: Architecture) => void
}

interface SimpleRect {
  width: number
  depth: number
  ceilingHeight: number
}

function rectToArchitecture(rect: SimpleRect): Architecture {
  const { width, depth, ceilingHeight } = rect
  return {
    buildingName: '手動入力',
    levels: [
      {
        levelId: 'level_01',
        floorHeight: 0,
        ceilingHeight,
        floorOutline: [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: depth },
          { x: 0, y: depth },
        ],
        externalWalls: [
          {
            id: 'wall_south',
            orientation: 'S',
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: width, y: 0, z: 0 },
              { x: width, y: 0, z: ceilingHeight },
              { x: 0, y: 0, z: ceilingHeight },
            ],
            wallArea: width * ceilingHeight,
            glazingRatio: 0.3,
          },
          {
            id: 'wall_east',
            orientation: 'E',
            vertices: [
              { x: width, y: 0, z: 0 },
              { x: width, y: depth, z: 0 },
              { x: width, y: depth, z: ceilingHeight },
              { x: width, y: 0, z: ceilingHeight },
            ],
            wallArea: depth * ceilingHeight,
            glazingRatio: 0.2,
          },
          {
            id: 'wall_north',
            orientation: 'N',
            vertices: [
              { x: width, y: depth, z: 0 },
              { x: 0, y: depth, z: 0 },
              { x: 0, y: depth, z: ceilingHeight },
              { x: width, y: depth, z: ceilingHeight },
            ],
            wallArea: width * ceilingHeight,
            glazingRatio: 0.1,
          },
          {
            id: 'wall_west',
            orientation: 'W',
            vertices: [
              { x: 0, y: depth, z: 0 },
              { x: 0, y: 0, z: 0 },
              { x: 0, y: 0, z: ceilingHeight },
              { x: 0, y: depth, z: ceilingHeight },
            ],
            wallArea: depth * ceilingHeight,
            glazingRatio: 0.2,
          },
        ],
      },
    ],
  }
}

export function ArchitectureFallbackPanel({ onArchitectureLoaded }: ArchitectureFallbackPanelProps) {
  const [width, setWidth] = useState(10)
  const [depth, setDepth] = useState(8)
  const [ceilingHeight, setCeilingHeight] = useState(2.7)
  const [error, setError] = useState<string | null>(null)

  const handleApply = () => {
    try {
      const architecture = rectToArchitecture({ width, depth, ceilingHeight })
      const validated = parseArchitecture(architecture)
      setError(null)
      onArchitectureLoaded(validated)
    } catch (err) {
      setError('入力値が不正です。正の数値を入力してください。')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm">建築参照: 矩形入力</h3>
      <p className="text-muted-foreground text-xs">
        建築参照JSONが未設定の場合、フロアの幅・奥行きを入力してください。
      </p>
      <div className="space-y-2">
        <label className="block text-xs" htmlFor="floor-width">
          幅 (m)
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
            id="floor-width"
            min={1}
            onChange={(e) => setWidth(Number(e.target.value))}
            step={0.5}
            type="number"
            value={width}
          />
        </label>
        <label className="block text-xs" htmlFor="floor-depth">
          奥行き (m)
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
            id="floor-depth"
            min={1}
            onChange={(e) => setDepth(Number(e.target.value))}
            step={0.5}
            type="number"
            value={depth}
          />
        </label>
        <label className="block text-xs" htmlFor="ceiling-height">
          天井高 (m)
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
            id="ceiling-height"
            min={2}
            onChange={(e) => setCeilingHeight(Number(e.target.value))}
            step={0.1}
            type="number"
            value={ceilingHeight}
          />
        </label>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <button
        className="w-full rounded bg-primary px-3 py-1.5 text-primary-foreground text-sm hover:bg-primary/90"
        onClick={handleApply}
        type="button"
      >
        適用
      </button>
    </div>
  )
}
