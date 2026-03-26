import type { ArchitectureLevel, ArchitectureWall } from './architecture-loader'

export interface WallMetadata {
  wallId: string
  orientation: ArchitectureWall['orientation']
  wallArea: number
  glazingRatio: number
  vertices: { x: number; y: number; z: number }[]
}

export function extractWallMetadata(level: ArchitectureLevel): WallMetadata[] {
  return level.externalWalls.map((wall) => ({
    wallId: wall.id,
    orientation: wall.orientation,
    wallArea: wall.wallArea,
    glazingRatio: wall.glazingRatio,
    vertices: wall.vertices,
  }))
}
