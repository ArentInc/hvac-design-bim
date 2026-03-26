import { describe, expect, it } from 'vitest'
import type { AnyNode } from '../../schema/types'
import {
  aggregateAirflow,
  buildSystemGraph,
  detectCycles,
  findLongestPath,
  traverseBFS,
  traverseDFS,
} from '../hvac-graph'

// ─── Factory helpers ─────────────────────────────────────────────

const BASE = {
  object: 'node' as const,
  parentId: null,
  visible: true,
  metadata: {},
}

function makeAhu(
  id: string,
  systemId: string,
  portConnections: { portId: string; connectedSegmentId: string | null }[],
) {
  return {
    ...BASE,
    id,
    type: 'ahu' as const,
    tag: id,
    equipmentName: id,
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    dimensions: { width: 1, height: 1, depth: 1 },
    ports: portConnections.map((pc, i) => ({
      id: pc.portId,
      label: `port_${i}`,
      medium: 'supply_air' as const,
      position: [0, 0, 0] as [number, number, number],
      direction: [0, 0, 1] as [number, number, number],
      connectedSegmentId: pc.connectedSegmentId,
    })),
    airflowRate: 1000,
    coolingCapacity: 10000,
    heatingCapacity: 5000,
    staticPressure: 100,
    systemId,
    children: [],
  }
}

function makeDiffuser(
  id: string,
  systemId: string,
  portId: string,
  connectedSegmentId: string | null,
  airflowRate = 500,
) {
  return {
    ...BASE,
    id,
    type: 'diffuser' as const,
    tag: id,
    subType: 'anemostat' as const,
    position: [0, 0, 0] as [number, number, number],
    neckDiameter: 0.2,
    airflowRate,
    port: {
      id: portId,
      label: 'supply',
      medium: 'supply_air' as const,
      position: [0, 0, 0] as [number, number, number],
      direction: [0, -1, 0] as [number, number, number],
      connectedSegmentId,
    },
    hostDuctId: connectedSegmentId,
    systemId,
    zoneId: 'zone_1',
    children: [],
  }
}

function makeDuctSeg(id: string, systemId: string, startPortId: string, endPortId: string) {
  return {
    ...BASE,
    id,
    type: 'duct_segment' as const,
    start: [0, 0, 0] as [number, number, number],
    end: [5, 0, 0] as [number, number, number],
    medium: 'supply_air' as const,
    shape: 'rectangular' as const,
    width: 0.4,
    height: 0.2,
    diameter: null,
    ductMaterial: 'galvanized_steel' as const,
    airflowRate: null,
    startPortId,
    endPortId,
    systemId,
    calcResult: null,
    children: [],
  }
}

