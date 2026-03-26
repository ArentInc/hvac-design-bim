import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { DuctMaterial, DuctMedium, DuctShape } from './hvac-shared'

const DuctCalcResult = z.object({
  velocity: z.number(),
  frictionLoss: z.number(),
  totalPressureLoss: z.number(),
})

export const DuctSegmentNode = BaseNode.extend({
  id: objectId('duct_seg'),
  type: nodeType('duct_segment'),
  start: z.tuple([z.number(), z.number(), z.number()]),
  end: z.tuple([z.number(), z.number(), z.number()]),
  medium: DuctMedium,
  shape: DuctShape,
  width: z.number().nullable(),
  height: z.number().nullable(),
  diameter: z.number().nullable(),
  ductMaterial: DuctMaterial,
  airflowRate: z.number().nullable(),
  startPortId: z.string(),
  endPortId: z.string(),
  systemId: z.string(),
  calcResult: DuctCalcResult.nullable(),
})

export type DuctSegmentNode = z.infer<typeof DuctSegmentNode>
