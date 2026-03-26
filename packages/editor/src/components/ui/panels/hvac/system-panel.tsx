'use client'

import type { AhuNode, SystemNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'

interface SystemPanelProps {
  nodeId: string
}

interface SceneState {
  nodes: Record<string, { type: string } & Partial<SystemNode> & Partial<AhuNode>>
  updateNode: (id: string, data: Partial<SystemNode>) => void
}

function isSystemNode(
  node: { type: string } & Partial<SystemNode>,
): node is SystemNode {
  return node.type === 'system'
}

export function SystemPanel({ nodeId }: SystemPanelProps) {
  const { nodes, updateNode } = useScene((s: SceneState) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  }))

  const node = nodes[nodeId]
  if (!node || !isSystemNode(node)) return null

  const ahuNode = node.ahuId ? nodes[node.ahuId] : null
  const isAhu = ahuNode && ahuNode.type === 'ahu'

  return (
    <div>
      <h3>系統プロパティ</h3>

      <label>
        系統名
        <input
          onChange={(e) => updateNode(nodeId, { systemName: e.target.value })}
          type="text"
          value={node.systemName}
        />
      </label>

      <div>
        <h4>所属ゾーン</h4>
        <ul>
          {node.servedZoneIds.map((zoneId) => (
            <li key={zoneId}>{zoneId}</li>
          ))}
        </ul>
      </div>

      {node.aggregatedLoad && (
        <div>
          <h4>合算負荷</h4>
          <div>冷房: {node.aggregatedLoad.totalCoolingLoad.toFixed(1)}kW</div>
          <div>暖房: {node.aggregatedLoad.totalHeatingLoad.toFixed(1)}kW</div>
          <div>風量: {Math.round(node.aggregatedLoad.totalAirflow)}m3/h</div>
        </div>
      )}

      <div>
        <h4>ステータス</h4>
        <span>{node.status}</span>
      </div>

      {isAhu && (
        <div>
          <h4>AHU情報</h4>
          <div>{(ahuNode as AhuNode).equipmentName}</div>
        </div>
      )}
    </div>
  )
}
