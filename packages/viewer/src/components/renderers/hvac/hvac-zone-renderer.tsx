import { type HvacZoneNode, useRegistry, useScene } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import { DoubleSide, type Mesh, Shape } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { ZONE_LAYER } from '../../../lib/layers'

export const ZONE_USAGE_COLORS: Record<string, string> = {
  office_general: '#42A5F5',
  conference: '#FFA726',
  reception: '#66BB6A',
  office_server: '#EF5350',
  corridor: '#BDBDBD',
}

export const ZONE_DEFAULT_COLOR = '#9E9E9E'

const ZONE_OPACITY = 0.4
const Y_OFFSET = 0.01

export function createZoneShape(boundary: [number, number][]): Shape {
  const shape = new Shape()
  if (boundary.length < 3) return shape
  // boundary is [x, y] tuples; shape is in X-Y plane, rotated to XZ plane in JSX
  shape.moveTo(boundary[0]![0]!, -boundary[0]![1]!)
  for (let i = 1; i < boundary.length; i++) {
    shape.lineTo(boundary[i]![0]!, -boundary[i]![1]!)
  }
  shape.closePath()
  return shape
}

export function getZoneColor(node: HvacZoneNode): string {
  if (!node.calcResult) return ZONE_DEFAULT_COLOR
  return ZONE_USAGE_COLORS[node.usage] ?? ZONE_DEFAULT_COLOR
}

interface HvacZoneRendererProps {
  nodeId: string
}

export function HvacZoneRenderer({ nodeId }: HvacZoneRendererProps) {
  const ref = useRef<Mesh>(null!)
  const node = useScene((s) => s.nodes[nodeId as HvacZoneNode['id']]) as HvacZoneNode | undefined

  useRegistry(nodeId, 'hvac_zone', ref)
  const handlers = useNodeEvents(node!, 'hvac_zone')

  const shape = useMemo(() => {
    if (!node?.boundary || node.boundary.length < 3) return null
    return createZoneShape(node.boundary)
  }, [node?.boundary])

  const color = useMemo(() => {
    if (!node) return ZONE_DEFAULT_COLOR
    return getZoneColor(node)
  }, [node?.calcResult, node?.usage, node])

  if (!node || !shape) return null

  return (
    <mesh
      ref={ref}
      layers={ZONE_LAYER}
      position={[0, Y_OFFSET, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      {...handlers}
    >
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={color} opacity={ZONE_OPACITY} side={DoubleSide} transparent />
    </mesh>
  )
}
