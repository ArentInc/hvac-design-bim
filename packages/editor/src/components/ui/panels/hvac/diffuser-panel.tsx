'use client'

import type { DiffuserNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'

interface DiffuserPanelProps {
  nodeId: string
}

interface SceneState {
  nodes: Record<string, { type: string } & Partial<DiffuserNode>>
  updateNode: (id: string, data: Partial<DiffuserNode>) => void
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
  const { nodes, updateNode } = useScene((s: SceneState) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  }))

  const node = nodes[nodeId]
  if (!node || !isDiffuserNode(node)) return null

  return (
    <div>
      <h3>制気口プロパティ</h3>

      <label>
        タグ
        <input
          onChange={(e) => updateNode(nodeId, { tag: e.target.value })}
          type="text"
          value={node.tag}
        />
      </label>

      <div>
        <span>タイプ</span>
        <span>{SUB_TYPE_LABELS[node.subType]}</span>
      </div>

      <div>
        <span>ネック径</span>
        <span>{node.neckDiameter}mm</span>
      </div>

      <div>
        <span>風量</span>
        <span>{Math.round(node.airflowRate)}m3/h</span>
      </div>

      <div>
        <span>接続先ダクト</span>
        <span>{node.hostDuctId ?? '未接続'}</span>
      </div>
    </div>
  )
}
