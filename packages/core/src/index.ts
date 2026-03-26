// Loaders
export type {
  Architecture,
  ArchitectureLevel,
  ArchitectureWall,
} from './loaders/architecture-loader'
export { parseArchitecture } from './loaders/architecture-loader'
export type { WallMetadata } from './loaders/architecture-metadata'
export { extractWallMetadata } from './loaders/architecture-metadata'

// Store

// Constants
export {
  formatHvacLoadValue,
  getZoneColorByUsage,
  ZONE_DEFAULT_COLOR,
  ZONE_USAGE_COLORS,
} from './constants/hvac-colors'
// Presets
export { HVAC_PRESETS, type PresetData } from './data/presets'
export type {
  AhuEvent,
  BuildingEvent,
  CameraControlEvent,
  CeilingEvent,
  DiffuserEvent,
  DoorEvent,
  DuctFittingEvent,
  DuctSegmentEvent,
  EventSuffix,
  GridEvent,
  HvacZoneEvent,
  ItemEvent,
  LevelEvent,
  NodeEvent,
  PipeSegmentEvent,
  RoofEvent,
  RoofSegmentEvent,
  SiteEvent,
  SlabEvent,
  WallEvent,
  WindowEvent,
  ZoneEvent,
} from './events/bus'
// Events
export { emitter, eventSuffixes } from './events/bus'
// Hooks
export {
  sceneRegistry,
  useRegistry,
} from './hooks/scene-registry/scene-registry'
export { pointInPolygon, spatialGridManager } from './hooks/spatial-grid/spatial-grid-manager'
export {
  initSpatialGridSync,
  resolveLevelId,
} from './hooks/spatial-grid/spatial-grid-sync'
export { useSpatialQuery } from './hooks/spatial-grid/use-spatial-query'
// Asset storage
export { loadAssetUrl, saveAsset } from './lib/asset-storage'
// Space detection
export {
  detectSpacesForLevel,
  initSpaceDetectionSync,
  type Space,
  wallTouchesOthers,
} from './lib/space-detection'
// Schema
export * from './schema'
// 🔵 バリデーションシステム — TASK-0038 (REQ-1201)
export type { Warning, WarningCode, WarningSeverity } from './schema/hvac/warning'
export {
  type ControlValue,
  type ItemInteractiveState,
  useInteractive,
} from './store/use-interactive'
export { clearSceneHistory, default as useScene } from './store/use-scene'
export { default as useValidation } from './store/use-validation'
// Systems
export { CeilingSystem } from './systems/ceiling/ceiling-system'
export { DoorSystem } from './systems/door/door-system'
export type { DistributeAirflowResult } from './systems/hvac/airflow-distribution'
export {
  AHU_AIRFLOW_TOLERANCE,
  distributeAirflow,
  findDirtyAirflowSystems,
} from './systems/hvac/airflow-distribution'
// HVAC Systems
export { AirflowDistributionSystem } from './systems/hvac/airflow-distribution-system'
export type { AhuCatalogEntry, EquipmentSelectionResult } from './systems/hvac/equipment-selection'
export {
  DEFAULT_SELECTION_MARGIN,
  filterAhuCandidates,
  selectEquipment,
  sortAhuCandidates,
} from './systems/hvac/equipment-selection'
export { EquipmentSelectionSystem } from './systems/hvac/equipment-selection-system'
// 🔵 配管口径選定 — TASK-0036 (REQ-1103, REQ-1104)
export type { SelectPipeSizeResult } from './systems/hvac/pipe-sizing'
export {
  calculateFlowRate,
  calculatePressureDrop,
  calculateTheoreticalDiameter,
  PIPE_SIZING_DEFAULTS,
  selectPipeSize,
  snapToStandardSize,
  validateVelocityConstraint,
} from './systems/hvac/pipe-sizing'
export type { AggregatedLoadResult } from './systems/hvac/system-aggregation'
export {
  aggregateSystemLoad,
  findSystemsForZone,
} from './systems/hvac/system-aggregation'
export { SystemAggregationSystem } from './systems/hvac/system-aggregation-system'
export {
  AIRFLOW_MISMATCH_THRESHOLD,
  checkAirflowMismatch,
  checkAirflowNotSet,
  checkPipeNotConnected,
  checkPressureNotCalculated,
  checkSizeNotDetermined,
  checkUnconnectedPorts,
  checkVelocityExceeded,
  checkZoneNoSystem,
  DUCT_MAX_VELOCITY_MS,
  ValidationSystem,
} from './systems/hvac/validation-system'
export { ItemSystem } from './systems/item/item-system'
export { RoofSystem } from './systems/roof/roof-system'
export { SlabSystem } from './systems/slab/slab-system'
export {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  getWallPlanFootprint,
  getWallThickness,
} from './systems/wall/wall-footprint'
export {
  calculateLevelMiters,
  type Point2D,
  pointToKey,
  type WallMiterData,
} from './systems/wall/wall-mitering'
export { WallSystem } from './systems/wall/wall-system'
export { WindowSystem } from './systems/window/window-system'
// Utilities
export { calculatePolygonArea } from './utils/polygon-area'
export { isObject } from './utils/types'
