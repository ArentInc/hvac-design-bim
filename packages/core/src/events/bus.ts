import type { ThreeEvent } from '@react-three/fiber'
import mitt from 'mitt'
import type {
  BuildingNode,
  CeilingNode,
  DoorNode,
  ItemNode,
  LevelNode,
  RoofNode,
  RoofSegmentNode,
  SiteNode,
  SlabNode,
  WallNode,
  WindowNode,
  ZoneNode,
} from '../schema'
import type { AhuNode } from '../schema/nodes/ahu'
import type { DiffuserNode } from '../schema/nodes/diffuser'
import type { DuctFittingNode } from '../schema/nodes/duct-fitting'
import type { DuctSegmentNode } from '../schema/nodes/duct-segment'
import type { HvacZoneNode } from '../schema/nodes/hvac-zone'
import type { PipeSegmentNode } from '../schema/nodes/pipe-segment'
import type { SystemNode } from '../schema/nodes/system'
import type { AnyNode } from '../schema/types'

// Base event interfaces
export interface GridEvent {
  position: [number, number, number]
  nativeEvent: ThreeEvent<PointerEvent>
}

export interface NodeEvent<T extends AnyNode = AnyNode> {
  node: T
  position: [number, number, number]
  localPosition: [number, number, number]
  normal?: [number, number, number]
  stopPropagation: () => void
  nativeEvent: ThreeEvent<PointerEvent>
}

export type WallEvent = NodeEvent<WallNode>
export type ItemEvent = NodeEvent<ItemNode>
export type SiteEvent = NodeEvent<SiteNode>
export type BuildingEvent = NodeEvent<BuildingNode>
export type LevelEvent = NodeEvent<LevelNode>
export type ZoneEvent = NodeEvent<ZoneNode>
export type SlabEvent = NodeEvent<SlabNode>
export type CeilingEvent = NodeEvent<CeilingNode>
export type RoofEvent = NodeEvent<RoofNode>
export type RoofSegmentEvent = NodeEvent<RoofSegmentNode>
export type WindowEvent = NodeEvent<WindowNode>
export type DoorEvent = NodeEvent<DoorNode>
export type HvacZoneEvent = NodeEvent<HvacZoneNode>
export type SystemEvent = NodeEvent<SystemNode>
export type AhuEvent = NodeEvent<AhuNode>
export type DiffuserEvent = NodeEvent<DiffuserNode>
export type DuctSegmentEvent = NodeEvent<DuctSegmentNode>
export type DuctFittingEvent = NodeEvent<DuctFittingNode>
export type PipeSegmentEvent = NodeEvent<PipeSegmentNode>

// Event suffixes - exported for use in hooks
export const eventSuffixes = [
  'click',
  'move',
  'enter',
  'leave',
  'pointerdown',
  'pointerup',
  'context-menu',
  'double-click',
] as const

export type EventSuffix = (typeof eventSuffixes)[number]

type NodeEvents<T extends string, E> = {
  [K in `${T}:${EventSuffix}`]: E
}

type GridEvents = {
  [K in `grid:${EventSuffix}`]: GridEvent
}

export interface CameraControlEvent {
  nodeId: AnyNode['id']
}

export interface ThumbnailGenerateEvent {
  projectId: string
}

type CameraControlEvents = {
  'camera-controls:view': CameraControlEvent
  'camera-controls:focus': CameraControlEvent
  'camera-controls:capture': CameraControlEvent
  'camera-controls:top-view': undefined
  'camera-controls:orbit-cw': undefined
  'camera-controls:orbit-ccw': undefined
  'camera-controls:generate-thumbnail': ThumbnailGenerateEvent
}

type ToolEvents = {
  'tool:cancel': undefined
}

type PresetEvents = {
  'preset:generate-thumbnail': { presetId: string; nodeId: string }
  'preset:thumbnail-updated': { presetId: string; thumbnailUrl: string }
}

type EditorEvents = GridEvents &
  NodeEvents<'wall', WallEvent> &
  NodeEvents<'item', ItemEvent> &
  NodeEvents<'site', SiteEvent> &
  NodeEvents<'building', BuildingEvent> &
  NodeEvents<'level', LevelEvent> &
  NodeEvents<'zone', ZoneEvent> &
  NodeEvents<'slab', SlabEvent> &
  NodeEvents<'ceiling', CeilingEvent> &
  NodeEvents<'roof', RoofEvent> &
  NodeEvents<'roof-segment', RoofSegmentEvent> &
  NodeEvents<'window', WindowEvent> &
  NodeEvents<'door', DoorEvent> &
  NodeEvents<'hvac_zone', HvacZoneEvent> &
  NodeEvents<'system', SystemEvent> &
  NodeEvents<'ahu', AhuEvent> &
  NodeEvents<'diffuser', DiffuserEvent> &
  NodeEvents<'duct_segment', DuctSegmentEvent> &
  NodeEvents<'duct_fitting', DuctFittingEvent> &
  NodeEvents<'pipe_segment', PipeSegmentEvent> &
  CameraControlEvents &
  ToolEvents &
  PresetEvents

export const emitter = mitt<EditorEvents>()
