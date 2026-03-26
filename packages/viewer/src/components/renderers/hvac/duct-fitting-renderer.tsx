import { type DuctFittingNode, useRegistry, useScene } from '@pascal-app/core'
import { useRef } from 'react'
import type { Group } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'

type Port = DuctFittingNode['ports'][number]

/** Returns the display color for a port based on connection state. */
export function getPortColor(connectedSegmentId: string | null): string {
  return connectedSegmentId !== null ? '#4CAF50' : '#F44336'
}

const PORT_RADIUS = 0.04
const PORT_DEPTH = 0.06
const ELBOW_SIZE = 0.2
const TEE_SIZE = 0.2
const FITTING_COLOR = '#78909C'

function ElbowMesh({ size }: { size: number }) {
  return (
    <>
      <mesh position={[0, 0, size / 4]}>
        <boxGeometry args={[size, size, size / 2]} />
        <meshStandardMaterial color={FITTING_COLOR} />
      </mesh>
      <mesh position={[size / 4, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[size, size, size / 2]} />
        <meshStandardMaterial color={FITTING_COLOR} />
      </mesh>
    </>
  )
}

function TeeMesh({ size }: { size: number }) {
  return (
    <>
      <mesh>
        <boxGeometry args={[size * 1.5, size, size]} />
        <meshStandardMaterial color={FITTING_COLOR} />
      </mesh>
      <mesh position={[0, 0, size / 2]}>
        <boxGeometry args={[size, size, size / 2]} />
        <meshStandardMaterial color={FITTING_COLOR} />
      </mesh>
    </>
  )
}

function PortMeshes({ ports }: { ports: Port[] }) {
  return (
    <>
      {ports.map((port) => (
        <mesh key={port.id} position={port.position}>
          <cylinderGeometry args={[PORT_RADIUS, PORT_RADIUS, PORT_DEPTH, 8]} />
          <meshStandardMaterial color={getPortColor(port.connectedSegmentId)} />
        </mesh>
      ))}
    </>
  )
}

export function DuctFittingRenderer({ nodeId }: { nodeId: string }) {
  const ref = useRef<Group>(null!)
  const node = useScene((s) => s.nodes[nodeId as DuctFittingNode['id']]) as
    | DuctFittingNode
    | undefined

  useRegistry(nodeId, 'duct_fitting', ref)
  const handlers = useNodeEvents(node!, 'duct_fitting')

  if (!node) return null

  const fittingMesh =
    node.fittingType === 'tee' ? <TeeMesh size={TEE_SIZE} /> : <ElbowMesh size={ELBOW_SIZE} />

  return (
    <group ref={ref} position={node.position} rotation={node.rotation} {...handlers}>
      {fittingMesh}
      <PortMeshes ports={node.ports} />
    </group>
  )
}
