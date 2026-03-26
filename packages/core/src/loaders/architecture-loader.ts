import { z } from 'zod'

const ArchitectureWallSchema = z.object({
  id: z.string(),
  orientation: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
  vertices: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })),
  wallArea: z.number().positive(),
  glazingRatio: z.number().min(0).max(1),
})

const ArchitectureLevelSchema = z.object({
  levelId: z.string(),
  floorHeight: z.number(),
  ceilingHeight: z.number(),
  floorOutline: z.array(z.object({ x: z.number(), y: z.number() })),
  externalWalls: z.array(ArchitectureWallSchema),
})

const ArchitectureSchema = z.object({
  buildingName: z.string(),
  levels: z.array(ArchitectureLevelSchema),
})

export type Architecture = z.infer<typeof ArchitectureSchema>
export type ArchitectureLevel = z.infer<typeof ArchitectureLevelSchema>
export type ArchitectureWall = z.infer<typeof ArchitectureWallSchema>

export function parseArchitecture(json: unknown): Architecture {
  return ArchitectureSchema.parse(json)
}
