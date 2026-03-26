import type { AnyNode } from '../schema/types'

// ─── Graph types ─────────────────────────────────────────────────

export interface GraphNode {
  nodeId: string
  nodeType: string
  /** portId → connected nodeId (null = unconnected) */
  ports: Map<string, string | null>
  neighbors: string[]
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  fromPortId: string
  toPortId: string
}

export interface SystemGraph {
  /** nodeId → GraphNode */
  nodes: Map<string, GraphNode>
  /** edgeId → GraphEdge */
  edges: Map<string, GraphEdge>
  /** AHU nodeId (root) */
  root: string | null
  /** Diffuser nodeIds (leaves) */
  leaves: string[]
}

export interface CycleResult {
  hasCycle: boolean
  cycleNodes: string[][]
}

export interface PathResult {
  path: string[]
  segmentCount: number
  /** total duct/pipe length in metres */
  totalLength: number
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Return all Port objects from a node (AHU, DuctFitting, Diffuser). */
function getNodePorts(node: AnyNode): Array<{ id: string; connectedSegmentId: string | null }> {
  if (node.type === 'ahu' || node.type === 'duct_fitting') {
    return node.ports.map((p) => ({ id: p.id, connectedSegmentId: p.connectedSegmentId }))
  }
  if (node.type === 'diffuser') {
    return [{ id: node.port.id, connectedSegmentId: node.port.connectedSegmentId }]
  }
  return []
}

/** Euclidean distance between two 3D points. */
function distance(a: [number, number, number], b: [number, number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Length of a duct/pipe segment in metres. */
function segmentLength(node: AnyNode): number {
  if (node.type === 'duct_segment' || node.type === 'pipe_segment') {
    return distance(node.start, node.end)
  }
  return 0
}

// ─── buildSystemGraph ─────────────────────────────────────────────

export function buildSystemGraph(systemId: string, nodes: Record<string, AnyNode>): SystemGraph {
  // Collect nodes belonging to this system
  const systemNodes = Object.values(nodes).filter((n) => {
    if (
      n.type === 'ahu' ||
      n.type === 'diffuser' ||
      n.type === 'duct_segment' ||
      n.type === 'duct_fitting' ||
      n.type === 'pipe_segment'
    ) {
      return (n as AnyNode & { systemId: string }).systemId === systemId
    }
    return false
  })

  if (systemNodes.length === 0) {
    return { nodes: new Map(), edges: new Map(), root: null, leaves: [] }
  }

  // Build portId → nodeId lookup from endpoint nodes (AHU, fitting, diffuser)
  const portToNode = new Map<string, string>()
  for (const node of systemNodes) {
    for (const port of getNodePorts(node)) {
      portToNode.set(port.id, node.id)
    }
  }

  // Build portId → connected segment lookup from segment nodes
  // A segment's startPortId/endPortId identifies which port on an endpoint node it connects to
  const portToSegment = new Map<string, string>() // portId → segmentId
  for (const node of systemNodes) {
    if (node.type === 'duct_segment' || node.type === 'pipe_segment') {
      portToSegment.set(node.startPortId, node.id)
      portToSegment.set(node.endPortId, node.id)
    }
  }

  // Build GraphNode for every system node
  const graphNodes = new Map<string, GraphNode>()
  for (const node of systemNodes) {
    graphNodes.set(node.id, {
      nodeId: node.id,
      nodeType: node.type,
      ports: new Map(),
      neighbors: [],
    })
  }

  // Build edges: each segment connects two endpoint nodes (or other segments via fittings)
  // Edge: segmentNode ↔ endpointNode (where endpoint owns startPortId or endPortId)
  const graphEdges = new Map<string, GraphEdge>()
  let edgeCounter = 0

  for (const node of systemNodes) {
    if (node.type !== 'duct_segment' && node.type !== 'pipe_segment') continue

    const segNode = graphNodes.get(node.id)!

    for (const portId of [node.startPortId, node.endPortId]) {
      const endpointNodeId = portToNode.get(portId)

      if (endpointNodeId === undefined) {
        // Unconnected port — record null in segment's port map
        segNode.ports.set(portId, null)
        continue
      }

      segNode.ports.set(portId, endpointNodeId)

      const endpointNode = graphNodes.get(endpointNodeId)!
      endpointNode.ports.set(portId, node.id)

      // Add neighbor relationships (bidirectional)
      if (!segNode.neighbors.includes(endpointNodeId)) {
        segNode.neighbors.push(endpointNodeId)
      }
      if (!endpointNode.neighbors.includes(node.id)) {
        endpointNode.neighbors.push(node.id)
      }

      // Add edge
      const edgeId = `edge_${edgeCounter++}`
      graphEdges.set(edgeId, {
        id: edgeId,
        from: node.id,
        to: endpointNodeId,
        fromPortId: portId,
        toPortId: portId,
      })
    }
  }

  // Also handle endpoint-node ports that point to segments via connectedSegmentId
  // (for any ports not already covered above)
  for (const node of systemNodes) {
    const nodePorts = getNodePorts(node)
    const graphNode = graphNodes.get(node.id)!

    for (const port of nodePorts) {
      if (graphNode.ports.has(port.id)) continue // already processed

      if (port.connectedSegmentId !== null && graphNodes.has(port.connectedSegmentId)) {
        graphNode.ports.set(port.id, port.connectedSegmentId)
      } else {
        graphNode.ports.set(port.id, null)
      }
    }
  }

  // Identify root (AHU) and leaves (Diffuser)
  let root: string | null = null
  const leaves: string[] = []

  for (const node of systemNodes) {
    if (node.type === 'ahu') root = node.id
    else if (node.type === 'diffuser') leaves.push(node.id)
  }

  return { nodes: graphNodes, edges: graphEdges, root, leaves }
}

// ─── BFS traversal ───────────────────────────────────────────────

export function traverseBFS(
  graph: SystemGraph,
  startNodeId: string,
  visitor: (nodeId: string, depth: number) => boolean | undefined,
): void {
  const visited = new Set<string>()
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNodeId, depth: 0 }]
  visited.add(startNodeId)

  while (queue.length > 0) {
    const item = queue.shift()!
    const result = visitor(item.nodeId, item.depth)
    if (result === false) continue

    const node = graph.nodes.get(item.nodeId)
    if (!node) continue

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({ nodeId: neighborId, depth: item.depth + 1 })
      }
    }
  }
}

