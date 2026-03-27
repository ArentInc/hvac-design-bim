'use client'

import type { AnyNode, DiffuserNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import {
  HvacField,
  HvacInput,
  HvacPanelBody,
  HvacPanelSection,
  HvacPanelShell,
  HvacStackField,
} from './hvac-panel-shell'

interface DiffuserPanelProps {
  nodeId: string
}

function isDiffuserNode(
  node: { type: string } & Partial<DiffuserNode>,
): node is DiffuserNode {
  return node.type === 'diffuser'
}

const SUB_TYPE_LABELS: Record<DiffuserNode['subType'], string> = {
  anemostat: '給気',
  line: '線形',
  universal: '万能',
  nozzle: 'ノズル',
  return_grille: '還気',
}

export function DiffuserPanel({ nodeId }: DiffuserPanelProps) {
  const { nodes, updateNode } = useScene((s) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  })) as {
    nodes: Record<string, AnyNode>
    updateNode: (id: string, data: Partial<DiffuserNode>) => void
  }

  const node = nodes[nodeId] as ({ type: string } & Partial<DiffuserNode>) | undefined
  if (!node || !isDiffuserNode(node)) return null

  return (
    <HvacPanelShell dataTestId="diffuser-panel" title="制気口プロパティ">
      <HvacPanelBody>
        <HvacPanelSection title="基本情報">
          <HvacStackField label="タグ">
            <HvacInput
              onChange={(e) => updateNode(nodeId, { tag: e.target.value })}
              type="text"
              value={node.tag}
            />
          </HvacStackField>
          <HvacField label="タイプ" value={SUB_TYPE_LABELS[node.subType]} />
          <HvacField label="ネック径" value={`${node.neckDiameter}mm`} />
          <HvacField label="風量" value={`${Math.round(node.airflowRate)}m3/h`} />
        </HvacPanelSection>

        <HvacPanelSection title="接続情報">
          <HvacField label="接続先ダクト" value={node.hostDuctId ?? '未接続'} />
          <HvacField label="系統" value={node.systemId ?? '未割当'} />
          <HvacField label="ゾーン" value={node.zoneId ?? '未割当'} />
        </HvacPanelSection>
      </HvacPanelBody>
    </HvacPanelShell>
  )
}
