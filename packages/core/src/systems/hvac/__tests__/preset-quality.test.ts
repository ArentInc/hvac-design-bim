import { describe, expect, it } from 'vitest'
import catalogAhu from '../../../data/catalog-ahu.json'
import catalogDiffuser from '../../../data/catalog-diffuser.json'
import { HVAC_PRESETS } from '../../../data/presets'
import standardDuctSizes from '../../../data/standard-duct-sizes.json'
import standardPipeSizes from '../../../data/standard-pipe-sizes.json'
import { AnyNode } from '../../../schema/types'
import {
  checkAirflowMismatch,
  checkAirflowNotSet,
  checkPipeNotConnected,
  checkPressureNotCalculated,
  checkSizeNotDetermined,
  checkUnconnectedPorts,
  checkVelocityExceeded,
  checkZoneNoSystem,
} from '../validation-system'

function runAllChecks(nodes: Record<string, AnyNode>) {
  return [
    ...checkUnconnectedPorts(nodes),
    ...checkAirflowNotSet(nodes),
    ...checkSizeNotDetermined(nodes),
    ...checkVelocityExceeded(nodes),
    ...checkPressureNotCalculated(nodes),
    ...checkZoneNoSystem(nodes),
    ...checkAirflowMismatch(nodes),
    ...checkPipeNotConnected(nodes),
  ]
}

function collectEndpointPorts(nodes: Record<string, AnyNode>) {
  const refs = new Map<string, Array<{ nodeId: string; nodeType: string }>>()

  const addRef = (portId: string, nodeId: string, nodeType: string) => {
    const list = refs.get(portId) ?? []
    list.push({ nodeId, nodeType })
    refs.set(portId, list)
  }

  for (const node of Object.values(nodes)) {
    if (node.type === 'ahu' || node.type === 'duct_fitting') {
      for (const port of node.ports) addRef(port.id, node.id, node.type)
    }
    if (node.type === 'diffuser') addRef(node.port.id, node.id, node.type)
  }

  return refs
}

