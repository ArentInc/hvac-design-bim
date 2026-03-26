import { type AhuNode, useRegistry, useScene } from '@pascal-app/core'
import { useRef } from 'react'
import type { Group } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { SCENE_LAYER } from '../../../lib/layers'

const PORT_COLORS: Record<string, string> = {
  supply_air: '#42A5F5',
  return_air: '#EF5350',
  chilled_water: '#80DEEA',
  hot_water: '#FFA726',
  refrigerant: '#CE93D8',
}

export function getPortColor(medium: string): string {
  return PORT_COLORS[medium] ?? '#9E9E9E'
}

interface AhuRendererProps {
  nodeId: string
}

export function AhuRenderer({ nodeId }: AhuRendererProps) {
  const ref = useRef<Group>(null!)
  const node = useScene((s) => s.nodes[nodeId as AhuNode['id']]) as AhuNode | undefined

  useRegistry(nodeId, 'ahu', ref)
  const handlers = useNodeEvents(node!, 'ahu')

  if (!node) return null

  const { width, height, depth } = node.dimensions

  return (
    <group ref={ref} position={node.position} {...handlers}>
      <mesh layers={SCENE_LAYER}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#607D8B" />
      </mesh>
      {node.ports.map((port) => (
        <mesh key={port.id} position={port.position} layers={SCENE_LAYER}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 16]} />
          <meshStandardMaterial color={getPortColor(port.medium)} />
        </mesh>
      ))}
    </group>
  )
}
