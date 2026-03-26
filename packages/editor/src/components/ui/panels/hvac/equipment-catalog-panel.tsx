'use client'

/**
 * 【機能概要】: EquipmentCatalogPanel — 機器カタログ表示パネル
 * 【設計方針】:
 *   - AHU / 制気口のカタログ一覧を表示する
 *   - 各機器の選定状態（推奨/選定済み/未選定）をシーンノードから算出してバッジ表示する
 *     - 選定済み: AhuNode.tag === entry.modelId のノードがシーンに存在
 *     - 推奨: SystemNode.recommendedEquipmentId === entry.modelId
 *     - 未選定: 上記のいずれでもない
 * 【参照】: TASK-0027, REQ-1404
 * 🔵 信頼性レベル: TASK-0027 要件定義（REQ-1404）に明示
 */

import type { AhuNode, DiffuserNode, SystemNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'

// --- Catalog data (AHU) ---

type AhuCatalogEntry = {
  modelId: string
  modelName: string
  airflowRate: number
  coolingCapacity: number
  heatingCapacity: number
  staticPressure: number
  dimensions: { width: number; height: number; depth: number }
}

const AHU_CATALOG: AhuCatalogEntry[] = [
  {
    modelId: 'AHU-S-2000',
    modelName: '小型AHU 2000',
    airflowRate: 2000,
    coolingCapacity: 12.0,
    heatingCapacity: 8.0,
    staticPressure: 300,
    dimensions: { width: 1.2, height: 1.0, depth: 0.8 },
  },
  {
    modelId: 'AHU-S-5000',
    modelName: '中小型AHU 5000',
    airflowRate: 5000,
    coolingCapacity: 30.0,
    heatingCapacity: 20.0,
    staticPressure: 350,
    dimensions: { width: 1.8, height: 1.4, depth: 1.2 },
  },
  {
    modelId: 'AHU-M-10000',
    modelName: '中型AHU 10000',
    airflowRate: 10000,
    coolingCapacity: 60.0,
    heatingCapacity: 40.0,
    staticPressure: 400,
    dimensions: { width: 2.4, height: 1.8, depth: 1.6 },
  },
  {
    modelId: 'AHU-L-20000',
    modelName: '大型AHU 20000',
    airflowRate: 20000,
    coolingCapacity: 120.0,
    heatingCapacity: 80.0,
    staticPressure: 450,
    dimensions: { width: 3.6, height: 2.2, depth: 2.0 },
  },
  {
    modelId: 'AHU-XL-30000',
    modelName: '特大型AHU 30000',
    airflowRate: 30000,
    coolingCapacity: 180.0,
    heatingCapacity: 120.0,
    staticPressure: 500,
    dimensions: { width: 4.8, height: 2.6, depth: 2.4 },
  },
]

// --- Catalog data (Diffuser) ---

type DiffuserCatalogEntry = {
  modelId: string
  neckDiameter: number
  ratedAirflow: number
  maxAirflow: number
}

const DIFFUSER_CATALOG: DiffuserCatalogEntry[] = [
  { modelId: 'DIFF-250', neckDiameter: 250, ratedAirflow: 300, maxAirflow: 450 },
  { modelId: 'DIFF-300', neckDiameter: 300, ratedAirflow: 450, maxAirflow: 650 },
  { modelId: 'DIFF-350', neckDiameter: 350, ratedAirflow: 600, maxAirflow: 900 },
  { modelId: 'DIFF-400', neckDiameter: 400, ratedAirflow: 800, maxAirflow: 1200 },
  { modelId: 'DIFF-500', neckDiameter: 500, ratedAirflow: 1200, maxAirflow: 1800 },
  { modelId: 'DIFF-600', neckDiameter: 600, ratedAirflow: 1800, maxAirflow: 2500 },
]

// --- Types ---

type SelectionStatus = '推奨' | '選定済み' | '未選定'

type AnyNodeMap = Record<string, { type: string } & Record<string, unknown>>

// --- Helpers ---

function isSystemNode(n: { type: string }): n is SystemNode {
  return n.type === 'system'
}

function isAhuNode(n: { type: string }): n is AhuNode {
  return n.type === 'ahu'
}

function isDiffuserNode(n: { type: string }): n is DiffuserNode {
  return n.type === 'diffuser'
}

function getAhuStatus(modelId: string, nodes: AnyNodeMap): SelectionStatus {
  const nodeList = Object.values(nodes)

  // 選定済み: シーンに tag === modelId の AhuNode が存在
  const isSelected = nodeList.some((n) => isAhuNode(n) && n.tag === modelId)
  if (isSelected) return '選定済み'

  // 推奨: SystemNode.recommendedEquipmentId === modelId
  const isRecommended = nodeList.some(
    (n) => isSystemNode(n) && n.recommendedEquipmentId === modelId,
  )
  if (isRecommended) return '推奨'

  return '未選定'
}

function getDiffuserStatus(modelId: string, nodes: AnyNodeMap): SelectionStatus {
  const nodeList = Object.values(nodes)

  // 選定済み: シーンに tag === modelId の DiffuserNode が存在
  const isSelected = nodeList.some((n) => isDiffuserNode(n) && n.tag === modelId)
  if (isSelected) return '選定済み'

  return '未選定'
}

// --- Status Badge ---

const STATUS_STYLES: Record<SelectionStatus, { color: string; background: string }> = {
  推奨: { color: '#1d4ed8', background: '#dbeafe' },
  選定済み: { color: '#166534', background: '#dcfce7' },
  未選定: { color: '#6b7280', background: '#f3f4f6' },
}

function StatusBadge({ status }: { status: SelectionStatus }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      style={{
        ...style,
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '9999px',
        fontWeight: '500',
      }}
    >
      {status}
    </span>
  )
}

// --- AHU Catalog List ---

function AhuCatalogList({ nodes }: { nodes: AnyNodeMap }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {AHU_CATALOG.map((entry) => {
        const status = getAhuStatus(entry.modelId, nodes)
        return (
          <li
            key={entry.modelId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 4px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: '13px',
            }}
          >
            <div>
              <div style={{ fontWeight: '500' }}>{entry.modelName}</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                冷房 {entry.coolingCapacity}kW / 風量 {entry.airflowRate}m3/h
              </div>
            </div>
            <StatusBadge status={status} />
          </li>
        )
      })}
    </ul>
  )
}

// --- Diffuser Catalog List ---

function DiffuserCatalogList({ nodes }: { nodes: AnyNodeMap }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {DIFFUSER_CATALOG.map((entry) => {
        const status = getDiffuserStatus(entry.modelId, nodes)
        return (
          <li
            key={entry.modelId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 4px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: '13px',
            }}
          >
            <div>
              <div style={{ fontWeight: '500' }}>Φ{entry.neckDiameter}mm</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                定格 {entry.ratedAirflow}m3/h / 最大 {entry.maxAirflow}m3/h
              </div>
            </div>
            <StatusBadge status={status} />
          </li>
        )
      })}
    </ul>
  )
}

// --- Main Component ---

export function EquipmentCatalogPanel() {
  const nodes = useScene((state) => state.nodes) as AnyNodeMap

  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>機器カタログ</h3>

      <section>
        <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
          AHU
        </h4>
        <AhuCatalogList nodes={nodes} />
      </section>

      <section style={{ marginTop: '12px' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
          制気口
        </h4>
        <DiffuserCatalogList nodes={nodes} />
      </section>
    </div>
  )
}
