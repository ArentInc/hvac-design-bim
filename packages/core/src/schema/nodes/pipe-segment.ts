import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { PipeMedium } from './hvac-shared'

const PipeCalcResult = z.object({
  velocity: z.number(),
  pressureDrop: z.number(),
})

export const PipeSegmentNode = BaseNode.extend({
  id: objectId('pipe_seg'),
  type: nodeType('pipe_segment'),
  start: z.tuple([z.number(), z.number(), z.number()]),
  end: z.tuple([z.number(), z.number(), z.number()]),
  medium: PipeMedium,
  nominalSize: z.number().nullable(),
  outerDiameter: z.number().nullable(),
  startPortId: z.string(),
  endPortId: z.string(),
  systemId: z.string(),
  calcResult: PipeCalcResult.nullable(),
})

export type PipeSegmentNode = z.infer<typeof PipeSegmentNode>
