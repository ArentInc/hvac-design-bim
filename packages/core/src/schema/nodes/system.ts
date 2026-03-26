import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'

const AggregatedLoad = z.object({
  totalCoolingLoad: z.number(),
  totalHeatingLoad: z.number(),
  totalAirflow: z.number(),
})

const SystemStatus = z.enum(['draft', 'equipment_selected', 'routed', 'calculated', 'validated'])

const EquipmentSelectionStatus = z.enum(['pending', 'candidates-available', 'no-candidates'])

export const SystemNode = BaseNode.extend({
  id: objectId('system'),
  type: nodeType('system'),
  systemName: z.string(),
  servedZoneIds: z.array(z.string()),
  ahuId: z.string().nullable(),
  aggregatedLoad: AggregatedLoad.nullable(),
  status: SystemStatus,
  // TASK-0021: Equipment selection fields
  selectionMargin: z.number().optional().default(1.1),
  equipmentCandidates: z.array(z.string()).optional().default([]),
  selectionStatus: EquipmentSelectionStatus.optional().default('pending'),
  recommendedEquipmentId: z.string().nullable().optional(),
  // TASK-0034: Pressure loss calculation result
  requiredFanPressure: z.number().nullable().optional(),
})

export type SystemNode = z.infer<typeof SystemNode>
