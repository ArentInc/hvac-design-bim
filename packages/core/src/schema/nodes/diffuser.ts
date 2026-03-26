import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { Port } from './hvac-shared'

const DiffuserSubType = z.enum(['anemostat', 'line', 'universal', 'nozzle', 'return_grille'])

export const DiffuserNode = BaseNode.extend({
  id: objectId('diffuser'),
  type: nodeType('diffuser'),
  tag: z.string(),
  subType: DiffuserSubType,
  position: z.tuple([z.number(), z.number(), z.number()]),
  neckDiameter: z.number(),
  airflowRate: z.number(),
  port: Port,
  hostDuctId: z.string().nullable(),
  systemId: z.string(),
  zoneId: z.string(),
})

export type DiffuserNode = z.infer<typeof DiffuserNode>
