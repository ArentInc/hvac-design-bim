'use client'

// 【機能概要】: HvacZoneノードのプロパティ表示・編集パネル
// 【改善内容】: as unknown キャストをtype guardで置き換え、useScene呼び出しを1回に集約
// 【設計方針】: useViewer(selectedIds) + useScene(nodes, updateNode)の責務分離を維持
// 🔵 信頼性レベル: requirements.md 2.1、REQ-203/204/205、architecture.md「HVAC右パネル」に明示

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

import type { HvacZoneNode } from '@pascal-app/core'
import {
  getViewerSelectedIds,
  HvacEmptyState,
  HvacField,
  HvacInput,
  HvacPanelBody,
  HvacPanelSection,
  HvacPanelShell,
  HvacSelect,
  HvacStackField,
} from './hvac-panel-shell'

// 【定数定義】: ZoneUsageの日本語ラベルマッピング
// 【設計方針】: hvac-shared.tsのZoneUsage enum定義と1対1対応させることで保守性を確保
// 🔵 信頼性レベル: hvac-shared.tsのZoneUsage enum定義（5種類）に基づく
const USAGE_LABELS: Record<HvacZoneNode['usage'], string> = {
  office_general: '一般オフィス',
  office_server: 'サーバー室',
  conference: '会議室',
  reception: '受付/ロビー',
  corridor: '廊下',
}

/**
 * 【ヘルパー関数】: ノードがHvacZoneNodeであることを検証するtype guard
 * 【改善内容】: Greenフェーズの `as unknown as HvacZoneNode` キャストを型安全なguardに置き換え
 * 【単一責任】: 型チェックのみを担当し、副作用を持たない純粋関数
 * 🔵 信頼性レベル: hvac-zone.tsのtype定義（type: 'hvac_zone'）に基づく
 * @param node - チェック対象のノードオブジェクト
 * @returns nodeがHvacZoneNodeであればtrue
 */
function isHvacZoneNode(
  node: { type: string } & Partial<HvacZoneNode>,
): node is HvacZoneNode {
  // 【型判定】: typeフィールドで判別（discriminated union パターン）
  return node.type === 'hvac_zone'
}

/**
 * 【機能概要】: ゾーン基本情報セクション（zoneName/usage/floorArea/ceilingHeight/occupantDensity）
 * 【改善内容】: USAGE_LABELS型をHvacZoneNode['usage']ベースに強化し型安全性を向上
 * 【設計方針】: 各フィールドをinput/selectで表示、変更時はonUpdate経由でupdateNodeを呼び出す
 * 【保守性】: サブコンポーネント分割により変更影響範囲を限定
 * 🔵 信頼性レベル: requirements.md 2.1、REQ-203に明示
 * @param node - 表示するHvacZoneNode
 * @param onUpdate - ノード更新コールバック（useScene.updateNodeにIDをバインド済み）
 */
