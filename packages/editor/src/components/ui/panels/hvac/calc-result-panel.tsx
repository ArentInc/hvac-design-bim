'use client'

// 【機能概要】: HvacZoneノードの負荷計算結果表示パネル（読み取り専用）
// 【改善内容】: ローカル型定義をHvacZoneNode['calcResult']から派生させ、型の重複を除去
// 【設計方針】: useViewer(selectedIds) + useScene(nodes)を使用して計算結果を読み取り専用表示
// 🔵 信頼性レベル: requirements.md 2.2、REQ-301/306/1505、architecture.md「HVAC右パネル」に明示

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

import type { HvacZoneNode } from '@pascal-app/core'
import { formatLoad } from './format-load'

// 【型エイリアス】: HvacZoneNodeのcalcResult型からnullを除いた型
// 【改善内容】: Greenフェーズのローカル型定義をコア型から派生させて型の重複を除去
// 🔵 信頼性レベル: packages/core/src/schema/nodes/hvac-zone.tsのHvacZoneCalcResultに基づく
type CalcResult = NonNullable<HvacZoneNode['calcResult']>

// 【型エイリアス】: perimeterLoadBreakdownの各エントリ型
// 【設計方針】: CalcResultから派生させることでスキーマ変更時の追従箇所を1か所に集約
type PerimeterLoadEntry = CalcResult['perimeterLoadBreakdown'][number]

// 【useSceneセレクター型】: CalcResultPanelが必要とするuseSceneの状態型
// 【改善内容】: 全ノードマップではなく、対象ノードを直接取得するセレクター向けの型定義
// 🟡 信頼性レベル: useScene.nodesの型からIDアクセス結果を表現
interface SceneState {
  nodes: Record<
    string,
    ({ type: string; calcResult?: CalcResult | null } & Partial<HvacZoneNode>) | undefined
  >
}

/**
 * 【ヘルパー関数】: ノードがHvacZoneNodeで計算結果を持つかを検証するtype guard
 * 【改善内容】: calcResultの存在チェックも含め、型安全な参照を実現
 * 【単一責任】: 型チェックのみを担当し、副作用を持たない純粋関数
 * 🔵 信頼性レベル: hvac-zone.tsのtype/calcResult定義に基づく
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
 * 【機能概要】: 方位別外皮負荷テーブルの各行コンポーネント
 * 【改善内容】: インライン計算をコンポーネントに分離し可読性を向上
 * 【設計方針】: totalEnvelopeLoadをpropsで受け取り、行内で割合を計算
 * 【単一責任】: 1行の表示と割合計算のみを担当
 * 🔵 信頼性レベル: requirements.md 2.2「割合: %表記（小数点1桁）」に明示
 * @param entry - 方位別外皮負荷エントリ
 * @param totalEnvelopeLoad - 合計外皮負荷（割合計算の基準値）
 */
function PerimeterLoadRow({
  entry,
  totalEnvelopeLoad,
}: {
  entry: PerimeterLoadEntry
  totalEnvelopeLoad: number
}) {
  // 【割合計算】: 各方位の負荷を合計で割って%表示、ゼロ除算を防ぐ
  const ratio =
    totalEnvelopeLoad > 0 ? (entry.envelopeLoadContribution / totalEnvelopeLoad) * 100 : 0

  return (
    <tr>
      <td>{entry.orientation}</td>
      {/* 【負荷表示】: formatLoadでW/kW自動切替（REQ-1505） */}
      <td>{formatLoad(entry.envelopeLoadContribution)}</td>
      {/* 【割合表示】: requirements.md 3.4「割合: %表記（小数点1桁）」 */}
      <td>{ratio.toFixed(1)}%</td>
    </tr>
  )
}

/**
 * 【機能概要】: 計算結果の詳細表示サブコンポーネント
 * 【改善内容】:
 *   1. PerimeterLoadRow コンポーネントを分離して可読性を向上
 *   2. 型をCalcResultエイリアスで明確化
 * 【設計方針】: 負荷サマリー/内訳dl/方位別テーブルの3セクション構成
 * 【パフォーマンス】: perimeterLoadBreakdownのreduceは1回のみ実行
 * 🔵 信頼性レベル: requirements.md 2.2「CalcResultPanel出力」に明示
 * @param calcResult - 計算済みのHvacZoneCalcResult（nullは呼び出し元で排除済み）
 */
