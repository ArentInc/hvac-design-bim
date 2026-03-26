import type { Architecture } from '@pascal-app/core'
import { useMemo } from 'react'
import { Shape } from 'three'
import { SCENE_LAYER } from '../../../lib/layers'

interface ArchitectureReferenceRendererProps {
  architecture: Architecture
  levelIndex?: number
}

const ORIENTATION_COLORS: Record<string, string> = {
  N: '#2196F3',
  NE: '#9C27B0',
  E: '#4CAF50',
  SE: '#FF9800',
  S: '#F44336',
  SW: '#FF5722',
  W: '#FFEB3B',
  NW: '#00BCD4',
}

function FloorOutline({ outline }: { outline: { x: number; y: number }[] }) {
  const shape = useMemo(() => {
    if (outline.length < 3) return null
    const s = new Shape()
    s.moveTo(outline[0]!.x, -outline[0]!.y)
    for (let i = 1; i < outline.length; i++) {
      s.lineTo(outline[i]!.x, -outline[i]!.y)
    }
    s.closePath()
    return s
  }, [outline])

  if (!shape) return null

  return (
    <mesh layers={SCENE_LAYER} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color="#9E9E9E" opacity={0.15} transparent />
    </mesh>
  )
}

export function ArchitectureReferenceRenderer({
  architecture,
  levelIndex = 0,
}: ArchitectureReferenceRendererProps) {
  const level = architecture.levels[levelIndex]
  if (!level) return null

  return (
    <group name="architecture-reference" userData={{ nonInteractive: true }}>
      <FloorOutline outline={level.floorOutline} />
      {level.externalWalls.map((wall) => (
        <line key={wall.id}>
          <bufferGeometry
            setFromPoints={wall.vertices.map((v) => ({
              x: v.x,
              y: v.z + level.floorHeight,
              z: -v.y,
            }))}
          />
          <lineBasicMaterial color={ORIENTATION_COLORS[wall.orientation] ?? '#FFFFFF'} />
        </line>
      ))}
    </group>
  )
}
