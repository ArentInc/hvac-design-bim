import { type PipeSegmentNode, useRegistry, useScene } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import * as THREE from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { getSegmentLength, getSegmentMidpoint } from './duct-segment-renderer'

export const PIPE_COLORS: Record<string, string> = {
  chilled_water: '#0288D1',
  hot_water: '#E53935',
  condensate: '#78909C',
}

export const PIPE_DEFAULT_COLOR = '#78909C'
const MIN_PIPE_RADIUS = 0.02
const PIPE_SEGMENTS = 8

/** Returns the display color for a pipe based on its medium type. */
export function getPipeColor(medium: string): string {
  return PIPE_COLORS[medium] ?? PIPE_DEFAULT_COLOR
}

/** Returns the display radius for a pipe based on outer diameter with a minimum threshold. */
export function getPipeRadius(outerDiameter: number | null): number {
  if (outerDiameter === null || outerDiameter <= 0) return MIN_PIPE_RADIUS
  return Math.max(outerDiameter / 2, MIN_PIPE_RADIUS)
}

export function PipeSegmentRenderer({ nodeId }: { nodeId: string }) {
  const ref = useRef<Group>(null!)
  const node = useScene((s) => s.nodes[nodeId as PipeSegmentNode['id']]) as
    | PipeSegmentNode
    | undefined

  useRegistry(nodeId, 'pipe_segment', ref)
  const handlers = useNodeEvents(node!, 'pipe_segment')

  const transform = useMemo(() => {
    if (!node) return null
    const position = getSegmentMidpoint(node.start, node.end)
    const length = getSegmentLength(node.start, node.end)
    const dir = new THREE.Vector3(
      node.end[0] - node.start[0],
      node.end[1] - node.start[1],
      node.end[2] - node.start[2],
    ).normalize()
    // CylinderGeometry is Y-axis aligned; rotate Y → direction
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    return { position, rotation: [euler.x, euler.y, euler.z] as [number, number, number], length }
  }, [node?.start, node?.end, node])

  if (!node || !transform) return null

  const { position, rotation, length } = transform
  const radius = getPipeRadius(node.outerDiameter)
  const color = getPipeColor(node.medium)

  return (
    <group ref={ref} position={position} rotation={rotation} {...handlers}>
      <mesh>
        <cylinderGeometry args={[radius, radius, length, PIPE_SEGMENTS]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}
