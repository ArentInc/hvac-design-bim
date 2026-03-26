# TDD Redフェーズ記録: HvacZonePanel + CalcResultPanel

**タスクID**: TASK-0016
**要件名**: hvac-bim-mvp
**機能名**: HvacZonePanel + CalcResultPanel
**フェーズ**: Red（失敗テスト作成完了）
**作成日**: 2026-03-26

---

## 作成したテストケース一覧

### format-load.test.ts（8テスト）

| # | テスト名 | 信頼性 | 概要 |
|---|---------|--------|------|
| 1 | 17400W → "17.4 kW" | 🔵 | kW表記の基本変換 |
| 2 | 800W → "800 W" | 🔵 | W表記の基本変換 |
| 3 | 1000W → "1.0 kW" (境界値) | 🟡 | 1000W境界でkW表記 |
| 4 | 999W → "999 W" (境界値) | 🟡 | 999W境界でW表記 |
| 5 | 10000W → "10.0 kW" | 🔵 | 大きな値のkW表記 |
| 6 | 1500W → "1.5 kW" | 🔵 | 端数ありのkW表記 |
| 7 | 0W → "0 W" | 🟡 | ゼロ値のW表記 |
| 8 | 100W → "100 W" | 🔵 | 100W台のW表記 |

### hvac-zone-panel.test.tsx（11テスト）

| # | テスト名 | 信頼性 | 概要 |
|---|---------|--------|------|
| 1 | ゾーン基本情報が正しく表示される | 🔵 | zoneName/floorArea/ceilingHeight表示確認 |
| 2 | 用途selectに全5種類のオプションが存在する | 🔵 | ZoneUsage列挙の全種類確認 |
| 3 | 用途変更でupdateNodeが呼ばれる | 🔵 | usage変更のupdateNode呼び出し確認 |
| 4 | ゾーン名変更でupdateNodeが呼ばれる | 🔵 | zoneName変更のupdateNode呼び出し確認 |
| 5 | 設計条件（冷房設定温度）が表示される | 🔵 | designConditions.coolingSetpoint表示 |
| 6 | 設計条件（暖房設定温度）変更でupdateNodeが呼ばれる | 🔵 | heatingSetpoint変更のupdateNode確認 |
| 7 | perimeterSegments一覧がテーブル表示される | 🔵 | 方位/壁面積/ガラス面積比テーブル確認 |
| 8 | perimeterSegments空配列時に誘導メッセージ表示 | 🔵 | 未設定時の誘導メッセージ確認 |
| 9 | 非HvacZoneノード選択時はnullを返す | 🔵 | 非HvacZoneノード選択時の非表示確認 |
| 10 | selectedIds空配列時はnullを返す | 🔵 | 選択なし時の非表示確認 |
| 11 | 在室密度（occupantDensity）変更でupdateNodeが呼ばれる | 🔵 | occupantDensity変更のupdateNode確認 |

### calc-result-panel.test.tsx（10テスト）

| # | テスト名 | 信頼性 | 概要 |
|---|---------|--------|------|
| 1 | calcResult未設定時に「計算結果がありません」メッセージを表示 | 🔵 | calcResult=null時のメッセージ確認 |
| 2 | 冷房負荷が "17.4 kW" フォーマットで表示される | 🔵 | coolingLoad kW表記確認 |
| 3 | 暖房負荷が "10.0 kW" フォーマットで表示される | 🔵 | heatingLoad kW表記確認 |
| 4 | 必要風量が "4,478 m³/h" フォーマットで表示される | 🔵 | requiredAirflow m³/h表記確認 |
| 5 | 方位別外皮負荷テーブルに2行表示される | 🔵 | perimeterLoadBreakdown表示確認 |
| 6 | 負荷サマリーセクションのラベルが存在する | 🔵 | 冷房/暖房/必要風量ラベル確認 |
| 7 | 負荷内訳セクションのラベルが存在する | 🔵 | 内部負荷/外皮負荷ラベル確認 |
| 8 | 内部負荷が "8.0 kW" フォーマットで表示される | 🔵 | internalLoad kW表記確認 |
| 9 | selectedIds空配列時はnullを返す | 🔵 | 選択なし時の非表示確認 |
| 10 | 方位別テーブルに「負荷 (W)」「割合」ヘッダーが存在する | 🔵 | テーブルヘッダー確認 |