// ─── DFS traversal ───────────────────────────────────────────────

export function traverseDFS(
  graph: SystemGraph,
  startNodeId: string,
  visitor: (nodeId: string, depth: number) => boolean | undefined,
): void {
  const visited = new Set<string>()

  function dfs(nodeId: string, depth: number): void {
    visited.add(nodeId)
    const result = visitor(nodeId, depth)
    if (result === false) return

    const node = graph.nodes.get(nodeId)
    if (!node) return

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        dfs(neighborId, depth + 1)
      }
    }
  }

  dfs(startNodeId, 0)
}

// ─── Cycle detection ─────────────────────────────────────────────

export function detectCycles(graph: SystemGraph): CycleResult {
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const cycleNodes: string[][] = []

  function dfs(nodeId: string, parentId: string | null): boolean {
    visited.add(nodeId)
    inStack.add(nodeId)

    const node = graph.nodes.get(nodeId)
    if (!node) {
      inStack.delete(nodeId)
      return false
    }

    for (const neighborId of node.neighbors) {
      if (neighborId === parentId) continue // skip the edge we came from (undirected)

      if (!visited.has(neighborId)) {
        if (dfs(neighborId, nodeId)) return true
      } else if (inStack.has(neighborId)) {
        // Found a cycle — collect nodes in cycle
        const cycle: string[] = [neighborId]
        const stack = Array.from(inStack)
        const startIdx = stack.indexOf(neighborId)
        for (let i = startIdx + 1; i < stack.length; i++) {
          const item = stack[i]
          if (item !== undefined) cycle.push(item)
        }
        cycleNodes.push(cycle)
        return true
      }
    }

    inStack.delete(nodeId)
    return false
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, null)
    }
  }

  return { hasCycle: cycleNodes.length > 0, cycleNodes }
}

// ─── Longest path ─────────────────────────────────────────────────

export function findLongestPath(graph: SystemGraph, nodes: Record<string, AnyNode>): PathResult {
  if (graph.root === null || graph.leaves.length === 0) {
    return { path: [], segmentCount: 0, totalLength: 0 }
  }

  let bestPath: string[] = []
  let bestLength = -1

  function dfs(
    nodeId: string,
    currentPath: string[],
    currentLength: number,
    visited: Set<string>,
  ): void {
    visited.add(nodeId)
    currentPath.push(nodeId)

    if (graph.leaves.includes(nodeId)) {
      if (currentLength > bestLength) {
        bestLength = currentLength
        bestPath = [...currentPath]
      }
    }

    const node = graph.nodes.get(nodeId)
    if (node) {
      for (const neighborId of node.neighbors) {
        if (!visited.has(neighborId)) {
          const neighborNode = nodes[neighborId]
          const addedLength = neighborNode ? segmentLength(neighborNode) : 0
          dfs(neighborId, currentPath, currentLength + addedLength, visited)
        }
      }
    }

    currentPath.pop()
    visited.delete(nodeId)
  }

  dfs(graph.root, [], 0, new Set())

  const segmentCount = bestPath.filter((id) => {
    const n = nodes[id]
    return n?.type === 'duct_segment' || n?.type === 'pipe_segment'
  }).length

  return { path: bestPath, segmentCount, totalLength: bestLength }
}

// ─── Airflow aggregation ──────────────────────────────────────────

export function aggregateAirflow(
  graph: SystemGraph,
  nodes: Record<string, AnyNode>,
): Map<string, number> {
  const result = new Map<string, number>()

  /** Returns aggregated airflow for a node given its subtree. */
  function computeAirflow(nodeId: string, parentId: string | null): number {
    const node = nodes[nodeId]
    if (!node) return 0

    // Diffuser: its own airflowRate is the leaf contribution
    if (node.type === 'diffuser') {
      return node.airflowRate
    }

    const graphNode = graph.nodes.get(nodeId)
    if (!graphNode) return 0

    // Sum airflow from all children (neighbors except parent)
    let total = 0
    for (const neighborId of graphNode.neighbors) {
      if (neighborId === parentId) continue
      const contribution = computeAirflow(neighborId, nodeId)
      total += contribution
    }

    // Record airflow for duct/pipe segments
    if (node.type === 'duct_segment' || node.type === 'pipe_segment') {
      result.set(nodeId, total)
    }

    return total
  }

  if (graph.root !== null) {
    computeAirflow(graph.root, null)
  }

  return result
}