function BasicInfoSection({
  node,
  onUpdate,
}: {
  node: HvacZoneNode
  onUpdate: (data: Partial<HvacZoneNode>) => void
}) {
  return (
    <HvacPanelSection title="基本情報">
      {/* 【ゾーン名入力】: REQ-203 zoneName フィールド（編集可、テキスト入力） */}
      <HvacStackField label="ゾーン名">
        <HvacInput
          onChange={(e) => onUpdate({ zoneName: e.target.value })}
          type="text"
          value={node.zoneName}
        />
      </HvacStackField>

      {/* 【用途選択】: REQ-203 usage フィールド（5種類のselect、USAGE_LABELSで日本語化） */}
      <HvacStackField label="用途">
        <HvacSelect
          onChange={(e) => onUpdate({ usage: e.target.value as HvacZoneNode['usage'] })}
          value={node.usage}
        >
          {(Object.entries(USAGE_LABELS) as [HvacZoneNode['usage'], string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </HvacSelect>
      </HvacStackField>

      {/* 【床面積表示】: REQ-203 floorArea（読み取り専用、境界ポリゴンから自動算出、小数点1桁） */}
      <HvacField label="床面積 (m²)" value={node.floorArea.toFixed(1)} />

      {/* 【天井高入力】: REQ-203 ceilingHeight フィールド（編集可、デフォルト2.7m） */}
      <HvacStackField label="天井高 (m)">
        <HvacInput
          onChange={(e) => onUpdate({ ceilingHeight: Number(e.target.value) })}
          step={0.1}
          type="number"
          value={node.ceilingHeight}
        />
      </HvacStackField>

      {/* 【在室密度入力】: REQ-203 occupantDensity フィールド（編集可、step=0.01、デフォルト0.15人/m²） */}
      <HvacStackField label="在室密度 (人/m²)">
        <HvacInput
          onChange={(e) => onUpdate({ occupantDensity: Number(e.target.value) })}
          step={0.01}
          type="number"
          value={node.occupantDensity}
        />
      </HvacStackField>
    </HvacPanelSection>
  )
}

/**
 * 【機能概要】: 設計条件セクション（coolingSetpoint/heatingSetpoint/supplyAirTempDiff）
 * 【改善内容】: updateDesignConditionsヘルパーの型をHvacZoneNode['designConditions']に強化
 * 【設計方針】: designConditionsのスプレッドによる既存値保持パターン（部分更新）
 * 【保守性】: REQ-204の3フィールドをまとめて管理し、追加時の変更箇所を1か所に集約
 * 🔵 信頼性レベル: requirements.md 2.1、REQ-204に明示
 * @param node - 表示するHvacZoneNode
 * @param onUpdate - ノード更新コールバック
 */
function DesignConditionsSection({
  node,
  onUpdate,
}: {
  node: HvacZoneNode
  onUpdate: (data: Partial<HvacZoneNode>) => void
}) {
  /**
   * 【ヘルパー関数】: designConditionsの部分更新を担当するローカルヘルパー
   * 【再利用性】: 既存値を保持しながら特定フィールドのみを更新するパターン
   * 【安全性】: スプレッド演算子でrelativeHumidityなど他フィールドを誤って消さない
   */
  const updateDesignConditions = (
    partial: Partial<HvacZoneNode['designConditions']>,
  ) => {
    onUpdate({
      designConditions: {
        ...node.designConditions,
        ...partial,
      },
    })
  }

  return (
    <HvacPanelSection title="設計条件">
      {/* 【冷房設定温度】: REQ-204 coolingSetpoint（編集可、デフォルト26°C） */}
      <HvacStackField label="冷房設定温度 (°C)">
        <HvacInput
          onChange={(e) => updateDesignConditions({ coolingSetpoint: Number(e.target.value) })}
          type="number"
          value={node.designConditions.coolingSetpoint}
        />
      </HvacStackField>

      {/* 【暖房設定温度】: REQ-204 heatingSetpoint（編集可、デフォルト22°C） */}
      <HvacStackField label="暖房設定温度 (°C)">
        <HvacInput
          onChange={(e) => updateDesignConditions({ heatingSetpoint: Number(e.target.value) })}
          type="number"
          value={node.designConditions.heatingSetpoint}
        />
      </HvacStackField>

      {/* 【送風温度差】: REQ-204/206 supplyAirTempDiff（編集可、デフォルト10K） */}
      <HvacStackField label="送風温度差 (K)">
        <HvacInput
          onChange={(e) => updateDesignConditions({ supplyAirTempDiff: Number(e.target.value) })}
          type="number"
          value={node.designConditions.supplyAirTempDiff}
        />
      </HvacStackField>
    </HvacPanelSection>
  )
}

/**
 * 【機能概要】: 外皮条件セクション（perimeterSegmentsのテーブル表示）
 * 【改善内容】: HvacZoneNode['perimeterSegments'][number]型を活用してローカル型定義を削除
 * 【設計方針】: 空配列時は誘導メッセージ、非空時は方位/壁面積/ガラス面積比のテーブル
 * 【保守性】: PerimeterEditToolとの責務分離を明示（編集はツール側、表示のみここで実施）
 * 🔵 信頼性レベル: requirements.md 2.1/2.2、REQ-205に明示
 * @param segments - perimeterSegments配列（HvacZoneNodeから取得）
 */
function PerimeterSection({
  segments,
}: {
  segments: HvacZoneNode['perimeterSegments']
}) {
  // 【早期リターン】: perimeterSegmentsが空配列の場合は誘導メッセージを表示（エッジ3対応）
  if (segments.length === 0) {
    return (
      <HvacPanelSection title="外皮条件">
        {/* 【誘導メッセージ】: PerimeterEditToolでの入力を促すメッセージ（REQ-205）*/}
        <HvacEmptyState>未設定（PerimeterEditToolで入力してください）</HvacEmptyState>
      </HvacPanelSection>
    )
  }

  return (
    <HvacPanelSection title="外皮条件">
      {/* 【テーブル表示】: 方位/壁面積/ガラス面積比のテーブル（requirements.md 2.2「外皮条件一覧」） */}
      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md">
        <thead>
          <tr className="bg-background/40 text-left text-muted-foreground text-xs">
            <th className="px-3 py-2 font-medium">方位</th>
            <th className="px-3 py-2 font-medium">壁面積 (m²)</th>
            <th className="px-3 py-2 font-medium">ガラス面積比</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg, idx) => (
            // 【行表示】: 各セグメントを方位/壁面積/ガラス面積比%で表示
            // 【キー設計】: orientation+idxで一意性を保証（同方位が複数ある場合に対応）
            <tr className="border-t border-border/30 text-sm" key={`${seg.orientation}-${idx}`}>
              <td className="border-border/20 border-t px-3 py-2">{seg.orientation}</td>
              {/* 【壁面積】: requirements.md 3.4「wallArea: m²（小数点1桁）」 */}
              <td className="border-border/20 border-t px-3 py-2">{seg.wallArea.toFixed(1)}</td>
              {/* 【glazingRatio変換】: 0.0〜1.0 → %表示（x100, 整数、requirements.md 3.4） */}
              <td className="border-border/20 border-t px-3 py-2">
                {Math.round(seg.glazingRatio * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </HvacPanelSection>
  )
}

/**
 * 【機能概要】: HvacZoneノードのプロパティパネル（メインコンポーネント）
 * 【改善内容】:
 *   1. as unknown キャストを isHvacZoneNode type guard に置き換えて型安全性を向上
 *   2. useScene呼び出しを1回に集約してストアサブスクリプション数を削減
 * 【設計方針】:
 *   - useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
 *   - useSceneからnodes + updateNodeを1回のセレクターで取得
 *   - 選択なし/非HvacZoneノードの場合はnullを返す（早期リターン）
 * 【パフォーマンス】: useScene1回呼び出しでストアサブスクリプション数を最小化
 * 【保守性】: サブコンポーネントへの委譲で各セクションの変更影響を局所化
 * 🔵 信頼性レベル: requirements.md 2.1、architecture.md「HVAC右パネル」に明示
 */
export function HvacZonePanel() {
  // 【selectedIds取得】: useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
  const selectedIds = useViewer(getViewerSelectedIds)

  // 【ストア状態取得】: useSceneを1回呼び出しでnodes + updateNodeを同時取得
  // 【パフォーマンス改善】: Greenフェーズの2回呼び出しを1回に削減
  const { nodes, updateNode } = useScene((s) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  })) as {
    nodes: Record<string, { type: string } & Partial<HvacZoneNode>>
    updateNode: (id: string, data: Partial<HvacZoneNode>) => void
  }

  // 【早期リターン】: 選択なし → null（エッジ4対応）
  if (selectedIds.length === 0) return null

  // 【ノード取得】: 最初の選択IDでノードを取得
  const zoneId = selectedIds[0]!
  const node = nodes[zoneId]

  // 【型ガード適用】: isHvacZoneNode で安全な型チェック（非HvacZoneノード選択時はnull: エッジ1対応）
  if (!node || !isHvacZoneNode(node)) return null

  // 【updateNodeラッパー】: IDをバインドしたupdateNode呼び出し（コールバック参照の安定化）
  const handleUpdate = (data: Partial<HvacZoneNode>) => {
    updateNode(zoneId, data)
  }

  return (
    <HvacPanelShell dataTestId="hvac-zone-panel" title="ゾーンプロパティ">
      <HvacPanelBody>
        {/* 【基本情報セクション】: REQ-203 zoneName/usage/floorArea/ceilingHeight/occupantDensity */}
        <BasicInfoSection node={node} onUpdate={handleUpdate} />
        {/* 【設計条件セクション】: REQ-204 coolingSetpoint/heatingSetpoint/supplyAirTempDiff */}
        <DesignConditionsSection node={node} onUpdate={handleUpdate} />
        {/* 【外皮条件セクション】: REQ-205 perimeterSegmentsテーブルまたは誘導メッセージ */}
        <PerimeterSection segments={node.perimeterSegments} />
      </HvacPanelBody>
    </HvacPanelShell>
  )
}
