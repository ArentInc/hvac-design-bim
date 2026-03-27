import stage1 from './preset-01-zones.json'
import { calcDuctSize } from '../../systems/hvac/duct-sizing'
import {
  calcAllPathPressureLosses,
  calcRequiredFanPressure,
  calcStraightDuctLoss,
  findMaxPathPressureLoss,
} from '../../systems/hvac/pressure-loss'
import { selectPipeSize } from '../../systems/hvac/pipe-sizing'
import type { AnyNode } from '../../schema/types'

type MutablePresetData = {
  _description?: string
  nodes: Record<string, any>
  rootNodeIds: string[]
}

function clonePreset(data: unknown): MutablePresetData {
  return JSON.parse(JSON.stringify(data)) as MutablePresetData
}

function makeDiffuser(
  id: string,
  parentId: string,
  tag: string,
  subType: 'anemostat' | 'universal' | 'return_grille',
  position: [number, number, number],
  neckDiameter: number,
  airflowRate: number,
  medium: 'supply_air' | 'return_air',
  systemId: string,
  zoneId: string,
) {
  return {
    object: 'node',
    type: 'diffuser',
    id,
    parentId,
    visible: true,
    metadata: {},
    tag,
    subType,
    position,
    neckDiameter,
    airflowRate,
    port: {
      id: `${id}_port`,
      label: medium === 'return_air' ? 'RA' : 'SA',
      medium,
      position: [0, 0.15, 0] as [number, number, number],
      direction: [0, 1, 0] as [number, number, number],
      connectedSegmentId: null,
    },
    hostDuctId: null,
    systemId,
    zoneId,
  }
}

function makeFittingPort(
  id: string,
  label: string,
  medium: 'supply_air' | 'return_air',
  position: [number, number, number],
  direction: [number, number, number],
  connectedSegmentId: string,
) {
  return { id, label, medium, position, direction, connectedSegmentId }
}

function makeFitting(
  id: string,
  parentId: string,
  fittingType: 'tee' | 'cross',
  position: [number, number, number],
  ports: Array<ReturnType<typeof makeFittingPort>>,
  systemId: string,
  localLossCoefficient = 0.5,
) {
  return {
    object: 'node',
    type: 'duct_fitting',
    id,
    parentId,
    visible: true,
    metadata: {},
    fittingType,
    position,
    rotation: [0, 0, 0] as [number, number, number],
    ports,
    localLossCoefficient,
    systemId,
  }
}

function makeDuct(
  id: string,
  parentId: string,
  start: [number, number, number],
  end: [number, number, number],
  airflowRate: number,
  startPortId: string,
  endPortId: string,
  systemId: string,
  medium: 'supply_air' | 'return_air',
) {
  return {
    object: 'node',
    type: 'duct_segment',
    id,
    parentId,
    visible: true,
    metadata: {},
    start,
    end,
    medium,
    shape: 'rectangular',
    width: null,
    height: null,
    diameter: null,
    ductMaterial: 'galvanized_steel',
    airflowRate,
    startPortId,
    endPortId,
    systemId,
    calcResult: null,
  }
}

function makePipe(
  id: string,
  parentId: string,
  start: [number, number, number],
  end: [number, number, number],
  startPortId: string,
  endPortId: string,
  systemId: string,
) {
  return {
    object: 'node',
    type: 'pipe_segment',
    id,
    parentId,
    visible: true,
    metadata: {},
    start,
    end,
    medium: 'chilled_water',
    nominalSize: null,
    outerDiameter: null,
    startPortId,
    endPortId,
    systemId,
    calcResult: null,
  }
}

