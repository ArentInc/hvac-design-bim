import { type DuctSegmentNode, useRegistry, useScene } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import * as THREE from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'

const DUCT_COLOR = '#90A4AE'
const DASHED_COLOR = '#B0BEC5'

/** Returns whether duct dimensions are fully determined (non-null, non-zero). */
export function isDuctSizeDetermined(width: number | null, height: number | null): boolean {
  return width !== null && width > 0 && height !== null && height > 0
}

/** Returns the midpoint between start and end. */
export function getSegmentMidpoint(
  start: [number, number, number],
  end: [number, number, number],
): [number, number, number] {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]
}

/** Returns the Euclidean distance between start and end. */
export function getSegmentLength(
  start: [number, number, number],
  end: [number, number, number],
): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function DuctSegmentRenderer({ nodeId }: { nodeId: string }) {
  const ref = useRef<Group>(null!)
  const node = useScene((s) => s.nodes[nodeId as DuctSegmentNode['id']]) as
    | DuctSegmentNode
    | undefined

  useRegistry(nodeId, 'duct_segment', ref)
  const handlers = useNodeEvents(node!, 'duct_segment')

  const transform = useMemo(() => {
    if (!node) return null
    const position = getSegmentMidpoint(node.start, node.end)
    const length = getSegmentLength(node.start, node.end)
    const dir = new THREE.Vector3(
      node.end[0] - node.start[0],
      node.end[1] - node.start[1],
      node.end[2] - node.start[2],
    ).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    return { position, rotation: [euler.x, euler.y, euler.z] as [number, number, number], length }
  }, [node?.start, node?.end, node])

  // Dashed line in LOCAL space (Z-axis aligned).
  // Group is placed at midpoint with rotation, so DuctVisualSystem scale does not distort positions.
  const dashedLine = useMemo(() => {
    if (!transform) return null
    const { length } = transform
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -length / 2),
      new THREE.Vector3(0, 0, length / 2),
    ])
    const mat = new THREE.LineDashedMaterial({ color: DASHED_COLOR, dashSize: 0.1, gapSize: 0.05 })
    const line = new THREE.Line(geom, mat)
    line.computeLineDistances()
    return line
  }, [transform])

  if (!node || !transform) return null

  const determined = isDuctSizeDetermined(node.width, node.height)

  if (!determined) {
    return (
      <group ref={ref} position={transform.position} rotation={transform.rotation}>
        {dashedLine && <primitive object={dashedLine} />}
      </group>
    )
  }

  const { position, rotation, length } = transform

  // Unit cross-section (1m × 1m); DuctVisualSystem scales X and Y to physical mm/1000 dimensions.
  return (
    <group ref={ref} position={position} rotation={rotation} {...handlers}>
      <mesh>
        <boxGeometry args={[1, 1, length]} />
        <meshStandardMaterial color={DUCT_COLOR} />
      </mesh>
    </group>
  )
}
