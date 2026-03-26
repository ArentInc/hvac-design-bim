'use client'

import { type AnyNode, useScene } from '@pascal-app/core'
import { BuildingRenderer } from './building/building-renderer'
import { CeilingRenderer } from './ceiling/ceiling-renderer'
import { DoorRenderer } from './door/door-renderer'
import { GuideRenderer } from './guide/guide-renderer'
import { AhuPlaceholder } from './hvac/ahu-placeholder'
import { DiffuserPlaceholder } from './hvac/diffuser-placeholder'
import { DuctFittingRenderer } from './hvac/duct-fitting-renderer'
import { DuctSegmentRenderer } from './hvac/duct-segment-renderer'
import { HvacZoneRenderer } from './hvac/hvac-zone-renderer'
import { PipeSegmentRenderer } from './hvac/pipe-segment-renderer'
import { ItemRenderer } from './item/item-renderer'
import { LevelRenderer } from './level/level-renderer'
import { RoofRenderer } from './roof/roof-renderer'
import { RoofSegmentRenderer } from './roof-segment/roof-segment-renderer'
import { ScanRenderer } from './scan/scan-renderer'
import { SiteRenderer } from './site/site-renderer'
import { SlabRenderer } from './slab/slab-renderer'
import { WallRenderer } from './wall/wall-renderer'
import { WindowRenderer } from './window/window-renderer'
import { ZoneRenderer } from './zone/zone-renderer'

export const NodeRenderer = ({ nodeId }: { nodeId: AnyNode['id'] }) => {
  const node = useScene((state) => state.nodes[nodeId])

  if (!node) return null

  return (
    <>
      {node.type === 'site' && <SiteRenderer node={node} />}
      {node.type === 'building' && <BuildingRenderer node={node} />}
      {node.type === 'ceiling' && <CeilingRenderer node={node} />}
      {node.type === 'level' && <LevelRenderer node={node} />}
      {node.type === 'item' && <ItemRenderer node={node} />}
      {node.type === 'slab' && <SlabRenderer node={node} />}
      {node.type === 'wall' && <WallRenderer node={node} />}
      {node.type === 'door' && <DoorRenderer node={node} />}
      {node.type === 'window' && <WindowRenderer node={node} />}
      {node.type === 'zone' && <ZoneRenderer node={node} />}
      {node.type === 'roof' && <RoofRenderer node={node} />}
      {node.type === 'roof-segment' && <RoofSegmentRenderer node={node} />}
      {node.type === 'scan' && <ScanRenderer node={node} />}
      {node.type === 'guide' && <GuideRenderer node={node} />}
      {/* HVAC nodes */}
      {node.type === 'hvac_zone' && <HvacZoneRenderer nodeId={node.id} />}
      {node.type === 'system' && null}
      {node.type === 'ahu' && <AhuPlaceholder node={node} />}
      {node.type === 'diffuser' && <DiffuserPlaceholder node={node} />}
      {node.type === 'duct_segment' && <DuctSegmentRenderer nodeId={node.id} />}
      {node.type === 'duct_fitting' && <DuctFittingRenderer nodeId={node.id} />}
      {node.type === 'pipe_segment' && <PipeSegmentRenderer nodeId={node.id} />}
    </>
  )
}
