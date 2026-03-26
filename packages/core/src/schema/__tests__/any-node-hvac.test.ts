import { describe, expect, it } from 'vitest'
import { AnyNode, HVAC_NODE_TYPES } from '../types'

// Shared test data helpers
const makePort = (id: string, medium: string) => ({
  id,
  label: id,
  medium,
  position: [0, 0, 0] as [number, number, number],
  direction: [1, 0, 0] as [number, number, number],
  connectedSegmentId: null,
})

const hvacZoneData = {
  type: 'hvac_zone',
  zoneName: 'ゾーンA',
  usage: 'office_general',
  floorArea: 50,
  boundary: [
    [0, 0],
    [5, 0],
    [5, 10],
    [0, 10],
  ] as [number, number][],
  perimeterSegments: [{ orientation: 'S', wallArea: 15, glazingRatio: 0.4 }],
  systemId: null,
  calcResult: null,
}

const systemData = {
  type: 'system',
  systemName: '系統A',
  servedZoneIds: [],
  ahuId: null,
  aggregatedLoad: null,
  status: 'draft',
}

const ahuData = {
  type: 'ahu',
  tag: 'AHU-1',
  equipmentName: 'AHU-S-5000',
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  dimensions: { width: 1.2, height: 1.8, depth: 2.4 },
  ports: [makePort('p1', 'supply_air'), makePort('p2', 'return_air')],
  airflowRate: 5000,
  coolingCapacity: 30000,
  heatingCapacity: 20000,
  staticPressure: 150,
  systemId: 'system_aaa',
}

const diffuserData = {
  type: 'diffuser',
  tag: 'SA-1-01',
  subType: 'anemostat',
  position: [3, 2.5, 4] as [number, number, number],
  neckDiameter: 150,
  airflowRate: 200,
  port: makePort('p1', 'supply_air'),
  hostDuctId: null,
  systemId: 'system_aaa',
  zoneId: 'hvac_zone_xxx',
}

const ductSegmentData = {
  type: 'duct_segment',
  start: [0, 3, 0] as [number, number, number],
  end: [5, 3, 0] as [number, number, number],
  medium: 'supply_air',
  shape: 'rectangular',
  width: 400,
  height: 300,
  diameter: null,
  ductMaterial: 'galvanized_steel',
  airflowRate: null,
  startPortId: 'port_start_001',
  endPortId: 'port_end_001',
  systemId: 'system_aaa',
  calcResult: null,
}

const ductFittingData = {
  type: 'duct_fitting',
  fittingType: 'elbow',
  position: [2, 3, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  ports: [makePort('p1', 'supply_air'), makePort('p2', 'supply_air')],
  localLossCoefficient: 0.3,
  systemId: 'system_aaa',
}

const pipeSegmentData = {
  type: 'pipe_segment',
  start: [0, 3, 0] as [number, number, number],
  end: [5, 3, 0] as [number, number, number],
  medium: 'chilled_water',
  nominalSize: null,
  outerDiameter: null,
  startPortId: 'port_start_001',
  endPortId: 'port_end_001',
  systemId: 'system_aaa',
  calcResult: null,
}

const wallData = {
  type: 'wall',
  start: [0, 0] as [number, number],
  end: [5, 0] as [number, number],
}

describe('AnyNode HVAC integration', () => {
  it('テスト1: AnyNode が HvacZoneNode を受け入れ', () => {
    const result = AnyNode.parse(hvacZoneData)
    expect(result.type).toBe('hvac_zone')
  })

  it('テスト2: AnyNode が SystemNode を受け入れ', () => {
    const result = AnyNode.parse(systemData)
    expect(result.type).toBe('system')
  })

  it('テスト3: AnyNode が AhuNode を受け入れ', () => {
    const result = AnyNode.parse(ahuData)
    expect(result.type).toBe('ahu')
  })

  it('テスト4: AnyNode が DiffuserNode を受け入れ', () => {
    const result = AnyNode.parse(diffuserData)
    expect(result.type).toBe('diffuser')
  })

  it('テスト5: AnyNode が DuctSegmentNode を受け入れ', () => {
    const result = AnyNode.parse(ductSegmentData)
    expect(result.type).toBe('duct_segment')
  })

  it('テスト6: AnyNode が DuctFittingNode を受け入れ', () => {
    const result = AnyNode.parse(ductFittingData)
    expect(result.type).toBe('duct_fitting')
  })

  it('テスト7: AnyNode が PipeSegmentNode を受け入れ', () => {
    const result = AnyNode.parse(pipeSegmentData)
    expect(result.type).toBe('pipe_segment')
  })

  it('テスト8: 既存ノード（WallNode）の後方互換性', () => {
    const result = AnyNode.parse(wallData)
    expect(result.type).toBe('wall')
  })

  it('テスト9: HVAC_NODE_TYPES定数の完全性', () => {
    expect(HVAC_NODE_TYPES).toHaveLength(7)
    expect(HVAC_NODE_TYPES).toContain('hvac_zone')
    expect(HVAC_NODE_TYPES).toContain('system')
    expect(HVAC_NODE_TYPES).toContain('ahu')
    expect(HVAC_NODE_TYPES).toContain('diffuser')
    expect(HVAC_NODE_TYPES).toContain('duct_segment')
    expect(HVAC_NODE_TYPES).toContain('duct_fitting')
    expect(HVAC_NODE_TYPES).toContain('pipe_segment')
  })
})