**合計テスト数**: 29テスト（目標10以上 ✅）

---

## テストファイルパス

```
packages/editor/src/components/ui/panels/hvac/__tests__/format-load.test.ts
packages/editor/src/components/ui/panels/hvac/__tests__/hvac-zone-panel.test.tsx
packages/editor/src/components/ui/panels/hvac/__tests__/calc-result-panel.test.tsx
```

---

## 期待される失敗内容（確認済み）

全3テストファイルを実行し、以下のエラーで失敗することを確認済み：

```
Error: Cannot find module '../format-load' imported from ...
Error: Cannot find module '/packages/editor/src/components/ui/panels/hvac/hvac-zone-panel' imported from ...
Error: Cannot find module '/packages/editor/src/components/ui/panels/hvac/calc-result-panel' imported from ...
```

失敗理由：実装ファイルが存在しないため（Redフェーズとして正しい状態）

---

## 品質判定

```
✅ 高品質:
- テスト実行: 成功（失敗することを確認）
- 期待値: 明確で具体的（具体的な文字列/値/関数呼び出し引数）
- アサーション: 適切（toBeDefined, toBeNull, toHaveBeenCalledWith）
- 実装方針: 明確（要件定義・型定義に基づく）
- 信頼性レベル: 🔵（青信号）が多い（27/29 = 93%）
```

---

## Greenフェーズで実装すべき内容

### 1. `packages/editor/src/components/ui/panels/hvac/format-load.ts`

```typescript
export function formatLoad(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(1)} kW`
  }
  return `${Math.round(watts)} W`
}
```

### 2. `packages/editor/src/components/ui/panels/hvac/hvac-zone-panel.tsx`

- `HvacZonePanel` コンポーネント
  - useViewer から selectedIds を取得
  - useScene から nodes[zoneId] と updateNode を取得
  - type !== 'hvac_zone' または selectedIds 空の場合 null 返却
- `BasicInfoSection` サブコンポーネント
  - zoneName: text input（onChange → updateNode(id, {zoneName})）
  - usage: select（5種類）（onChange → updateNode(id, {usage})）
  - floorArea: 読み取り専用テキスト（toFixed(1)）
  - ceilingHeight: number input（onChange → updateNode(id, {ceilingHeight})）
  - occupantDensity: number input, step=0.01（onChange → updateNode(id, {occupantDensity})）
- `DesignConditionsSection` サブコンポーネント
  - coolingSetpoint: number input（onChange → updateNode(id, {designConditions: {..., coolingSetpoint}})）
  - heatingSetpoint: number input
  - supplyAirTempDiff: number input
- `PerimeterSection` サブコンポーネント
  - perimeterSegments 空: 誘導メッセージ「未設定（PerimeterEditToolで入力してください）」
  - 非空: テーブル（方位/壁面積/ガラス面積比%）表示

### 3. `packages/editor/src/components/ui/panels/hvac/calc-result-panel.tsx`

- `CalcResultPanel` コンポーネント
  - calcResult === null: 「計算結果がありません。ゾーンの設定を完了してください。」メッセージ
  - 計算済み: CalcResultDetails を表示
- `CalcResultDetails` サブコンポーネント
  - 負荷サマリーdl: coolingLoad/heatingLoad（formatLoad）、requiredAirflow（toLocaleString() m³/h）
  - 負荷内訳dl: internalLoad/envelopeLoad（formatLoad）
  - 方位別テーブル: orientation/envelopeLoadContribution（formatLoad）/割合(%)

---

## 信頼性レベルサマリー

| 信頼性 | 数 | 割合 |
|--------|-----|------|
| 🔵 青 | 27 | 93% |
| 🟡 黄 | 2 | 7% |
| 🔴 赤 | 0 | 0% |
| **合計** | **29** | |
