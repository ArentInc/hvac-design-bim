'use client'

// 【機能概要】: HvacZoneノードのプロパティ表示・編集パネル
// 【実装方針】: useViewer(selectedIds) + useScene(nodes, updateNode)を使用してゾーン情報を表示
// 【テスト対応】: hvac-zone-panel.test.tsx 全11テスト
// 🔵 信頼性レベル: requirements.md 2.1、REQ-203/204/205に明示

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

import type { HvacZoneNode } from '@pascal-app/core'

// 【定数定義】: ZoneUsageの日本語ラベルマッピング
// 🔵 信頼性レベル: hvac-shared.tsのZoneUsage enum定義に基づく
const USAGE_LABELS: Record<string, string> = {
  office_general: '一般オフィス',
  office_server: 'サーバー室',
  conference: '会議室',
  reception: '受付/ロビー',
  corridor: '廊下',
}

// 【型定義】: DesignConditionsの型
interface DesignConditions {
  coolingSetpoint: number
  heatingSetpoint: number
  relativeHumidity: number
  supplyAirTempDiff: number
}

// 【型定義】: PerimeterSegmentの型
interface PerimeterSegment {
  orientation: string
  wallArea: number
  glazingRatio: number
}

/**
 * 【機能概要】: ゾーン基本情報セクション（zoneName/usage/floorArea/ceilingHeight/occupantDensity）
 * 【実装方針】: 各フィールドをinput/selectで表示、変更時はupdateNodeを呼び出す
 * 【テスト対応】: テスト1〜4, テスト11に対応
 * 🔵 信頼性レベル: requirements.md 2.1、REQ-203に明示
 */
