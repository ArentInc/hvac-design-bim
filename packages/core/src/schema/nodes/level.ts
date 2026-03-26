import dedent from 'dedent'
import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'
import { AhuNode } from './ahu'
import { CeilingNode } from './ceiling'
import { DiffuserNode } from './diffuser'
import { DuctFittingNode } from './duct-fitting'
import { DuctSegmentNode } from './duct-segment'
import { GuideNode } from './guide'
import { HvacZoneNode } from './hvac-zone'
import { PipeSegmentNode } from './pipe-segment'
import { RoofNode } from './roof'
import { ScanNode } from './scan'
import { SlabNode } from './slab'
import { SystemNode } from './system'
import { WallNode } from './wall'
import { ZoneNode } from './zone'

export const LevelNode = BaseNode.extend({
  id: objectId('level'),
  type: nodeType('level'),
  children: z
    .array(
      z.union([
        WallNode.shape.id,
        ZoneNode.shape.id,
        SlabNode.shape.id,
        CeilingNode.shape.id,
        RoofNode.shape.id,
        ScanNode.shape.id,
        GuideNode.shape.id,
        HvacZoneNode.shape.id,
        SystemNode.shape.id,
        AhuNode.shape.id,
        DiffuserNode.shape.id,
        DuctSegmentNode.shape.id,
        DuctFittingNode.shape.id,
        PipeSegmentNode.shape.id,
      ]),
    )
    .default([]),
  // Specific props
  level: z.number().default(0),
}).describe(
  dedent`
  Level node - used to represent a level in the building
  - children: array of floor, wall, ceiling, roof, item nodes
  - level: level number
  `,
)

export type LevelNode = z.infer<typeof LevelNode>
