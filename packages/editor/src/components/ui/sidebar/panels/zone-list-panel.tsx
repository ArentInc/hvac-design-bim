'use client'

// 【機能概要】: HvacZoneノード一覧サイドバーパネル
// 【設計方針】: useScene(nodes) + useViewer(selection) で全HvacZoneを一覧表示する。
//              クリックで選択連動（setSelection）、Ctrl+クリックでマルチ選択。
// 🔵 信頼性レベル: requirements.md REQ-1404に明示

import { type HvacZoneNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { formatLoad } from '../../panels/hvac/format-load'

// 【定数定義】: ゾーン用途別カラーマッピング
// 【注意】: packages/viewer/src/components/renderers/hvac/hvac-zone-renderer.tsx の
//           ZONE_USAGE_COLORS と同一定義。将来的に packages/core へ移動を推奨。
// 🔵 信頼性レベル: REQ-1501カラー定義に基づく
export const ZONE_USAGE_COLORS: Record<string, string> = {
  office_general: '#42A5F5',
  conference: '#FFA726',
  reception: '#66BB6A',
  office_server: '#EF5350',
  corridor: '#BDBDBD',
}

// 【定数定義】: ゾーン用途日本語ラベルマッピング
// 🔵 信頼性レベル: hvac-shared.ts の ZoneUsage enum 定義に基づく
export const USAGE_LABELS: Record<string, string> = {
  office_general: '一般オフィス',
  conference: '会議室',
  reception: '受付/ロビー',
  office_server: 'サーバー室',
  corridor: '廊下',
}

/**
 * 【機能概要】: ゾーン用途を示すカラードット（円形アイコン）
 * 【設計方針】: ZONE_USAGE_COLORSのカラーを12px円で表示
 * 🟡 信頼性レベル: REQ-1501カラー定義に基づく推測
 * @param usage - HvacZoneNodeのusageフィールド
 */
export function UsageColorIcon({ usage }: { usage: string }) {
  const color = ZONE_USAGE_COLORS[usage] ?? '#9E9E9E'
  return (
    <span
      data-testid="usage-color-icon"
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        marginRight: 6,
      }}
    />
  )
}

interface ZoneListItemProps {
  zone: HvacZoneNode
  isSelected: boolean
  onSelect: (event: React.MouseEvent) => void
}

/**
 * 【機能概要】: ゾーン一覧の個別アイテム行
 * 【設計方針】: 用途アイコン + ゾーン名 + 用途ラベル + 面積 + 負荷サマリー（calcResultある場合のみ）
 * 🔵 信頼性レベル: REQ-1404に明示
 */
export function ZoneListItem({ zone, isSelected, onSelect }: ZoneListItemProps) {
  const usageLabel = USAGE_LABELS[zone.usage] ?? zone.usage

  return (
    <li
      data-testid={`zone-list-item-${zone.id}`}
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        listStyle: 'none',
        padding: '6px 8px',
        borderRadius: 6,
        backgroundColor: isSelected ? 'rgba(66, 165, 245, 0.15)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* ヘッダー行: カラーアイコン + ゾーン名 */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <UsageColorIcon usage={zone.usage} />
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: isSelected ? 600 : 400,
          }}
        >
          {zone.zoneName || '名称未設定'}
        </span>
      </div>
      {/* 詳細行: 用途ラベル + 面積 */}
      <div style={{ display: 'flex', gap: 8, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
        <span>{usageLabel}</span>
        <span>{zone.floorArea.toFixed(1)} m²</span>
      </div>
      {/* 負荷サマリー（calcResult設定済みの場合のみ表示） */}
      {zone.calcResult && (
        <div
          data-testid="load-summary"
          style={{ display: 'flex', gap: 8, fontSize: 11, opacity: 0.8, marginTop: 2 }}
        >
          <span>冷房: {formatLoad(zone.calcResult.coolingLoad)}</span>
          <span>風量: {zone.calcResult.requiredAirflow.toLocaleString()} m³/h</span>
        </div>
      )}
    </li>
  )
}

/**
 * 【機能概要】: HvacZoneノード一覧サイドバーパネル（メインコンポーネント）
 * 【設計方針】:
 *   - useScene(nodes) から hvac_zone タイプのノードを抽出（useMemoで最適化）
 *   - useViewer(selection.selectedIds) で選択状態を反映
 *   - クリック: 単一選択 / Ctrl+クリック: マルチ選択（トグル）
 * 【アーキテクチャ制約】: packages/editor に配置。Viewer隔離ルールを遵守
 * 🔵 信頼性レベル: REQ-1404に明示
 */
export function ZoneListPanel() {
  const nodes = useScene((s) => s.nodes)
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const setSelection = useViewer((s) => s.setSelection)

  // 【パフォーマンス】: useMemoでObject.values走査をキャッシュ（大量ノード対策）
  const zones = useMemo(() => {
    return Object.values(nodes).filter(
      (node): node is HvacZoneNode => node.type === 'hvac_zone',
    )
  }, [nodes])

  const handleSelect = (zoneId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // 【マルチ選択】: Ctrl/Cmd + クリックでトグル
      const newIds = selectedIds.includes(zoneId)
        ? selectedIds.filter((id) => id !== zoneId)
        : [...selectedIds, zoneId]
      setSelection({ selectedIds: newIds })
    } else {
      // 【単一選択】: 通常クリックで単一選択（他の選択解除）
      setSelection({ selectedIds: [zoneId] })
    }
  }

  return (
    <div data-testid="zone-list-panel" style={{ padding: '4px 0' }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, padding: '4px 8px', opacity: 0.6, margin: 0 }}>
        ゾーン一覧
      </h3>
      {zones.length === 0 ? (
        <p
          data-testid="empty-message"
          style={{ padding: '8px', fontSize: 12, opacity: 0.5, margin: 0 }}
        >
          ゾーンがありません
        </p>
      ) : (
        <ul style={{ padding: 0, margin: 0 }}>
          {zones.map((zone) => (
            <ZoneListItem
              isSelected={selectedIds.includes(zone.id)}
              key={zone.id}
              onSelect={(e) => handleSelect(zone.id, e)}
              zone={zone}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
