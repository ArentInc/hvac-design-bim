'use client'

import type { AhuNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'

interface AhuPanelProps {
  nodeId: string
}

interface SceneState {
  nodes: Record<string, { type: string } & Partial<AhuNode>>
  updateNode: (id: string, data: Partial<AhuNode>) => void
}

function isAhuNode(
  node: { type: string } & Partial<AhuNode>,
): node is AhuNode {
  return node.type === 'ahu'
}

export function AhuPanel({ nodeId }: AhuPanelProps) {
  const { nodes, updateNode } = useScene((s: SceneState) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  }))

  const node = nodes[nodeId]
  if (!node || !isAhuNode(node)) return null

  return (
    <div>
      <h3>AHUプロパティ</h3>

      <label>
        タグ
        <input
          onChange={(e) => updateNode(nodeId, { tag: e.target.value })}
          type="text"
          value={node.tag}
        />
      </label>

      <div>
        <span>機種名</span>
        <span>{node.equipmentName}</span>
      </div>

      <div>
        <h4>定格値</h4>
        <div>冷房: {node.coolingCapacity.toFixed(1)}kW</div>
        <div>暖房: {node.heatingCapacity.toFixed(1)}kW</div>
        <div>風量: {Math.round(node.airflowRate)}m3/h</div>
      </div>

      <div>
        <h4>ポート一覧</h4>
        <ul>
          {node.ports.map((port) => (
            <li key={port.id}>
              <span>{port.label}</span>
              <span>{port.medium}</span>
              <span>{port.connectedSegmentId ?? '未接続'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