describe('preset quality', () => {
  it('全プリセットの全ノードが既存 AnyNode スキーマに通る', () => {
    for (const preset of HVAC_PRESETS) {
      for (const [nodeId, node] of Object.entries(preset.data.nodes)) {
        expect(() => AnyNode.parse(node), `${preset.stage}:${nodeId}`).not.toThrow()
      }
    }
  })

  it('全プリセットの親子参照が解決される', () => {
    for (const preset of HVAC_PRESETS) {
      const nodes = preset.data.nodes as Record<string, AnyNode>

      for (const [nodeId, node] of Object.entries(nodes)) {
        if (node.parentId !== null) {
          expect(nodes[node.parentId], `${preset.stage}:${nodeId}:parent`).toBeDefined()
        }

        if (!('children' in node) || !Array.isArray(node.children)) continue

        for (const child of node.children) {
          if (typeof child === 'string') {
            expect(nodes[child], `${preset.stage}:${nodeId}:child:${child}`).toBeDefined()
            expect(nodes[child]!.parentId, `${preset.stage}:${nodeId}:child-parent:${child}`).toBe(
              node.id,
            )
            continue
          }

          expect(
            nodes[child.id],
            `${preset.stage}:${nodeId}:embedded-child:${child.id}`,
          ).toBeDefined()
        }
      }

      for (const rootId of preset.data.rootNodeIds) {
        expect(nodes[rootId], `${preset.stage}:root:${rootId}`).toBeDefined()
      }
    }
  })

  it('Stage 2-4 は endpoint ポート ID が一意で、ダクト端点が一意に解決する', () => {
    for (const preset of HVAC_PRESETS.filter((item) => item.stage >= 2)) {
      const nodes = preset.data.nodes as Record<string, AnyNode>
      const endpointPorts = collectEndpointPorts(nodes)
      const portIds = [...endpointPorts.keys()]
      const duplicates = portIds.filter((portId, index) => portIds.indexOf(portId) !== index)
      expect(duplicates, `stage ${preset.stage}:duplicate endpoint ports`).toHaveLength(0)

      for (const node of Object.values(nodes)) {
        if (node.type !== 'duct_segment') continue

        expect(
          endpointPorts.get(node.startPortId),
          `stage ${preset.stage}:${node.id}:startPort:${node.startPortId}`,
        ).toHaveLength(1)
        expect(
          endpointPorts.get(node.endPortId),
          `stage ${preset.stage}:${node.id}:endPort:${node.endPortId}`,
        ).toHaveLength(1)
      }
    }
  })

  it('Stage 3-4 の配管端点は AHU ポート・共有ヘッダ・設備境界のいずれかに解決する', () => {
    for (const preset of HVAC_PRESETS.filter((item) => item.stage >= 3)) {
      const nodes = preset.data.nodes as Record<string, AnyNode>
      const endpointPorts = collectEndpointPorts(nodes)
      const pipeEndpointUsage = new Map<string, string[]>()

      for (const node of Object.values(nodes)) {
        if (node.type !== 'pipe_segment') continue

        for (const portId of [node.startPortId, node.endPortId]) {
          const refs = pipeEndpointUsage.get(portId) ?? []
          refs.push(node.id)
          pipeEndpointUsage.set(portId, refs)
        }
      }

      for (const [portId, segmentIds] of pipeEndpointUsage) {
        const ownerCount = endpointPorts.get(portId)?.length ?? 0
        const isPlantBoundary = portId.startsWith('plant_')
        const isSharedHeader = segmentIds.length === 2

        expect(
          ownerCount === 1 || isPlantBoundary || isSharedHeader,
          `stage ${preset.stage}:pipe-port:${portId}`,
        ).toBe(true)
      }
    }
  })

  it('Stage 2-4 の推奨 AHU はカタログに存在し、容量と風量余裕率を満たす', () => {
    for (const preset of HVAC_PRESETS.filter((item) => item.stage >= 2)) {
      const nodes = preset.data.nodes as Record<string, AnyNode>

      for (const system of Object.values(nodes)) {
        if (system.type !== 'system') continue

        const model = catalogAhu.find((entry) => entry.modelId === system.recommendedEquipmentId)
        expect(model, `stage ${preset.stage}:${system.id}:catalog`).toBeDefined()
        expect(
          model!.airflowRate,
          `${preset.stage}:${system.id}:airflow margin`,
        ).toBeGreaterThanOrEqual(system.aggregatedLoad!.totalAirflow * system.selectionMargin)
        expect(
          model!.coolingCapacity,
          `${preset.stage}:${system.id}:cooling margin`,
        ).toBeGreaterThanOrEqual(
          (system.aggregatedLoad!.totalCoolingLoad / 1000) * system.selectionMargin,
        )
      }
    }
  })

  it('Stage 2-4 の全 terminal はカタログ整合し、最大風量を超えない', () => {
    for (const preset of HVAC_PRESETS.filter((item) => item.stage >= 2)) {
      const nodes = preset.data.nodes as Record<string, AnyNode>

      for (const diffuser of Object.values(nodes)) {
        if (diffuser.type !== 'diffuser') continue

        const model = catalogDiffuser.find(
          (entry) =>
            entry.neckDiameter === diffuser.neckDiameter &&
            entry.subTypes.includes(diffuser.subType),
        )
        expect(model, `stage ${preset.stage}:${diffuser.id}:catalog`).toBeDefined()
        expect(diffuser.airflowRate, `${preset.stage}:${diffuser.id}:airflow`).toBeLessThanOrEqual(
          model!.maxAirflow,
        )
      }
    }
  })

  it('Stage 4 は既存 validation の警告を一切出さない', () => {
    const preset = HVAC_PRESETS.find((item) => item.stage === 4)
    expect(preset).toBeDefined()

    const warnings = runAllChecks(preset!.data.nodes as Record<string, AnyNode>)
    expect(warnings).toHaveLength(0)
  })

  it('Stage 4 のダクト寸法と配管サイズは標準ライブラリに乗っている', () => {
    const preset = HVAC_PRESETS.find((item) => item.stage === 4)
    expect(preset).toBeDefined()

    const nodes = preset!.data.nodes as Record<string, AnyNode>
    const standardDuctDims = new Set<number>([
      ...standardDuctSizes.rectangular.map((entry) => entry.width),
      ...standardDuctSizes.rectangular.map((entry) => entry.height),
    ])

    for (const node of Object.values(nodes)) {
      if (node.type === 'duct_segment') {
        expect(standardDuctDims.has(node.width!), `${node.id}:width`).toBe(true)
        expect(standardDuctDims.has(node.height!), `${node.id}:height`).toBe(true)
      }

      if (node.type === 'pipe_segment') {
        const match = standardPipeSizes.find(
          (entry) =>
            entry.nominalSize === node.nominalSize && entry.outerDiameter === node.outerDiameter,
        )
        expect(match, `${node.id}:pipe size`).toBeDefined()
      }
    }
  })
})
