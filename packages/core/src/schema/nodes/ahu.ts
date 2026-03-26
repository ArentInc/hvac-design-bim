import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { Port } from './hvac-shared'

const AhuDimensions = z.object({
  width: z.number(),
  height: z.number(),
  depth: z.number(),
})

export const AhuNode = BaseNode.extend({
  id: objectId('ahu'),
  type: nodeType('ahu'),
  tag: z.string(),
  equipmentName: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number()]),
  dimensions: AhuDimensions,
  ports: z.array(Port),
  airflowRate: z.number(),
  coolingCapacity: z.number(),
  heatingCapacity: z.number(),
  staticPressure: z.number(),
  systemId: z.string(),
})

export type AhuNode = z.infer<typeof AhuNode>
