import { z } from 'zod'

export const Orientation = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])

export const ZoneUsage = z.enum([
  'office_general',
  'office_server',
  'conference',
  'reception',
  'corridor',
])

export const PortMedium = z.enum([
  'supply_air',
  'return_air',
  'chilled_water',
  'hot_water',
  'refrigerant',
])

export const DuctMedium = z.enum(['supply_air', 'return_air', 'exhaust_air'])

export const DuctShape = z.enum(['rectangular', 'round'])

export const DuctMaterial = z.enum(['galvanized_steel', 'stainless_steel', 'aluminum', 'flexible'])

export const FittingType = z.enum(['elbow', 'tee', 'wye', 'cross', 'reducer', 'cap'])

export const PipeMedium = z.enum(['chilled_water', 'hot_water', 'condensate'])

export const PerimeterSegment = z.object({
  orientation: Orientation,
  wallArea: z.number(),
  glazingRatio: z.number().min(0).max(1),
})

export const Port = z.object({
  id: z.string(),
  label: z.string(),
  medium: PortMedium,
  position: z.tuple([z.number(), z.number(), z.number()]),
  direction: z.tuple([z.number(), z.number(), z.number()]),
  connectedSegmentId: z.string().nullable(),
})
