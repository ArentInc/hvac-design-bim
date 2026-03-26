import { type DiffuserNode, useRegistry, useScene } from '@pascal-app/core'
import { useRef } from 'react'
import { DoubleSide, type Group } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { SCENE_LAYER } from '../../../lib/layers'

const NECK_HEIGHT = 0.15 // 150mm

const PORT_MEDIUM_COLORS: Record<string, string> = {
  supply_air: '#42A5F5',
  return_air: '#EF5350',
  exhaust_air: '#9E9E9E',
}

export function getDiffuserColor(medium: string): string {
  return PORT_MEDIUM_COLORS[medium] ?? '#9E9E9E'
}

/** Returns face plate size in meters (neckDiameter is in mm) */
export function getFaceSize(neckDiameter: number): number {
  return (neckDiameter / 1000) * 1.5
}

/** Returns neck radius in meters (neckDiameter is in mm) */
export function getNeckRadius(neckDiameter: number): number {
  return neckDiameter / 2 / 1000
}

interface DiffuserRendererProps {
  nodeId: string
}

export function DiffuserRenderer({ nodeId }: DiffuserRendererProps) {
  const ref = useRef<Group>(null!)
  const node = useScene((s) => s.nodes[nodeId as DiffuserNode['id']]) as DiffuserNode | undefined

  useRegistry(nodeId, 'diffuser', ref)
  const handlers = useNodeEvents(node!, 'diffuser')

  if (!node) return null

  const faceSize = getFaceSize(node.neckDiameter)
  const neckRadius = getNeckRadius(node.neckDiameter)
  const color = getDiffuserColor(node.port.medium)

  return (
    <group ref={ref} position={node.position} {...handlers}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} layers={SCENE_LAYER}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshStandardMaterial color={color} side={DoubleSide} />
      </mesh>
      <mesh position={[0, NECK_HEIGHT / 2, 0]} layers={SCENE_LAYER}>
        <cylinderGeometry args={[neckRadius, neckRadius, NECK_HEIGHT, 16]} />
        <meshStandardMaterial color="#90A4AE" />
      </mesh>
    </group>
  )
}
