import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { Orientation, PerimeterSegment, ZoneUsage } from './hvac-shared'

const DesignConditions = z.object({
  coolingSetpoint: z.number().default(26),
  heatingSetpoint: z.number().default(22),
  relativeHumidity: z.number().default(50),
  supplyAirTempDiff: z.number().default(10),
})

export const HvacZoneCalcResult = z.object({
  coolingLoad: z.number(),
  heatingLoad: z.number(),
  requiredAirflow: z.number(),
  internalLoad: z.number(),
  envelopeLoad: z.number(),
  perimeterLoadBreakdown: z.array(
    z.object({
      orientation: Orientation,
      solarCorrectionFactor: z.number(),
      envelopeLoadContribution: z.number(),
    }),
  ),
  status: z.enum(['success', 'error']),
  error: z.string().optional(),
})

export const HvacZoneNode = BaseNode.extend({
  id: objectId('hvac_zone'),
  type: nodeType('hvac_zone'),
  zoneName: z.string(),
  usage: ZoneUsage,
  floorArea: z.number().positive(),
  ceilingHeight: z.number().default(2.7),
  occupantDensity: z.number().default(0.15),
  boundary: z.array(z.tuple([z.number(), z.number()])),
  designConditions: DesignConditions.default({
    coolingSetpoint: 26,
    heatingSetpoint: 22,
    relativeHumidity: 50,
    supplyAirTempDiff: 10,
  }),
  perimeterSegments: z.array(PerimeterSegment),
  systemId: z.string().nullable(),
  calcResult: HvacZoneCalcResult.nullable(),
})

export type HvacZoneNode = z.infer<typeof HvacZoneNode>
