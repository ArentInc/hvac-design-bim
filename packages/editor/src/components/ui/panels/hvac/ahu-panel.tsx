'use client'

import type { AhuNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import {
  HvacField,
  HvacInput,
  HvacPanelBody,
  HvacPanelSection,
  HvacPanelShell,
  HvacStackField,
} from './hvac-panel-shell'

interface AhuPanelProps {
  nodeId: string
}

function isAhuNode(
  node: { type: string } & Partial<AhuNode>,
): node is AhuNode {
  return node.type === 'ahu'
}

export function AhuPanel({ nodeId }: AhuPanelProps) {
  const { nodes, updateNode } = useScene((s) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  })) as {
    nodes: Record<string, { type: string } & Partial<AhuNode>>
    updateNode: (id: string, data: Partial<AhuNode>) => void
  }

  const node = nodes[nodeId]
  if (!node || !isAhuNode(node)) return null

  return (
    <HvacPanelShell dataTestId="ahu-panel" title="AHUプロパティ">
      <HvacPanelBody>
        <HvacPanelSection title="基本情報">
          <HvacStackField label="タグ">
            <HvacInput
              onChange={(e) => updateNode(nodeId, { tag: e.target.value })}
              type="text"
              value={node.tag}
            />
          </HvacStackField>
          <HvacField label="機種名" value={node.equipmentName} />
        </HvacPanelSection>

        <HvacPanelSection title="定格値">
          <HvacField label="冷房" value={`${node.coolingCapacity.toFixed(1)}kW`} />
          <HvacField label="暖房" value={`${node.heatingCapacity.toFixed(1)}kW`} />
          <HvacField label="風量" value={`${Math.round(node.airflowRate)}m3/h`} />
          <HvacField label="静圧" value={`${Math.round(node.staticPressure)}Pa`} />
        </HvacPanelSection>

        <HvacPanelSection title="ポート一覧">
          <div className="flex flex-col gap-2">
            {node.ports.map((port) => (
              <div
                className="rounded-md border border-border/40 bg-background/20 px-3 py-2"
                key={port.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground text-sm">{port.label}</span>
                  <span className="text-muted-foreground text-xs">{port.medium}</span>
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  {port.connectedSegmentId ?? '未接続'}
                </div>
              </div>
            ))}
          </div>
        </HvacPanelSection>
      </HvacPanelBody>
    </HvacPanelShell>
  )
}