function segmentLength(start: [number, number, number], end: [number, number, number]) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function connectRoutingEndpoints(nodes: Record<string, any>) {
  const connectAhuPort = (nodeId: 'ahu_pA' | 'ahu_pB', portId: string, segmentId: string) => {
    const port = nodes[nodeId].ports.find((item: { id: string }) => item.id === portId)
    if (port) port.connectedSegmentId = segmentId
  }

  connectAhuPort('ahu_pA', 'ahu_pA_port_sa', 'duct_seg_pA_sa_main')
  connectAhuPort('ahu_pA', 'ahu_pA_port_ra', 'duct_seg_pA_ra_main')
  connectAhuPort('ahu_pA', 'ahu_pA_port_chws', 'pipe_seg_pA_chws_drop')
  connectAhuPort('ahu_pA', 'ahu_pA_port_chwr', 'pipe_seg_pA_chwr_drop')
  connectAhuPort('ahu_pB', 'ahu_pB_port_sa', 'duct_seg_pB_sa_main')
  connectAhuPort('ahu_pB', 'ahu_pB_port_ra', 'duct_seg_pB_ra_main')
  connectAhuPort('ahu_pB', 'ahu_pB_port_chws', 'pipe_seg_pB_chws_drop')
  connectAhuPort('ahu_pB', 'ahu_pB_port_chwr', 'pipe_seg_pB_chwr_drop')

  const diffuserConnections: Array<[string, string]> = [
    ['diffuser_p01_a', 'duct_seg_pA_sa_z1_a'],
    ['diffuser_p01_b', 'duct_seg_pA_sa_z1_b'],
    ['diffuser_p01_c', 'duct_seg_pA_sa_z1_c'],
    ['diffuser_p02_a', 'duct_seg_pA_sa_z2_a'],
    ['diffuser_p02_b', 'duct_seg_pA_sa_z2_b'],
    ['diffuser_ra_p01', 'duct_seg_pA_ra_zone1'],
    ['diffuser_ra_p02', 'duct_seg_pA_ra_zone2'],
    ['diffuser_p03_a', 'duct_seg_pB_sa_w1'],
    ['diffuser_p03_b', 'duct_seg_pB_sa_w2'],
    ['diffuser_p03_c', 'duct_seg_pB_sa_e1'],
    ['diffuser_p03_d', 'duct_seg_pB_sa_e2'],
    ['diffuser_p03_e', 'duct_seg_pB_sa_w3'],
    ['diffuser_ra_p03_a', 'duct_seg_pB_ra_west'],
    ['diffuser_ra_p03_b', 'duct_seg_pB_ra_east'],
  ]

  for (const [nodeId, segmentId] of diffuserConnections) {
    nodes[nodeId].port.connectedSegmentId = segmentId
    nodes[nodeId].hostDuctId = segmentId
  }
}

