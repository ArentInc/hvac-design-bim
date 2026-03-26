# TDD Refactorフェーズ記録: HvacZonePanel + CalcResultPanel

**タスクID**: TASK-0016
**要件名**: hvac-bim-mvp
**機能名**: HvacZonePanel + CalcResultPanel
**フェーズ**: Refactor（品質改善完了）
**作成日**: 2026-03-26

---

## テスト実行結果（リファクタ後）

```
Test Files: 3 passed (3)
      Tests: 29 passed (29)
   Duration: 3.50s
```

全29テスト、リファクタ前後で継続通過 ✅

---

## セキュリティレビュー結果

| 項目 | 評価 | 詳細 |
|------|------|------|
| XSS対策 | ✅ 問題なし | ReactのJSXが自動エスケープ。dangerouslySetInnerHTMLは使用していない |
| 入力値検証 | ✅ 問題なし | number inputのNumber()変換はNaNになりうるがUIパネルのため許容範囲 |
| 認証・認可 | N/A | UIパネルのみ。ストアへの書き込みはupdateNode経由で既存のundo/redoに乗る |
| データ漏洩 | ✅ 問題なし | 表示のみで外部送信なし |

**総合**: 重大なセキュリティリスクなし

---

## パフォーマンスレビュー結果

| 項目 | Greenフェーズ | Refactorフェーズ | 改善 |
|------|-------------|----------------|------|
| useScene呼び出し回数（HvacZonePanel） | 2回 | 1回 | ✅ サブスクリプション削減 |
| perimeterLoadBreakdownのreduce | 1回 | 1回 | 変化なし |
| USAGE_LABELSのObject.entries | レンダリング毎 | レンダリング毎 | 🟡 Greenフェーズと同等（useMemo化はRefactorスコープ外） |

**総合**: 重大なパフォーマンス課題なし

---

## 改善内容

### 改善1: 型安全性強化（🔵）

**対象**: `hvac-zone-panel.tsx`、`calc-result-panel.tsx`

**変更前**（Greenフェーズ）:
```typescript
// as unknown キャストで型安全性が低い
const hvacZoneNode = node as unknown as HvacZoneNode
```

**変更後**（Refactorフェーズ）:
```typescript
// type guard関数で型安全な判定
function isHvacZoneNode(node: { type: string } & Partial<HvacZoneNode>): node is HvacZoneNode {
  return node.type === 'hvac_zone'
}
// 使用箇所
if (!node || !isHvacZoneNode(node)) return null
// 以降は型安全にHvacZoneNodeとして参照可能
```

---

### 改善2: 型定義の重複除去（🔵）

**対象**: `calc-result-panel.tsx`

**変更前**（Greenフェーズ）:
```typescript
// ローカルインターフェース定義（コアと重複）
interface HvacZoneCalcResultType {
  coolingLoad: number
  heatingLoad: number
  // ... 全フィールドを手動で再定義
}
```

**変更後**（Refactorフェーズ）:
```typescript
// コア型から派生（スキーマ変更時に自動追従）
type CalcResult = NonNullable<HvacZoneNode['calcResult']>
type PerimeterLoadEntry = CalcResult['perimeterLoadBreakdown'][number]
```

---

### 改善3: useScene呼び出し集約（🔵）

**対象**: `hvac-zone-panel.tsx`

**変更前**（Greenフェーズ）:
```typescript
// 2回のuseScene呼び出し（2つのサブスクリプション）
const nodes = useScene((s) => s.nodes)
const updateNode = useScene((s) => s.updateNode)
```

**変更後**（Refactorフェーズ）:
```typescript
// 1回のuseScene呼び出しで両方を取得
const { nodes, updateNode } = useScene((s: SceneState) => ({
  nodes: s.nodes,
  updateNode: s.updateNode,
}))
```

---

### 改善4: マジックナンバー除去（🔵）

**対象**: `format-load.ts`

**変更前**（Greenフェーズ）:
```typescript
if (watts >= 1000) {
  return `${(watts / 1000).toFixed(1)} kW`
}
```

**変更後**（Refactorフェーズ）:
```typescript
const KW_THRESHOLD = 1000  // REQ-1505「1000W以上はkW表記」
if (watts >= KW_THRESHOLD) {
  return `${(watts / KW_THRESHOLD).toFixed(1)} kW`
}
```

---

### 改善5: PerimeterLoadRowコンポーネント分離（🟡）

**対象**: `calc-result-panel.tsx`

**変更前**（Greenフェーズ）: `CalcResultDetails`内にインライン記述
**変更後**（Refactorフェーズ）: `PerimeterLoadRow`コンポーネントに分離

割合計算ロジックが1か所に集約され、テスト・変更が容易になった。

---

### 改善6: 型パラメータの明確化（🔵）

**対象**: `hvac-zone-panel.tsx`

- `USAGE_LABELS` の型を `Record<string, string>` → `Record<HvacZoneNode['usage'], string>` に強化
- `updateDesignConditions` の引数型を `Partial<DesignConditions>` → `Partial<HvacZoneNode['designConditions']>` に変更
- `PerimeterSection` のprops型を `PerimeterSegment[]` → `HvacZoneNode['perimeterSegments']` に変更

---

### 改善7: CalcResultPanelのuseSceneセレクターを選択ノードのみに絞り込み（🟡）

**対象**: `calc-result-panel.tsx`

**変更前**（前回Refactorフェーズ）:
```typescript
// nodes全体を取得 → 全ノード変更で再レンダーが発生
const nodes = useScene((s: SceneState) => s.nodes)
const node = nodes[zoneId]
```

**変更後**（今回追加改善）:
```typescript
// zoneIdをuseViewer後に確定し、該当ノードのみを取得
const zoneId = selectedIds[0] ?? ''
const node = useScene((s: SceneState) => s.nodes[zoneId])
```

- nodes全体マップ取得 → 対象ノード直接取得で変更検知の対象を最小化
- `zoneId`が空文字の場合は`undefined`が返り、早期リターンで処理を終了
- 🟡 信頼性レベル: Reactフックルール（条件分岐不可）に対応したパターン

---

## ファイルサイズ確認

| ファイル | Greenフェーズ | Refactorフェーズ（最終） | 500行制限 |
|---------|-------------|----------------|---------|
| `format-load.ts` | 22行 | 28行 | ✅ |
| `hvac-zone-panel.tsx` | 177行 | 297行 | ✅ |
| `calc-result-panel.tsx` | 124行 | 210行 | ✅ |

---

## テスト実行結果（最終）

```
Test Files: 3 passed (3)
      Tests: 29 passed (29)
   Duration: 3.82s
```

全29テスト、全リファクタ適用後も継続通過 ✅

---

## 品質判定

```
✅ 高品質:
- テスト結果: 全29テスト継続成功
- セキュリティ: 重大な脆弱性なし（ReactのXSS自動対策）
- パフォーマンス:
  - HvacZonePanel: useScene1回呼び出しに集約
  - CalcResultPanel: 全ノード取得 → 対象ノードのみ取得に改善
- リファクタ品質: 型安全性・重複除去・マジックナンバー排除・コンポーネント分離・セレクター最適化を達成
- コード品質: 型エイリアス・type guard・定数定義・絞り込みセレクターで品質向上
- ファイルサイズ: 全ファイル500行以下
- 日本語コメント: 改善内容・設計方針・パフォーマンス・信頼性レベルを全コメントに付与
- Biomeチェック: エラー・警告なし（EXIT:0）
```