function makeTee(
  id: string,
  systemId: string,
  portConnections: { portId: string; connectedSegmentId: string | null }[],
) {
  return {
    ...BASE,
    id,
    type: 'duct_fitting' as const,
    fittingType: 'tee' as const,
    position: [5, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    ports: portConnections.map((pc, i) => ({
      id: pc.portId,
      label: `port_${i}`,
      medium: 'supply_air' as const,
      position: [0, 0, 0] as [number, number, number],
      direction: [0, 0, 1] as [number, number, number],
      connectedSegmentId: pc.connectedSegmentId,
    })),
    localLossCoefficient: 0.5,
    systemId,
    children: [],
  }
}

// ─── Test cases ──────────────────────────────────────────────────

describe('TASK-0009: hvac-graph utility', () => {
  it('テスト1: 直列接続のグラフ構築 AHU → DuctSeg → Diffuser', () => {
    // AHU port_a connects to duct_1
    // duct_1.startPortId = 'port_a', duct_1.endPortId = 'port_b'
    // Diffuser port_b connects to duct_1
    const ahu = makeAhu('ahu_1', 'sys_1', [{ portId: 'port_a', connectedSegmentId: 'duct_1' }])
    const diff = makeDiffuser('diff_1', 'sys_1', 'port_b', 'duct_1')
    const seg = makeDuctSeg('duct_1', 'sys_1', 'port_a', 'port_b')
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      diff_1: diff as AnyNode,
      duct_1: seg as AnyNode,
    }

    const graph = buildSystemGraph('sys_1', nodes)
    expect(graph.root).toBe('ahu_1')
    expect(graph.leaves).toContain('diff_1')
    expect(graph.edges.size).toBe(2)
    expect(graph.nodes.size).toBe(3)
  })

  it('テスト2: 分岐のあるグラフ構築 AHU → DuctSeg → Tee → DuctSeg×2 → Diffuser×2', () => {
    // AHU → duct_1 → Tee → duct_2 → Diffuser1
    //                     → duct_3 → Diffuser2
    const ahu = makeAhu('ahu_1', 'sys_1', [
      { portId: 'port_ahu_out', connectedSegmentId: 'duct_1' },
    ])
    const tee = makeTee('tee_1', 'sys_1', [
      { portId: 'port_tee_in', connectedSegmentId: 'duct_1' },
      { portId: 'port_tee_a', connectedSegmentId: 'duct_2' },
      { portId: 'port_tee_b', connectedSegmentId: 'duct_3' },
    ])
    const seg1 = makeDuctSeg('duct_1', 'sys_1', 'port_ahu_out', 'port_tee_in')
    const seg2 = makeDuctSeg('duct_2', 'sys_1', 'port_tee_a', 'port_diff1')
    const seg3 = makeDuctSeg('duct_3', 'sys_1', 'port_tee_b', 'port_diff2')
    const diff1 = makeDiffuser('diff_1', 'sys_1', 'port_diff1', 'duct_2', 300)
    const diff2 = makeDiffuser('diff_2', 'sys_1', 'port_diff2', 'duct_3', 200)
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      tee_1: tee as AnyNode,
      duct_1: seg1 as AnyNode,
      duct_2: seg2 as AnyNode,
      duct_3: seg3 as AnyNode,
      diff_1: diff1 as AnyNode,
      diff_2: diff2 as AnyNode,
    }

    const graph = buildSystemGraph('sys_1', nodes)
    expect(graph.root).toBe('ahu_1')
    expect(graph.leaves).toHaveLength(2)
    expect(graph.leaves).toContain('diff_1')
    expect(graph.leaves).toContain('diff_2')
    const teeNode = graph.nodes.get('tee_1')
    expect(teeNode?.neighbors).toHaveLength(3)
  })

  it('テスト3: 未接続ポートの検出', () => {
    // DuctSeg with endPortId pointing to nothing (dangling)
    const ahu = makeAhu('ahu_1', 'sys_1', [{ portId: 'port_a', connectedSegmentId: 'duct_1' }])
    const seg = makeDuctSeg('duct_1', 'sys_1', 'port_a', 'port_dangling')
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      duct_1: seg as AnyNode,
    }

    const graph = buildSystemGraph('sys_1', nodes)
    const segNode = graph.nodes.get('duct_1')
    // port_dangling has no owner → appears as null in ports map
    expect(segNode).toBeDefined()
    const hasNullEntry = Array.from(segNode!.ports.values()).some((v) => v === null)
    expect(hasNullEntry).toBe(true)
  })

  it('テスト4: BFS トラバーサル順序', () => {
    // 3-level tree: AHU(depth0) → duct_1(depth1) → diff_1(depth2)
    const ahu = makeAhu('ahu_1', 'sys_1', [{ portId: 'port_a', connectedSegmentId: 'duct_1' }])
    const seg = makeDuctSeg('duct_1', 'sys_1', 'port_a', 'port_b')
    const diff = makeDiffuser('diff_1', 'sys_1', 'port_b', 'duct_1')
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      duct_1: seg as AnyNode,
      diff_1: diff as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)

    const visited: Array<{ nodeId: string; depth: number }> = []
    traverseBFS(graph, 'ahu_1', (nodeId, depth) => {
      visited.push({ nodeId, depth })
      return undefined
    })

    expect(visited[0]).toEqual({ nodeId: 'ahu_1', depth: 0 })
    expect(visited[1]).toEqual({ nodeId: 'duct_1', depth: 1 })
    expect(visited[2]).toEqual({ nodeId: 'diff_1', depth: 2 })
  })

  it('テスト5: DFS トラバーサル順序', () => {
    const ahu = makeAhu('ahu_1', 'sys_1', [{ portId: 'port_a', connectedSegmentId: 'duct_1' }])
    const seg = makeDuctSeg('duct_1', 'sys_1', 'port_a', 'port_b')
    const diff = makeDiffuser('diff_1', 'sys_1', 'port_b', 'duct_1')
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      duct_1: seg as AnyNode,
      diff_1: diff as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)

    const visited: string[] = []
    traverseDFS(graph, 'ahu_1', (nodeId) => {
      visited.push(nodeId)
      return undefined
    })

    // DFS should visit AHU first
    expect(visited[0]).toBe('ahu_1')
    // All nodes should be visited
    expect(visited).toContain('duct_1')
    expect(visited).toContain('diff_1')
  })

  it('テスト6: サイクル検出 -- サイクルなし', () => {
    const ahu = makeAhu('ahu_1', 'sys_1', [{ portId: 'port_a', connectedSegmentId: 'duct_1' }])
    const seg = makeDuctSeg('duct_1', 'sys_1', 'port_a', 'port_b')
    const diff = makeDiffuser('diff_1', 'sys_1', 'port_b', 'duct_1')
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      duct_1: seg as AnyNode,
      diff_1: diff as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)
    const result = detectCycles(graph)
    expect(result.hasCycle).toBe(false)
    expect(result.cycleNodes).toHaveLength(0)
  })

  it('テスト7: サイクル検出 -- サイクルあり', () => {
    // ahu → duct_1 → fitting_1 → duct_2 → ahu (cycle via second AHU port)
    const ahu = makeAhu('ahu_1', 'sys_1', [
      { portId: 'port_ahu_out', connectedSegmentId: 'duct_1' },
      { portId: 'port_ahu_back', connectedSegmentId: 'duct_2' },
    ])
    const fitting = makeTee('fit_1', 'sys_1', [
      { portId: 'port_fit_in', connectedSegmentId: 'duct_1' },
      { portId: 'port_fit_out', connectedSegmentId: 'duct_2' },
    ])
    const seg1 = makeDuctSeg('duct_1', 'sys_1', 'port_ahu_out', 'port_fit_in')
    const seg2 = makeDuctSeg('duct_2', 'sys_1', 'port_fit_out', 'port_ahu_back')
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      fit_1: fitting as AnyNode,
      duct_1: seg1 as AnyNode,
      duct_2: seg2 as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)
    const result = detectCycles(graph)
    expect(result.hasCycle).toBe(true)
  })

  it('テスト8: 最遠経路探索', () => {
    // AHU → duct_1 → tee → duct_2(short) → diff_1
    //                     → duct_3(long, 10m) → diff_2
    const ahu = makeAhu('ahu_1', 'sys_1', [
      { portId: 'port_ahu_out', connectedSegmentId: 'duct_1' },
    ])
    const tee = makeTee('tee_1', 'sys_1', [
      { portId: 'port_tee_in', connectedSegmentId: 'duct_1' },
      { portId: 'port_tee_a', connectedSegmentId: 'duct_2' },
      { portId: 'port_tee_b', connectedSegmentId: 'duct_3' },
    ])
    const seg1 = makeDuctSeg('duct_1', 'sys_1', 'port_ahu_out', 'port_tee_in')
    // duct_2: short (1m)
    const seg2 = {
      ...makeDuctSeg('duct_2', 'sys_1', 'port_tee_a', 'port_diff1'),
      start: [0, 0, 0] as [number, number, number],
      end: [1, 0, 0] as [number, number, number],
    }
    // duct_3: long (10m)
    const seg3 = {
      ...makeDuctSeg('duct_3', 'sys_1', 'port_tee_b', 'port_diff2'),
      start: [0, 0, 0] as [number, number, number],
      end: [10, 0, 0] as [number, number, number],
    }
    const diff1 = makeDiffuser('diff_1', 'sys_1', 'port_diff1', 'duct_2', 300)
    const diff2 = makeDiffuser('diff_2', 'sys_1', 'port_diff2', 'duct_3', 200)
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      tee_1: tee as AnyNode,
      duct_1: seg1 as AnyNode,
      duct_2: seg2 as AnyNode,
      duct_3: seg3 as AnyNode,
      diff_1: diff1 as AnyNode,
      diff_2: diff2 as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)
    const result = findLongestPath(graph, nodes)
    // The longer branch should go through duct_3 to diff_2
    expect(result.path).toContain('diff_2')
    expect(result.totalLength).toBeGreaterThan(5) // duct_3 alone is 10m
  })

  it('テスト9: 風量合算 -- 直列 AHU → Seg(null) → Diffuser(500)', () => {
    const ahu = makeAhu('ahu_1', 'sys_1', [{ portId: 'port_a', connectedSegmentId: 'duct_1' }])
    const seg = makeDuctSeg('duct_1', 'sys_1', 'port_a', 'port_b')
    const diff = makeDiffuser('diff_1', 'sys_1', 'port_b', 'duct_1', 500)
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      duct_1: seg as AnyNode,
      diff_1: diff as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)
    const airflowMap = aggregateAirflow(graph, nodes)
    expect(airflowMap.get('duct_1')).toBe(500)
  })

  it('テスト10: 風量合算 -- 分岐 MainSeg=500, BranchA=300, BranchB=200', () => {
    const ahu = makeAhu('ahu_1', 'sys_1', [
      { portId: 'port_ahu_out', connectedSegmentId: 'duct_main' },
    ])
    const tee = makeTee('tee_1', 'sys_1', [
      { portId: 'port_tee_in', connectedSegmentId: 'duct_main' },
      { portId: 'port_tee_a', connectedSegmentId: 'duct_a' },
      { portId: 'port_tee_b', connectedSegmentId: 'duct_b' },
    ])
    const mainSeg = makeDuctSeg('duct_main', 'sys_1', 'port_ahu_out', 'port_tee_in')
    const segA = makeDuctSeg('duct_a', 'sys_1', 'port_tee_a', 'port_diff_a')
    const segB = makeDuctSeg('duct_b', 'sys_1', 'port_tee_b', 'port_diff_b')
    const diffA = makeDiffuser('diff_a', 'sys_1', 'port_diff_a', 'duct_a', 300)
    const diffB = makeDiffuser('diff_b', 'sys_1', 'port_diff_b', 'duct_b', 200)
    const nodes: Record<string, AnyNode> = {
      ahu_1: ahu as AnyNode,
      tee_1: tee as AnyNode,
      duct_main: mainSeg as AnyNode,
      duct_a: segA as AnyNode,
      duct_b: segB as AnyNode,
      diff_a: diffA as AnyNode,
      diff_b: diffB as AnyNode,
    }
    const graph = buildSystemGraph('sys_1', nodes)
    const airflowMap = aggregateAirflow(graph, nodes)
    expect(airflowMap.get('duct_main')).toBe(500)
    expect(airflowMap.get('duct_a')).toBe(300)
    expect(airflowMap.get('duct_b')).toBe(200)
  })

  it('テスト11: 空グラフ -- systemIdに属するノードなし', () => {
    const nodes: Record<string, AnyNode> = {}
    const graph = buildSystemGraph('sys_nonexistent', nodes)
    expect(graph.root).toBeNull()
    expect(graph.leaves).toHaveLength(0)
    expect(graph.nodes.size).toBe(0)
  })
})