function addCommonHvacNodes(nodes: Record<string, any>) {
  nodes.level_preset_1f.children = [
    'wall_00_1f_s',
    'wall_00_1f_e',
    'wall_00_1f_n',
    'wall_00_1f_w',
    'wall_00_1f_int_ew',
    'wall_00_1f_int_ns',
    'slab_00_1f',
    'ceiling_00_1f',
    'hvac_zone_p01',
    'hvac_zone_p02',
    'system_pA',
    'ahu_pA',
    'diffuser_p01_a',
    'diffuser_p01_b',
    'diffuser_p01_c',
    'diffuser_p02_a',
    'diffuser_p02_b',
    'diffuser_ra_p01',
    'diffuser_ra_p02',
  ]

  nodes.level_preset_2f.children = [
    'wall_00_2f_s',
    'wall_00_2f_e',
    'wall_00_2f_n',
    'wall_00_2f_w',
    'wall_00_2f_int_ew',
    'slab_00_2f',
    'ceiling_00_2f',
    'hvac_zone_p03',
    'system_pB',
    'ahu_pB',
    'diffuser_p03_a',
    'diffuser_p03_b',
    'diffuser_p03_c',
    'diffuser_p03_d',
    'diffuser_p03_e',
    'diffuser_ra_p03_a',
    'diffuser_ra_p03_b',
  ]

  nodes.hvac_zone_p01.systemId = 'system_pA'
  nodes.hvac_zone_p02.systemId = 'system_pA'
  nodes.hvac_zone_p03.systemId = 'system_pB'

  nodes.system_pA = {
    object: 'node',
    type: 'system',
    id: 'system_pA',
    parentId: 'level_preset_1f',
    visible: true,
    metadata: {},
    systemName: '系統A（1F事務・会議）',
    servedZoneIds: ['hvac_zone_p01', 'hvac_zone_p02'],
    ahuId: 'ahu_pA',
    aggregatedLoad: { totalCoolingLoad: 27300, totalHeatingLoad: 12800, totalAirflow: 8149 },
    status: 'equipment_selected',
    selectionMargin: 1.1,
    equipmentCandidates: ['AHU-M-10000', 'AHU-L-20000', 'AHU-XL-30000'],
    selectionStatus: 'candidates-available',
    recommendedEquipmentId: 'AHU-M-10000',
    requiredFanPressure: null,
  }

  nodes.system_pB = {
    object: 'node',
    type: 'system',
    id: 'system_pB',
    parentId: 'level_preset_2f',
    visible: true,
    metadata: {},
    systemName: '系統B（2Fサーバー室）',
    servedZoneIds: ['hvac_zone_p03'],
    ahuId: 'ahu_pB',
    aggregatedLoad: { totalCoolingLoad: 40000, totalHeatingLoad: 0, totalAirflow: 11940 },
    status: 'equipment_selected',
    selectionMargin: 1.1,
    equipmentCandidates: ['AHU-L-20000', 'AHU-XL-30000'],
    selectionStatus: 'candidates-available',
    recommendedEquipmentId: 'AHU-L-20000',
    requiredFanPressure: null,
  }

  nodes.ahu_pA = {
    object: 'node',
    type: 'ahu',
    id: 'ahu_pA',
    parentId: 'level_preset_1f',
    visible: true,
    metadata: {},
    tag: 'AHU-A',
    equipmentName: 'AHU-M-10000',
    position: [1.8, 2.7, 8.8],
    rotation: [0, 0, 0],
    dimensions: { width: 2.4, height: 1.8, depth: 1.6 },
    ports: [
      {
        id: 'ahu_pA_port_sa',
        label: 'SA',
        medium: 'supply_air',
        position: [1.2, 0, 0.5],
        direction: [1, 0, 0],
        connectedSegmentId: null,
      },
      {
        id: 'ahu_pA_port_ra',
        label: 'RA',
        medium: 'return_air',
        position: [-1.2, 0, 0.5],
        direction: [-1, 0, 0],
        connectedSegmentId: null,
      },
      {
        id: 'ahu_pA_port_chws',
        label: 'CHW_S',
        medium: 'chilled_water',
        position: [-0.8, -0.3, 0.4],
        direction: [-1, 0, 0],
        connectedSegmentId: null,
      },
      {
        id: 'ahu_pA_port_chwr',
        label: 'CHW_R',
        medium: 'chilled_water',
        position: [-0.8, -0.3, -0.4],
        direction: [-1, 0, 0],
        connectedSegmentId: null,
      },
    ],
    airflowRate: 10000,
    coolingCapacity: 60,
    heatingCapacity: 40,
    staticPressure: 400,
    systemId: 'system_pA',
  }

  nodes.ahu_pB = {
    object: 'node',
    type: 'ahu',
    id: 'ahu_pB',
    parentId: 'level_preset_2f',
    visible: true,
    metadata: {},
    tag: 'AHU-B',
    equipmentName: 'AHU-L-20000',
    position: [1.8, 6.2, 8.8],
    rotation: [0, 0, 0],
    dimensions: { width: 3.6, height: 2.2, depth: 2.0 },
    ports: [
      {
        id: 'ahu_pB_port_sa',
        label: 'SA',
        medium: 'supply_air',
        position: [1.8, 0, 0.6],
        direction: [1, 0, 0],
        connectedSegmentId: null,
      },
      {
        id: 'ahu_pB_port_ra',
        label: 'RA',
        medium: 'return_air',
        position: [-1.8, 0, 0.6],
        direction: [-1, 0, 0],
        connectedSegmentId: null,
      },
      {
        id: 'ahu_pB_port_chws',
        label: 'CHW_S',
        medium: 'chilled_water',
        position: [-1.2, -0.3, 0.5],
        direction: [-1, 0, 0],
        connectedSegmentId: null,
      },
      {
        id: 'ahu_pB_port_chwr',
        label: 'CHW_R',
        medium: 'chilled_water',
        position: [-1.2, -0.3, -0.5],
        direction: [-1, 0, 0],
        connectedSegmentId: null,
      },
    ],
    airflowRate: 20000,
    coolingCapacity: 120,
    heatingCapacity: 80,
    staticPressure: 450,
    systemId: 'system_pB',
  }

  Object.assign(nodes, {
    diffuser_p01_a: makeDiffuser(
      'diffuser_p01_a',
      'level_preset_1f',
      'SA-1F-01A',
      'universal',
      [3.4, 2.7, 6.6],
      600,
      1841,
      'supply_air',
      'system_pA',
      'hvac_zone_p01',
    ),
    diffuser_p01_b: makeDiffuser(
      'diffuser_p01_b',
      'level_preset_1f',
      'SA-1F-01B',
      'universal',
      [5.6, 2.7, 5.2],
      600,
      1841,
      'supply_air',
      'system_pA',
      'hvac_zone_p01',
    ),
    diffuser_p01_c: makeDiffuser(
      'diffuser_p01_c',
      'level_preset_1f',
      'SA-1F-01C',
      'universal',
      [7.8, 2.7, 7.0],
      600,
      1840,
      'supply_air',
      'system_pA',
      'hvac_zone_p01',
    ),
    diffuser_p02_a: makeDiffuser(
      'diffuser_p02_a',
      'level_preset_1f',
      'SA-1F-02A',
      'anemostat',
      [12.4, 2.7, 2.3],
      500,
      1314,
      'supply_air',
      'system_pA',
      'hvac_zone_p02',
    ),
    diffuser_p02_b: makeDiffuser(
      'diffuser_p02_b',
      'level_preset_1f',
      'SA-1F-02B',
      'anemostat',
      [14.1, 2.7, 4.0],
      500,
      1313,
      'supply_air',
      'system_pA',
      'hvac_zone_p02',
    ),
    diffuser_ra_p01: makeDiffuser(
      'diffuser_ra_p01',
      'level_preset_1f',
      'RA-1F-01',
      'return_grille',
      [4.2, 2.7, 8.7],
      600,
      0,
      'return_air',
      'system_pA',
      'hvac_zone_p01',
    ),
    diffuser_ra_p02: makeDiffuser(
      'diffuser_ra_p02',
      'level_preset_1f',
      'RA-1F-02',
      'return_grille',
      [13.0, 2.7, 4.6],
      600,
      0,
      'return_air',
      'system_pA',
      'hvac_zone_p02',
    ),
    diffuser_p03_a: makeDiffuser(
      'diffuser_p03_a',
      'level_preset_2f',
      'SA-2F-01A',
      'universal',
      [2.2, 6.2, 1.8],
      600,
      2388,
      'supply_air',
      'system_pB',
      'hvac_zone_p03',
    ),
    diffuser_p03_b: makeDiffuser(
      'diffuser_p03_b',
      'level_preset_2f',
      'SA-2F-01B',
      'universal',
      [4.2, 6.2, 3.2],
      600,
      2388,
      'supply_air',
      'system_pB',
      'hvac_zone_p03',
    ),
    diffuser_p03_c: makeDiffuser(
      'diffuser_p03_c',
      'level_preset_2f',
      'SA-2F-01C',
      'universal',
      [6.0, 6.2, 2.0],
      600,
      2388,
      'supply_air',
      'system_pB',
      'hvac_zone_p03',
    ),
    diffuser_p03_d: makeDiffuser(
      'diffuser_p03_d',
      'level_preset_2f',
      'SA-2F-01D',
      'universal',
      [8.0, 6.2, 4.2],
      600,
      2388,
      'supply_air',
      'system_pB',
      'hvac_zone_p03',
    ),
    diffuser_p03_e: makeDiffuser(
      'diffuser_p03_e',
      'level_preset_2f',
      'SA-2F-01E',
      'universal',
      [5.4, 6.2, 1.1],
      600,
      2388,
      'supply_air',
      'system_pB',
      'hvac_zone_p03',
    ),
    diffuser_ra_p03_a: makeDiffuser(
      'diffuser_ra_p03_a',
      'level_preset_2f',
      'RA-2F-01A',
      'return_grille',
      [4.2, 6.2, 4.8],
      600,
      0,
      'return_air',
      'system_pB',
      'hvac_zone_p03',
    ),
    diffuser_ra_p03_b: makeDiffuser(
      'diffuser_ra_p03_b',
      'level_preset_2f',
      'RA-2F-01B',
      'return_grille',
      [7.8, 6.2, 4.8],
      600,
      0,
      'return_air',
      'system_pB',
      'hvac_zone_p03',
    ),
  })
}

