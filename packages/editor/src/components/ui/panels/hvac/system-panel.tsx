'use client'

import type { AnyNode, AhuNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import {
  HvacField,
  HvacInput,
  HvacPanelBody,
  HvacPanelSection,
  HvacPanelShell,
  HvacStackField,
} from './hvac-panel-shell'

interface SystemPanelProps {
  nodeId: string
}

type SystemNode = Extract<AnyNode, { type: 'system' }>

function isSystemNode(
  node: { type: string } & Partial<SystemNode>,
): node is SystemNode {
  return node.type === 'system'
}

export function SystemPanel({ nodeId }: SystemPanelProps) {
  const { nodes, updateNode } = useScene((s) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  })) as {
    nodes: Record<string, AnyNode>
    updateNode: (id: string, data: Partial<SystemNode>) => void
  }

  const node = nodes[nodeId] as ({ type: string } & Partial<SystemNode>) | undefined
  if (!node || !isSystemNode(node)) return null

  const ahuNode = node.ahuId ? nodes[node.ahuId] : null
  const isAhu = ahuNode && ahuNode.type === 'ahu'

  return (
    <HvacPanelShell dataTestId="system-panel" title="系統プロパティ">
      <HvacPanelBody>
        <HvacPanelSection title="基本情報">
          <HvacStackField label="系統名">
            <HvacInput
              onChange={(e) => updateNode(nodeId, { systemName: e.target.value })}
              type="text"
              value={node.systemName}
            />
          </HvacStackField>
          <HvacField label="ステータス" value={node.status} />
          <HvacField label="対象ゾーン数" value={node.servedZoneIds.length.toString()} />
        </HvacPanelSection>

        <HvacPanelSection title="所属ゾーン">
          <div className="flex flex-wrap gap-2">
            {node.servedZoneIds.map((zoneId) => (
              <span
                className="rounded-full border border-border/40 bg-background/20 px-2 py-1 text-xs text-foreground"
                key={zoneId}
              >
                {zoneId}
              </span>
            ))}
          </div>
        </HvacPanelSection>

        {node.aggregatedLoad && (
          <HvacPanelSection title="合算負荷">
            <HvacField label="冷房" value={`${node.aggregatedLoad.totalCoolingLoad.toFixed(1)}kW`} />
            <HvacField label="暖房" value={`${node.aggregatedLoad.totalHeatingLoad.toFixed(1)}kW`} />
            <HvacField label="風量" value={`${Math.round(node.aggregatedLoad.totalAirflow)}m3/h`} />
          </HvacPanelSection>
        )}

        {isAhu && (
          <HvacPanelSection title="AHU情報">
            <HvacField label="機種名" value={(ahuNode as AhuNode).equipmentName} />
          </HvacPanelSection>
        )}
      </HvacPanelBody>
    </HvacPanelShell>
  )
}
