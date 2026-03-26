import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { FittingType, Port } from './hvac-shared'

export const DuctFittingNode = BaseNode.extend({
  id: objectId('duct_fit'),
  type: nodeType('duct_fitting'),
  fittingType: FittingType,
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number()]),
  ports: z.array(Port),
  localLossCoefficient: z.number(),
  systemId: z.string(),
})

export type DuctFittingNode = z.infer<typeof DuctFittingNode>
