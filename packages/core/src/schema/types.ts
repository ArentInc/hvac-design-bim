import z from 'zod'
import { AhuNode } from './nodes/ahu'
import { BuildingNode } from './nodes/building'
import { CeilingNode } from './nodes/ceiling'
import { DiffuserNode } from './nodes/diffuser'
import { DoorNode } from './nodes/door'
import { DuctFittingNode } from './nodes/duct-fitting'
import { DuctSegmentNode } from './nodes/duct-segment'
import { GuideNode } from './nodes/guide'
import { HvacZoneNode } from './nodes/hvac-zone'
import { ItemNode } from './nodes/item'
import { LevelNode } from './nodes/level'
import { PipeSegmentNode } from './nodes/pipe-segment'
import { RoofNode } from './nodes/roof'
import { RoofSegmentNode } from './nodes/roof-segment'
import { ScanNode } from './nodes/scan'
import { SiteNode } from './nodes/site'
import { SlabNode } from './nodes/slab'
import { SystemNode } from './nodes/system'
import { WallNode } from './nodes/wall'
import { WindowNode } from './nodes/window'
import { ZoneNode } from './nodes/zone'

export const HVAC_NODE_TYPES = [
  'hvac_zone',
  'system',
  'ahu',
  'diffuser',
  'duct_segment',
  'duct_fitting',
  'pipe_segment',
] as const

export const AnyNode = z.discriminatedUnion('type', [
  SiteNode,
  BuildingNode,
  LevelNode,
  WallNode,
  ItemNode,
  ZoneNode,
  SlabNode,
  CeilingNode,
  RoofNode,
  RoofSegmentNode,
  ScanNode,
  GuideNode,
  WindowNode,
  DoorNode,
  HvacZoneNode,
  SystemNode,
  AhuNode,
  DiffuserNode,
  DuctSegmentNode,
  DuctFittingNode,
  PipeSegmentNode,
])

export type AnyNode = z.infer<typeof AnyNode>
export type AnyNodeType = AnyNode['type']
export type AnyNodeId = AnyNode['id']