function CalcResultDetails({ calcResult }: { calcResult: CalcResult }) {
  // 【合計負荷計算】: 方位別内訳の合計を100%の基準値として使用（ゼロ除算防止）
  const totalEnvelopeLoad = calcResult.perimeterLoadBreakdown.reduce(
    (sum, entry) => sum + entry.envelopeLoadContribution,
    0,
  )

  return (
    <div>
      {/* 【負荷サマリーセクション】: REQ-1505フォーマット（冷暖房負荷kW, 必要風量m³/h） */}
      <section>
        <h3>負荷サマリー</h3>
        <dl>
          {/* 【冷房負荷】: formatLoad使用、REQ-1505「1000W以上はkW表記」 */}
          <dt>冷房負荷</dt>
          <dd>{formatLoad(calcResult.coolingLoad)}</dd>

          {/* 【暖房負荷】: formatLoad使用 */}
          <dt>暖房負荷</dt>
          <dd>{formatLoad(calcResult.heatingLoad)}</dd>

          {/* 【必要風量】: toLocaleString()でカンマ区切り、m³/h単位（REQ-1505） */}
          <dt>必要風量</dt>
          <dd>{calcResult.requiredAirflow.toLocaleString()} m³/h</dd>
        </dl>
      </section>

      {/* 【負荷内訳セクション】: 内部負荷/外皮負荷の内訳（dl形式） */}
      <section>
        <h3>負荷内訳</h3>
        <dl>
          {/* 【内部負荷】: formatLoad使用（照明・人体・機器発熱の合計） */}
          <dt>内部負荷</dt>
          <dd>{formatLoad(calcResult.internalLoad)}</dd>

          {/* 【外皮負荷】: formatLoad使用（壁・窓の熱貫流の合計） */}
          <dt>外皮負荷</dt>
          <dd>{formatLoad(calcResult.envelopeLoad)}</dd>
        </dl>
      </section>

      {/* 【方位別外皮負荷テーブル】: REQ-306「perimeterLoadBreakdownを含む」 */}
      <section>
        <h3>方位別外皮負荷</h3>
        <table>
          <thead>
            <tr>
              <th>方位</th>
              {/* 【ヘッダー】: 負荷(W)と割合ヘッダー（requirements.md 2.2） */}
              <th>負荷 (W)</th>
              <th>割合</th>
            </tr>
          </thead>
          <tbody>
            {calcResult.perimeterLoadBreakdown.map((entry, idx) => (
              // 【キー設計】: orientation+idxで一意性を保証（同方位が複数ある場合に対応）
              <PerimeterLoadRow
                entry={entry}
                key={`${entry.orientation}-${idx}`}
                totalEnvelopeLoad={totalEnvelopeLoad}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

/**
 * 【機能概要】: 負荷計算結果表示パネル（メインコンポーネント）
 * 【改善内容】:
 *   1. ローカル型定義をHvacZoneNode型エイリアスに置き換えて型の重複を除去
 *   2. isHvacZoneNode type guardを導入してas unknown キャストを排除
 *   3. useSceneセレクターを選択ノードIDに絞り込み、全ノード変更による不要再レンダーを防止
 * 【設計方針】:
 *   - useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
 *   - calcResult=null → 誘導メッセージ、設定済み → CalcResultDetails
 * 【パフォーマンス】:
 *   - useViewer → selectedIds[0] で zoneId を確定してから useScene セレクターで該当ノードのみ取得
 *   - 全ノード取得（s.nodes）を避け、変更検知の対象を最小化
 * 🔵 信頼性レベル: requirements.md 2.2、REQ-301/306/1505、architecture.md「HVAC右パネル」に明示
 */
export function CalcResultPanel() {
  // 【selectedIds取得】: useViewerからselectedIdsのみ参照（Viewer隔離ルール遵守）
  const selectedIds = useViewer((s: { selectedIds: string[] }) => s.selectedIds)

  // 【zoneId確定】: 選択なし時は空文字（useSceneのセレクターはフックルール上条件分岐不可）
  const zoneId = selectedIds[0] ?? ''

  // 【対象ノードのみ取得】: 選択IDのノードだけをセレクトして不要な再レンダーを防ぐ
  // 【パフォーマンス改善】: s.nodes全体取得 → s.nodes[zoneId]取得に変更
  // 🟡 信頼性レベル: Reactフックルール（条件分岐不可）に対応した選択ノード絞り込みパターン
  const node = useScene((s: SceneState) => s.nodes[zoneId])

  // 【早期リターン】: 選択なし → null（エッジ4対応）
  if (selectedIds.length === 0) return null

  // 【型ガード適用】: isHvacZoneNodeで安全な型チェック（非HvacZoneノード選択時はnull）
  if (!node || !isHvacZoneNode(node)) return null

  // 【calcResult取得】: ノードのcalcResultを取得（Zod型によりnull許容）
  const calcResult = node.calcResult ?? null

  // 【calcResult未設定時】: エッジ2対応 - 誘導メッセージを表示
  if (!calcResult) {
    return (
      <div>
        {/* 【誘導メッセージ】: requirements.md エッジ2「計算結果なし時のメッセージ」 */}
        <p>計算結果がありません。ゾーンの設定を完了してください。</p>
      </div>
    )
  }

  // 【計算結果表示】: calcResultが設定済みの場合はCalcResultDetailsを表示
  return (
    <div>
      <h2>負荷計算結果</h2>
      <CalcResultDetails calcResult={calcResult} />
    </div>
  )
}
