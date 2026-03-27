'use client'

/**
 * 【機能概要】: SystemTreePanel — 系統ツリー表示パネル
 * 【設計方針】:
 *   - 系統（SystemNode）→ ゾーン（HvacZoneNode）→ AHU の階層ツリーを表示する
 *   - ツリーアイテムのクリックで useViewer.setSelection を呼び、ビューア選択と連動する
 *   - ビューア選択（selectedIds）に基づいてアクティブアイテムをハイライト表示する
 * 【参照】: TASK-0027, REQ-1404
 * 🔵 信頼性レベル: TASK-0027 要件定義（REQ-1404）に明示
 */

import type { AnyNode, AhuNode, HvacZoneNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

type SystemNode = Extract<AnyNode, { type: 'system' }>
type AnyNodeMap = Record<string, AnyNode>

function isSystemNode(node: { type: string }): node is SystemNode {
  return node.type === 'system'
}

function isHvacZoneNode(node: { type: string }): node is HvacZoneNode {
  return node.type === 'hvac_zone'
}

function isAhuNode(node: { type: string }): node is AhuNode {
  return node.type === 'ahu'
}

interface TreeItemProps {
  nodeId: string
  isSelected: boolean
  onClick: (nodeId: string) => void
  children: React.ReactNode
  indent?: number
}

function TreeItem({ nodeId, isSelected, onClick, children, indent = 0 }: TreeItemProps) {
  return (
    <div
      data-selected={isSelected ? 'true' : 'false'}
      data-testid={`tree-item-${nodeId}`}
      onClick={() => onClick(nodeId)}
      style={{
        cursor: 'pointer',
        fontWeight: isSelected ? 'bold' : 'normal',
        paddingLeft: `${indent * 1}rem`,
        padding: '2px 4px',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        borderRadius: '2px',
      }}
    >
      {children}
    </div>
  )
}

export function SystemTreePanel() {
  const nodes = useScene((state) => state.nodes) as AnyNodeMap
  const selectedIds = useViewer((state) => state.selection.selectedIds)

  const handleSelect = (nodeId: string) => {
    useViewer.getState().setSelection({ selectedIds: [nodeId] })
  }

  const systemNodes = Object.values(nodes).filter(isSystemNode)

  if (systemNodes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/40 bg-background/20 px-3 py-2 text-muted-foreground text-sm">
        系統が登録されていません
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="system-tree-panel">
      <h3 className="font-medium text-foreground text-sm">系統ツリー</h3>
      {systemNodes.map((system) => {
        const isSystemSelected = selectedIds.includes(system.id)

        const zones: HvacZoneNode[] = system.servedZoneIds
          .map((id: string) => nodes[id])
          .filter((n): n is HvacZoneNode => !!n && isHvacZoneNode(n))

        const ahuNode =
          system.ahuId && nodes[system.ahuId] && isAhuNode(nodes[system.ahuId] as { type: string })
            ? (nodes[system.ahuId] as unknown as AhuNode)
            : null

        return (
          <div className="rounded-lg border border-border/40 bg-background/20 p-2" key={system.id}>
            {/* 系統ルート */}
            <TreeItem isSelected={isSystemSelected} nodeId={system.id} onClick={handleSelect}>
              <span aria-hidden="true">📁 </span>
              <span>{system.systemName}</span>
            </TreeItem>

            {/* ゾーン一覧 */}
            {zones.map((zone) => {
              const isZoneSelected = selectedIds.includes(zone.id)
              return (
                <TreeItem
                  indent={1}
                  isSelected={isZoneSelected}
                  key={zone.id}
                  nodeId={zone.id}
                  onClick={handleSelect}
                >
                  <span aria-hidden="true">🏠 </span>
                  <span>{zone.zoneName}</span>
                  {zone.calcResult && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                      {`冷房: ${Math.round(zone.calcResult.coolingLoad)}kW, 風量: ${Math.round(zone.calcResult.requiredAirflow)}m3/h`}
                    </span>
                  )}
                </TreeItem>
              )
            })}

            {/* AHU */}
            {ahuNode && (
              <TreeItem
                indent={1}
                isSelected={selectedIds.includes(ahuNode.id)}
                nodeId={ahuNode.id}
                onClick={handleSelect}
              >
                <span aria-hidden="true">🔧 </span>
                <span>{ahuNode.equipmentName}</span>
                <span style={{ marginLeft: '4px', fontSize: '12px', color: '#6b7280' }}>
                  {`（${Math.round(ahuNode.coolingCapacity)}kW）`}
                </span>
              </TreeItem>
            )}
          </div>
        )
      })}
    </div>
  )
}
