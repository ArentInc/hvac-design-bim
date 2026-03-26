import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'

const AggregatedLoad = z.object({
  totalCoolingLoad: z.number(),
  totalHeatingLoad: z.number(),
  totalAirflow: z.number(),
})

const SystemStatus = z.enum(['draft', 'equipment_selected', 'routed', 'calculated', 'validated'])

export const SystemNode = BaseNode.extend({
  id: objectId('system'),
  type: nodeType('system'),
  systemName: z.string(),
  servedZoneIds: z.array(z.string()),
  ahuId: z.string().nullable(),
  aggregatedLoad: AggregatedLoad.nullable(),
  status: SystemStatus,
})

export type SystemNode = z.infer<typeof SystemNode>