function BasicInfoSection({
  node,
  onUpdate,
}: {
  node: HvacZoneNode
  onUpdate: (data: Partial<HvacZoneNode>) => void
}) {
  return (
    <div>
      <h3>基本情報</h3>

      {/* 【ゾーン名入力】: REQ-203 zoneName フィールド（編集可） */}
      <label>
        ゾーン名
        <input
          onChange={(e) => onUpdate({ zoneName: e.target.value })}
          type="text"
          value={node.zoneName}
        />
      </label>

      {/* 【用途選択】: REQ-203 usage フィールド（5種類のselect） */}
      <label>
        用途
        <select
          onChange={(e) => onUpdate({ usage: e.target.value as HvacZoneNode['usage'] })}
          value={node.usage}
        >
          {Object.entries(USAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {/* 【床面積表示】: REQ-203 floorArea フィールド（読み取り専用、小数点1桁） */}
      <div>
        <span>床面積 (m²)</span>
        <span>{node.floorArea.toFixed(1)}</span>
      </div>

      {/* 【天井高入力】: REQ-203 ceilingHeight フィールド（編集可） */}
      <label>
        天井高 (m)
        <input
          onChange={(e) => onUpdate({ ceilingHeight: Number(e.target.value) })}
          step={0.1}
          type="number"
          value={node.ceilingHeight}
        />
      </label>

      {/* 【在室密度入力】: REQ-203 occupantDensity フィールド（編集可、step=0.01） */}
      <label>
        在室密度 (人/m²)
        <input
          onChange={(e) => onUpdate({ occupantDensity: Number(e.target.value) })}
          step={0.01}
          type="number"
          value={node.occupantDensity}
        />
      </label>
    </div>
  )
}

/**
 * 【機能概要】: 設計条件セクション（coolingSetpoint/heatingSetpoint/supplyAirTempDiff）
 * 【実装方針】: designConditionsを既存値を保持しながら部分更新する
 * 【テスト対応】: テスト5, テスト6に対応
 * 🔵 信頼性レベル: requirements.md 2.1、REQ-204に明示
 */
function DesignConditionsSection({
  node,
  onUpdate,
}: {
  node: HvacZoneNode
  onUpdate: (data: Partial<HvacZoneNode>) => void
}) {
  // 【設計条件更新ヘルパー】: 既存のdesignConditionsを保持しつつ部分更新する
  const updateDesignConditions = (partial: Partial<DesignConditions>) => {
    onUpdate({
      designConditions: {
        ...node.designConditions,
        ...partial,
      },
    })
  }

  return (
    <div>
      <h3>設計条件</h3>

      {/* 【冷房設定温度】: REQ-204 coolingSetpoint（編集可） */}
      <label>
        冷房設定温度 (°C)
        <input
          onChange={(e) => updateDesignConditions({ coolingSetpoint: Number(e.target.value) })}
          type="number"
          value={node.designConditions.coolingSetpoint}
        />
      </label>

      {/* 【暖房設定温度】: REQ-204 heatingSetpoint（編集可） */}
      <label>
        暖房設定温度 (°C)
        <input
          onChange={(e) => updateDesignConditions({ heatingSetpoint: Number(e.target.value) })}
          type="number"
          value={node.designConditions.heatingSetpoint}
        />
      </label>

      {/* 【送風温度差】: REQ-204 supplyAirTempDiff（デフォルト10K） */}
      <label>
        送風温度差 (K)
        <input
          onChange={(e) => updateDesignConditions({ supplyAirTempDiff: Number(e.target.value) })}
          type="number"
          value={node.designConditions.supplyAirTempDiff}
        />
      </label>
    </div>
  )
}

/**
 * 【機能概要】: 外皮条件セクション（perimeterSegmentsのテーブル表示）
 * 【実装方針】: 空配列時は誘導メッセージ、非空時はテーブル表示
 * 【テスト対応】: テスト7, テスト8に対応
 * 🔵 信頼性レベル: requirements.md 2.1、REQ-205に明示
 */
function PerimeterSection({ segments }: { segments: PerimeterSegment[] }) {
  // 【空配列チェック】: perimeterSegmentsが未設定の場合は誘導メッセージを表示
  if (segments.length === 0) {
    return (
      <div>
        <h3>外皮条件</h3>
        <p>未設定（PerimeterEditToolで入力してください）</p>
      </div>
    )
  }

  return (
    <div>
      <h3>外皮条件</h3>
      {/* 【テーブル表示】: 方位/壁面積/ガラス面積比のテーブル（requirements.md 2.2「外皮条件一覧」） */}
      <table>
        <thead>
          <tr>
            <th>方位</th>
            <th>壁面積 (m²)</th>
            <th>ガラス面積比</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg, idx) => (
            // 【行表示】: 各セグメントを方位/壁面積/ガラス面積比%で表示
            <tr key={`${seg.orientation}-${idx}`}>
              <td>{seg.orientation}</td>
              <td>{seg.wallArea.toFixed(1)}</td>
              {/* 【glazingRatio変換】: 0.0〜1.0 → %表示（x100, 整数） */}
              <td>{Math.round(seg.glazingRatio * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 【機能概要】: HvacZoneノードのプロパティパネル（メインコンポーネント）
 * 【実装方針】:
 *   1. useViewerからselectedIdsを取得
 *   2. useSceneからnodesとupdateNodeを取得
 *   3. 選択なし/非HvacZoneノードの場合はnullを返す
 *   4. HvacZoneノードの場合は基本情報・設計条件・外皮条件を表示
 * 【テスト対応】: hvac-zone-panel.test.tsx 全11テスト
 * 🔵 信頼性レベル: requirements.md 2.1、architecture.md「HVAC右パネル」に明示
 */
export function HvacZonePanel() {
  // 【selectedIds取得】: useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
  const selectedIds = useViewer((s: { selectedIds: string[] }) => s.selectedIds)

  // 【ノードデータ取得】: useSceneからnodes全体とupdateNodeを取得
  const nodes = useScene((s: { nodes: Record<string, { type: string }> }) => s.nodes)
  const updateNode = useScene(
    (s: { updateNode: (id: string, data: unknown) => void }) => s.updateNode,
  )

  // 【早期リターン】: 選択なし → null（エッジ4対応）
  if (selectedIds.length === 0) return null

  // 【ノード取得】: 最初の選択IDでノードを取得
  const zoneId = selectedIds[0]
  const node = nodes[zoneId]

  // 【型チェック】: 非HvacZoneノード選択時はnull（エッジ1対応）
  if (!node || node.type !== 'hvac_zone') return null

  // 【型アサーション】: type guard後にHvacZoneNodeとして扱う
  const hvacZoneNode = node as unknown as HvacZoneNode

  // 【updateNodeラッパー】: IDをバインドしたupdateNode呼び出し
  const handleUpdate = (data: Partial<HvacZoneNode>) => {
    updateNode(zoneId, data)
  }

  return (
    <div>
      <h2>ゾーンプロパティ</h2>
      {/* 【基本情報セクション】: zoneName/usage/floorArea/ceilingHeight/occupantDensity */}
      <BasicInfoSection node={hvacZoneNode} onUpdate={handleUpdate} />
      {/* 【設計条件セクション】: coolingSetpoint/heatingSetpoint/supplyAirTempDiff */}
      <DesignConditionsSection node={hvacZoneNode} onUpdate={handleUpdate} />
      {/* 【外皮条件セクション】: perimeterSegmentsテーブルまたは誘導メッセージ */}
      <PerimeterSection segments={hvacZoneNode.perimeterSegments} />
    </div>
  )
}