function addRoutingNodes(nodes: Record<string, any>) {
  nodes.level_preset_1f.children.push(
    'duct_fit_pA_sa_cross',
    'duct_fit_pA_sa_zone2_tee',
    'duct_fit_pA_ra_tee',
    'duct_seg_pA_sa_main',
    'duct_seg_pA_sa_z1_a',
    'duct_seg_pA_sa_z1_b',
    'duct_seg_pA_sa_z1_c',
    'duct_seg_pA_sa_zone2_trunk',
    'duct_seg_pA_sa_z2_a',
    'duct_seg_pA_sa_z2_b',
    'duct_seg_pA_ra_main',
    'duct_seg_pA_ra_zone1',
    'duct_seg_pA_ra_zone2',
    'pipe_seg_pA_chws_main',
    'pipe_seg_pA_chws_drop',
    'pipe_seg_pA_chwr_drop',
    'pipe_seg_pA_chwr_main',
  )

  nodes.level_preset_2f.children.push(
    'duct_fit_pB_sa_root_tee',
    'duct_fit_pB_sa_west_cross',
    'duct_fit_pB_sa_east_tee',
    'duct_fit_pB_ra_tee',
    'duct_seg_pB_sa_main',
    'duct_seg_pB_sa_west_trunk',
    'duct_seg_pB_sa_east_trunk',
    'duct_seg_pB_sa_w1',
    'duct_seg_pB_sa_w2',
    'duct_seg_pB_sa_w3',
    'duct_seg_pB_sa_e1',
    'duct_seg_pB_sa_e2',
    'duct_seg_pB_ra_main',
    'duct_seg_pB_ra_west',
    'duct_seg_pB_ra_east',
    'pipe_seg_pB_chws_main',
    'pipe_seg_pB_chws_drop',
    'pipe_seg_pB_chwr_drop',
    'pipe_seg_pB_chwr_main',
  )

  Object.assign(nodes, {
    duct_fit_pA_sa_cross: makeFitting(
      'duct_fit_pA_sa_cross',
      'level_preset_1f',
      'cross',
      [5.1, 2.7, 8.6],
      [
        makeFittingPort(
          'duct_fit_pA_sa_cross_port_in',
          'IN',
          'supply_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pA_sa_main',
        ),
        makeFittingPort(
          'duct_fit_pA_sa_cross_port_z1a',
          'Z1A',
          'supply_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pA_sa_z1_a',
        ),
        makeFittingPort(
          'duct_fit_pA_sa_cross_port_z1b',
          'Z1B',
          'supply_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pA_sa_z1_b',
        ),
        makeFittingPort(
          'duct_fit_pA_sa_cross_port_zone2',
          'Z2',
          'supply_air',
          [0, 0, 0.2],
          [0, 0, 1],
          'duct_seg_pA_sa_zone2_trunk',
        ),
        makeFittingPort(
          'duct_fit_pA_sa_cross_port_z1c',
          'Z1C',
          'supply_air',
          [0, -0.2, 0],
          [0, -1, 0],
          'duct_seg_pA_sa_z1_c',
        ),
      ],
      'system_pA',
      1.0,
    ),
    duct_fit_pA_sa_zone2_tee: makeFitting(
      'duct_fit_pA_sa_zone2_tee',
      'level_preset_1f',
      'tee',
      [10.8, 2.7, 4.2],
      [
        makeFittingPort(
          'duct_fit_pA_sa_zone2_tee_port_in',
          'IN',
          'supply_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pA_sa_zone2_trunk',
        ),
        makeFittingPort(
          'duct_fit_pA_sa_zone2_tee_port_a',
          'A',
          'supply_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pA_sa_z2_a',
        ),
        makeFittingPort(
          'duct_fit_pA_sa_zone2_tee_port_b',
          'B',
          'supply_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pA_sa_z2_b',
        ),
      ],
      'system_pA',
    ),
    duct_fit_pA_ra_tee: makeFitting(
      'duct_fit_pA_ra_tee',
      'level_preset_1f',
      'tee',
      [7.0, 2.7, 8.6],
      [
        makeFittingPort(
          'duct_fit_pA_ra_tee_port_in',
          'IN',
          'return_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pA_ra_main',
        ),
        makeFittingPort(
          'duct_fit_pA_ra_tee_port_z1',
          'Z1',
          'return_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pA_ra_zone1',
        ),
        makeFittingPort(
          'duct_fit_pA_ra_tee_port_z2',
          'Z2',
          'return_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pA_ra_zone2',
        ),
      ],
      'system_pA',
    ),
    duct_seg_pA_sa_main: makeDuct(
      'duct_seg_pA_sa_main',
      'level_preset_1f',
      [3.0, 2.7, 8.8],
      [5.1, 2.7, 8.6],
      8149,
      'ahu_pA_port_sa',
      'duct_fit_pA_sa_cross_port_in',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_sa_z1_a: makeDuct(
      'duct_seg_pA_sa_z1_a',
      'level_preset_1f',
      [5.1, 2.7, 8.6],
      [3.4, 2.7, 6.6],
      1841,
      'duct_fit_pA_sa_cross_port_z1a',
      'diffuser_p01_a_port',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_sa_z1_b: makeDuct(
      'duct_seg_pA_sa_z1_b',
      'level_preset_1f',
      [5.1, 2.7, 8.6],
      [5.6, 2.7, 5.2],
      1841,
      'duct_fit_pA_sa_cross_port_z1b',
      'diffuser_p01_b_port',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_sa_z1_c: makeDuct(
      'duct_seg_pA_sa_z1_c',
      'level_preset_1f',
      [5.1, 2.7, 8.6],
      [7.8, 2.7, 7.0],
      1840,
      'duct_fit_pA_sa_cross_port_z1c',
      'diffuser_p01_c_port',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_sa_zone2_trunk: makeDuct(
      'duct_seg_pA_sa_zone2_trunk',
      'level_preset_1f',
      [5.1, 2.7, 8.6],
      [10.8, 2.7, 4.2],
      2627,
      'duct_fit_pA_sa_cross_port_zone2',
      'duct_fit_pA_sa_zone2_tee_port_in',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_sa_z2_a: makeDuct(
      'duct_seg_pA_sa_z2_a',
      'level_preset_1f',
      [10.8, 2.7, 4.2],
      [12.4, 2.7, 2.3],
      1314,
      'duct_fit_pA_sa_zone2_tee_port_a',
      'diffuser_p02_a_port',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_sa_z2_b: makeDuct(
      'duct_seg_pA_sa_z2_b',
      'level_preset_1f',
      [10.8, 2.7, 4.2],
      [14.1, 2.7, 4.0],
      1313,
      'duct_fit_pA_sa_zone2_tee_port_b',
      'diffuser_p02_b_port',
      'system_pA',
      'supply_air',
    ),
    duct_seg_pA_ra_main: makeDuct(
      'duct_seg_pA_ra_main',
      'level_preset_1f',
      [0.6, 2.7, 8.8],
      [7.0, 2.7, 8.6],
      8149,
      'ahu_pA_port_ra',
      'duct_fit_pA_ra_tee_port_in',
      'system_pA',
      'return_air',
    ),
    duct_seg_pA_ra_zone1: makeDuct(
      'duct_seg_pA_ra_zone1',
      'level_preset_1f',
      [7.0, 2.7, 8.6],
      [4.2, 2.7, 8.7],
      5522,
      'duct_fit_pA_ra_tee_port_z1',
      'diffuser_ra_p01_port',
      'system_pA',
      'return_air',
    ),
    duct_seg_pA_ra_zone2: makeDuct(
      'duct_seg_pA_ra_zone2',
      'level_preset_1f',
      [7.0, 2.7, 8.6],
      [13.0, 2.7, 4.6],
      2627,
      'duct_fit_pA_ra_tee_port_z2',
      'diffuser_ra_p02_port',
      'system_pA',
      'return_air',
    ),
    pipe_seg_pA_chws_main: makePipe(
      'pipe_seg_pA_chws_main',
      'level_preset_1f',
      [-2.5, 2.2, 8.4],
      [0.6, 2.2, 8.4],
      'plant_pA_chws',
      'pA_chws_hdr',
      'system_pA',
    ),
    pipe_seg_pA_chws_drop: makePipe(
      'pipe_seg_pA_chws_drop',
      'level_preset_1f',
      [0.6, 2.2, 8.4],
      [1.0, 2.2, 8.4],
      'pA_chws_hdr',
      'ahu_pA_port_chws',
      'system_pA',
    ),
    pipe_seg_pA_chwr_drop: makePipe(
      'pipe_seg_pA_chwr_drop',
      'level_preset_1f',
      [1.0, 2.2, 9.2],
      [0.6, 2.2, 9.2],
      'ahu_pA_port_chwr',
      'pA_chwr_hdr',
      'system_pA',
    ),
    pipe_seg_pA_chwr_main: makePipe(
      'pipe_seg_pA_chwr_main',
      'level_preset_1f',
      [0.6, 2.2, 9.2],
      [-2.5, 2.2, 9.2],
      'pA_chwr_hdr',
      'plant_pA_chwr',
      'system_pA',
    ),
    duct_fit_pB_sa_root_tee: makeFitting(
      'duct_fit_pB_sa_root_tee',
      'level_preset_2f',
      'tee',
      [5.0, 6.2, 8.4],
      [
        makeFittingPort(
          'duct_fit_pB_sa_root_tee_port_in',
          'IN',
          'supply_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pB_sa_main',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_root_tee_port_west',
          'WEST',
          'supply_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pB_sa_west_trunk',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_root_tee_port_east',
          'EAST',
          'supply_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pB_sa_east_trunk',
        ),
      ],
      'system_pB',
    ),
    duct_fit_pB_sa_west_cross: makeFitting(
      'duct_fit_pB_sa_west_cross',
      'level_preset_2f',
      'cross',
      [3.6, 6.2, 4.0],
      [
        makeFittingPort(
          'duct_fit_pB_sa_west_cross_port_in',
          'IN',
          'supply_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pB_sa_west_trunk',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_west_cross_port_a',
          'A',
          'supply_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pB_sa_w1',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_west_cross_port_b',
          'B',
          'supply_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pB_sa_w2',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_west_cross_port_c',
          'C',
          'supply_air',
          [0, 0, 0.2],
          [0, 0, 1],
          'duct_seg_pB_sa_w3',
        ),
      ],
      'system_pB',
      1.0,
    ),
    duct_fit_pB_sa_east_tee: makeFitting(
      'duct_fit_pB_sa_east_tee',
      'level_preset_2f',
      'tee',
      [8.0, 6.2, 4.4],
      [
        makeFittingPort(
          'duct_fit_pB_sa_east_tee_port_in',
          'IN',
          'supply_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pB_sa_east_trunk',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_east_tee_port_a',
          'A',
          'supply_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pB_sa_e1',
        ),
        makeFittingPort(
          'duct_fit_pB_sa_east_tee_port_b',
          'B',
          'supply_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pB_sa_e2',
        ),
      ],
      'system_pB',
    ),
    duct_fit_pB_ra_tee: makeFitting(
      'duct_fit_pB_ra_tee',
      'level_preset_2f',
      'tee',
      [6.0, 6.2, 8.2],
      [
        makeFittingPort(
          'duct_fit_pB_ra_tee_port_in',
          'IN',
          'return_air',
          [-0.2, 0, 0],
          [-1, 0, 0],
          'duct_seg_pB_ra_main',
        ),
        makeFittingPort(
          'duct_fit_pB_ra_tee_port_west',
          'WEST',
          'return_air',
          [0, 0, -0.2],
          [0, 0, -1],
          'duct_seg_pB_ra_west',
        ),
        makeFittingPort(
          'duct_fit_pB_ra_tee_port_east',
          'EAST',
          'return_air',
          [0.2, 0, 0],
          [1, 0, 0],
          'duct_seg_pB_ra_east',
        ),
      ],
      'system_pB',
    ),
    duct_seg_pB_sa_main: makeDuct(
      'duct_seg_pB_sa_main',
      'level_preset_2f',
      [3.6, 6.2, 8.8],
      [5.0, 6.2, 8.4],
      11940,
      'ahu_pB_port_sa',
      'duct_fit_pB_sa_root_tee_port_in',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_west_trunk: makeDuct(
      'duct_seg_pB_sa_west_trunk',
      'level_preset_2f',
      [5.0, 6.2, 8.4],
      [3.6, 6.2, 4.0],
      7164,
      'duct_fit_pB_sa_root_tee_port_west',
      'duct_fit_pB_sa_west_cross_port_in',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_east_trunk: makeDuct(
      'duct_seg_pB_sa_east_trunk',
      'level_preset_2f',
      [5.0, 6.2, 8.4],
      [8.0, 6.2, 4.4],
      4776,
      'duct_fit_pB_sa_root_tee_port_east',
      'duct_fit_pB_sa_east_tee_port_in',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_w1: makeDuct(
      'duct_seg_pB_sa_w1',
      'level_preset_2f',
      [3.6, 6.2, 4.0],
      [2.2, 6.2, 1.8],
      2388,
      'duct_fit_pB_sa_west_cross_port_a',
      'diffuser_p03_a_port',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_w2: makeDuct(
      'duct_seg_pB_sa_w2',
      'level_preset_2f',
      [3.6, 6.2, 4.0],
      [4.2, 6.2, 3.2],
      2388,
      'duct_fit_pB_sa_west_cross_port_b',
      'diffuser_p03_b_port',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_w3: makeDuct(
      'duct_seg_pB_sa_w3',
      'level_preset_2f',
      [3.6, 6.2, 4.0],
      [5.4, 6.2, 1.1],
      2388,
      'duct_fit_pB_sa_west_cross_port_c',
      'diffuser_p03_e_port',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_e1: makeDuct(
      'duct_seg_pB_sa_e1',
      'level_preset_2f',
      [8.0, 6.2, 4.4],
      [6.0, 6.2, 2.0],
      2388,
      'duct_fit_pB_sa_east_tee_port_a',
      'diffuser_p03_c_port',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_sa_e2: makeDuct(
      'duct_seg_pB_sa_e2',
      'level_preset_2f',
      [8.0, 6.2, 4.4],
      [8.0, 6.2, 4.2],
      2388,
      'duct_fit_pB_sa_east_tee_port_b',
      'diffuser_p03_d_port',
      'system_pB',
      'supply_air',
    ),
    duct_seg_pB_ra_main: makeDuct(
      'duct_seg_pB_ra_main',
      'level_preset_2f',
      [0.0, 6.2, 8.8],
      [6.0, 6.2, 8.2],
      11940,
      'ahu_pB_port_ra',
      'duct_fit_pB_ra_tee_port_in',
      'system_pB',
      'return_air',
    ),
    duct_seg_pB_ra_west: makeDuct(
      'duct_seg_pB_ra_west',
      'level_preset_2f',
      [6.0, 6.2, 8.2],
      [4.2, 6.2, 4.8],
      7164,
      'duct_fit_pB_ra_tee_port_west',
      'diffuser_ra_p03_a_port',
      'system_pB',
      'return_air',
    ),
    duct_seg_pB_ra_east: makeDuct(
      'duct_seg_pB_ra_east',
      'level_preset_2f',
      [6.0, 6.2, 8.2],
      [7.8, 6.2, 4.8],
      4776,
      'duct_fit_pB_ra_tee_port_east',
      'diffuser_ra_p03_b_port',
      'system_pB',
      'return_air',
    ),
    pipe_seg_pB_chws_main: makePipe(
      'pipe_seg_pB_chws_main',
      'level_preset_2f',
      [-2.5, 5.8, 8.2],
      [0.2, 5.8, 8.2],
      'plant_pB_chws',
      'pB_chws_hdr',
      'system_pB',
    ),
    pipe_seg_pB_chws_drop: makePipe(
      'pipe_seg_pB_chws_drop',
      'level_preset_2f',
      [0.2, 5.8, 8.2],
      [0.6, 5.8, 8.2],
      'pB_chws_hdr',
      'ahu_pB_port_chws',
      'system_pB',
    ),
    pipe_seg_pB_chwr_drop: makePipe(
      'pipe_seg_pB_chwr_drop',
      'level_preset_2f',
      [0.6, 5.8, 9.2],
      [0.2, 5.8, 9.2],
      'ahu_pB_port_chwr',
      'pB_chwr_hdr',
      'system_pB',
    ),
    pipe_seg_pB_chwr_main: makePipe(
      'pipe_seg_pB_chwr_main',
      'level_preset_2f',
      [0.2, 5.8, 9.2],
      [-2.5, 5.8, 9.2],
      'pB_chwr_hdr',
      'plant_pB_chwr',
      'system_pB',
    ),
  })

  connectRoutingEndpoints(nodes)
}

function addStage4Sizing(nodes: Record<string, any>) {
  nodes.system_pA.status = 'validated'
  nodes.system_pB.status = 'validated'

  for (const node of Object.values(nodes)) {
    if (node.type !== 'duct_segment') continue

    const size = calcDuctSize(node.airflowRate, node.id.endsWith('_main') ? 7 : 4)
    if (!size) continue

    node.width = size.width
    node.height = size.height

    const length = segmentLength(node.start, node.end)
    const frictionLoss = calcStraightDuctLoss(
      length,
      size.width / 1000,
      size.height / 1000,
      node.airflowRate,
      node.ductMaterial,
    )
    const area = (size.width / 1000) * (size.height / 1000)
    const velocity = node.airflowRate / 3600 / area

    node.calcResult = {
      velocity: Number(velocity.toFixed(2)),
      frictionLoss: Number(frictionLoss.toFixed(2)),
      totalPressureLoss: Number(frictionLoss.toFixed(2)),
    }
  }

  const coolingCapacities: Record<string, number> = {
    pipe_seg_pA_chws_main: 60,
    pipe_seg_pA_chws_drop: 60,
    pipe_seg_pA_chwr_drop: 60,
    pipe_seg_pA_chwr_main: 60,
    pipe_seg_pB_chws_main: 120,
    pipe_seg_pB_chws_drop: 120,
    pipe_seg_pB_chwr_drop: 120,
    pipe_seg_pB_chwr_main: 120,
  }

  for (const [nodeId, coolingCapacity] of Object.entries(coolingCapacities)) {
    const node = nodes[nodeId]
    const result = selectPipeSize(coolingCapacity, segmentLength(node.start, node.end))
    if (!result.calcResult) continue

    node.nominalSize = result.nominalSize
    node.outerDiameter = result.outerDiameter
    node.calcResult = {
      velocity: Number(result.calcResult.velocity.toFixed(2)),
      pressureDrop: Number(result.calcResult.pressureDrop.toFixed(2)),
    }
  }

  connectRoutingEndpoints(nodes)

  nodes.system_pA.requiredFanPressure = Number(
    calcRequiredFanPressure(
      findMaxPathPressureLoss(calcAllPathPressureLosses('system_pA', nodes as Record<string, AnyNode>)),
    ).toFixed(0),
  )
  nodes.system_pB.requiredFanPressure = Number(
    calcRequiredFanPressure(
      findMaxPathPressureLoss(calcAllPathPressureLosses('system_pB', nodes as Record<string, AnyNode>)),
    ).toFixed(0),
  )
}

export function buildPresetStage02(): MutablePresetData {
  const preset = clonePreset(stage1)
  preset._description =
    'Stage 2: 系統構成・機器配置済み — カタログ整合の取れたAHU・制気口・返りグリル配置済み'
  addCommonHvacNodes(preset.nodes)
  return preset
}

export function buildPresetStage03(): MutablePresetData {
  const preset = buildPresetStage02()
  preset._description =
    'Stage 3: ダクト・配管接続済み（計算前）— 供給・還気・冷水ルート接続済み、寸法と圧損は未計算'
  addRoutingNodes(preset.nodes)
  preset.nodes.system_pA.status = 'routed'
  preset.nodes.system_pB.status = 'routed'
  return preset
}

export function buildPresetStage04(): MutablePresetData {
  const preset = buildPresetStage03()
  preset._description =
    'Stage 4: 全計算完了（完成状態）— 接続・サイズ・圧損・必要静圧が全て整合した完成プリセット'
  addStage4Sizing(preset.nodes)
  return preset
}
