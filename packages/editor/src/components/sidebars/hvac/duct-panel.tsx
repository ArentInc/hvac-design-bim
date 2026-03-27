'use client'

// TASK-0037: DuctPanel — ダクトプロパティパネル
// 【機能概要】: DuctSegmentノードのプロパティ表示・編集パネル
// 【設計方針】: useViewer(selectedIds) + useScene(nodes, updateNode)の責務分離を維持
// 🔵 信頼性レベル: REQ-1403（ダクトプロパティパネル）に明示

import type { DuctSegmentNode } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import {
  getViewerSelectedIds,
  HvacField,
  HvacInput,
  HvacPanelBody,
  HvacPanelSection,
  HvacPanelShell,
  HvacSelect,
} from '../../ui/panels/hvac/hvac-panel-shell'

// 【定数定義】: DuctMaterialの日本語ラベルマッピング
const MATERIAL_LABELS: Record<DuctSegmentNode['ductMaterial'], string> = {
  galvanized_steel: '亜鉛鉄板',
  stainless_steel: 'ステンレス',
  aluminum: 'アルミ',
  flexible: 'フレキシブル',
}

/**
 * ノードがDuctSegmentNodeであることを検証するtype guard
 * 🔵 信頼性レベル: duct-segment.tsのtype定義（type: 'duct_segment'）に基づく
 */
function isDuctSegmentNode(
  node: { type: string } & Partial<DuctSegmentNode>,
): node is DuctSegmentNode {
  return node.type === 'duct_segment'
}

/**
 * 2点間のユークリッド距離を計算する（m）
 */
function calcDistance(start: [number, number, number], end: [number, number, number]): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * 【機能概要】: DuctSegmentノードのプロパティパネル（メインコンポーネント）
 * 【設計方針】:
 *   - useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
 *   - useSceneからnodes + updateNodeを1回のセレクターで取得
 *   - 選択なし/非DuctSegmentノードの場合はnullを返す（早期リターン）
 * 🔵 信頼性レベル: REQ-1403（ダクトプロパティパネル）に明示
 */
export function DuctPanel() {
  // 【selectedIds取得】: useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
  const selectedIds = useViewer(getViewerSelectedIds)

  // 【ストア状態取得】: useSceneを1回呼び出しでnodes + updateNodeを同時取得
  const { nodes, updateNode } = useScene((s) => ({
    nodes: s.nodes,
    updateNode: s.updateNode,
  })) as {
    nodes: Record<string, { type: string } & Partial<DuctSegmentNode>>
    updateNode: (id: string, data: Partial<DuctSegmentNode>) => void
  }

  // 【早期リターン】: 選択なし → null
  if (selectedIds.length === 0) return null

  // 【ノード取得】: 最初の選択IDでノードを取得
  const ductId = selectedIds[0]!
  const node = nodes[ductId]

  // 【型ガード適用】: isDuctSegmentNode で安全な型チェック
  if (!node || !isDuctSegmentNode(node)) return null

  // 【updateNodeラッパー】: IDをバインドしたupdateNode呼び出し
  const handleUpdate = (data: Partial<DuctSegmentNode>) => {
    updateNode(ductId, data)
  }

  // 【ダクト長計算】: start/end 2点間のユークリッド距離（m）
  const length = calcDistance(node.start, node.end)

  return (
    <HvacPanelShell dataTestId="duct-panel" title="ダクトプロパティ">
      <HvacPanelBody>
        <HvacPanelSection title="基本情報">
          {/* 【断面形状】: 読み取り専用 */}
          <HvacField label="断面形状" value={node.shape === 'rectangular' ? '矩形' : '円形'} />

          {/* 【寸法入力】: width × height (mm) — 編集可能 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.03em]">
                幅 (mm)
              </span>
              <HvacInput
                onChange={(e) => handleUpdate({ width: Number(e.target.value) })}
                type="number"
                value={node.width ?? ''}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.03em]">
                高さ (mm)
              </span>
              <HvacInput
                onChange={(e) => handleUpdate({ height: Number(e.target.value) })}
                type="number"
                value={node.height ?? ''}
              />
            </label>
          </div>

          {/* 【材質】: ドロップダウン選択 */}
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.03em]">
              材質
            </span>
            <HvacSelect
              onChange={(e) =>
                handleUpdate({ ductMaterial: e.target.value as DuctSegmentNode['ductMaterial'] })
              }
              value={node.ductMaterial}
            >
              {(Object.entries(MATERIAL_LABELS) as [DuctSegmentNode['ductMaterial'], string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </HvacSelect>
          </label>
        </HvacPanelSection>

        <HvacPanelSection title="計算・接続情報">
          {/* 【風量】: 読み取り専用（自動計算結果） */}
          <HvacField label="風量 (m³/h)" value={node.airflowRate != null ? node.airflowRate : '未計算'} />

          {/* 【圧損】: 読み取り専用（計算結果） */}
          <HvacField
            label="圧損 (Pa)"
            value={node.calcResult != null ? node.calcResult.totalPressureLoss : '未計算'}
          />

          {/* 【ダクト長】: start→end距離（m）読み取り専用 */}
          <HvacField label="ダクト長 (m)" value={length.toFixed(2)} />

          {/* 【接続ポート】: 読み取り専用 */}
          <HvacField label="始端ポート" value={node.startPortId} />
          <HvacField label="終端ポート" value={node.endPortId} />
        </HvacPanelSection>
      </HvacPanelBody>
    </HvacPanelShell>
  )
}
