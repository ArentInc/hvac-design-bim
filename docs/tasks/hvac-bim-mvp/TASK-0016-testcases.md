# TASK-0016 テストケース定義

## 概要

HvacZonePanel + CalcResultPanel のテストケース。3つのテストファイルに分割する。

- `packages/editor/src/components/ui/panels/hvac/__tests__/hvac-zone-panel.test.tsx` - ゾーンプロパティパネル
- `packages/editor/src/components/ui/panels/hvac/__tests__/calc-result-panel.test.tsx` - 計算結果パネル
- `packages/editor/src/components/ui/panels/hvac/__tests__/format-load.test.ts` - フォーマットユーティリティ

## スキーマ整合性に関する注意

実装済み `HvacZoneCalcResult` の `perimeterLoadBreakdown` は以下のフィールドを持つ:
- `orientation: Orientation`
- `solarCorrectionFactor: number`
- `envelopeLoadContribution: number`

TASK仕様の `{orientation, load, percentage}` とは異なるため、テストケースは**実スキーマに準拠**する。

---

## ファイル1: hvac-zone-panel.test.tsx

### モック構成

```
vi.mock('@pascal-app/viewer') → useViewer (selectedIds)
vi.mock('@pascal-app/core')   → useScene (nodes, updateNode)
```

useScene と useViewer は zustand store のモックパターン（既存テストと同様）を使用。

### テスト1: ゾーン基本情報表示

- **ID**: HZP-01
- **信頼性**: 🔵
- **Given**: useScene.nodes に `{ id: 'hvac_zone_001', type: 'hvac_zone', zoneName: 'オフィスA', usage: 'office_general', floorArea: 100, ceilingHeight: 2.7, occupantDensity: 0.15, ... }` が存在し、useViewer.selectedIds = ['hvac_zone_001']
- **When**: `<HvacZonePanel />` をレンダリング
- **Then**:
  - 「オフィスA」がテキストとして表示される
  - 床面積「100」が表示される（読み取り専用）
  - 天井高の input に 2.7 が設定されている
  - 在室人員密度の input に 0.15 が設定されている

### テスト2: 非hvac_zoneノード選択時は非表示

- **ID**: HZP-02
- **信頼性**: 🔵
- **Given**: useScene.nodes に `{ id: 'wall_001', type: 'wall', ... }` が存在し、selectedIds = ['wall_001']
- **When**: `<HvacZonePanel />` をレンダリング
- **Then**: null が返される（何も表示されない）

### テスト3: 未選択時は非表示

- **ID**: HZP-03
- **信頼性**: 🔵
- **Given**: selectedIds = []
- **When**: `<HvacZonePanel />` をレンダリング
- **Then**: null が返される

### テスト4: 用途変更でupdateNodeが呼ばれる

- **ID**: HZP-04
- **信頼性**: 🔵
- **Given**: HvacZonePanelが表示されている（usage='office_general'）
- **When**: 用途セレクトを 'conference' に変更
- **Then**: `updateNode('hvac_zone_001', { usage: 'conference' })` が呼ばれる

### テスト5: 天井高変更でupdateNodeが呼ばれる

- **ID**: HZP-05
- **信頼性**: 🔵
- **Given**: HvacZonePanelが表示されている（ceilingHeight=2.7）
- **When**: 天井高 input を 3.0 に変更
- **Then**: `updateNode('hvac_zone_001', { ceilingHeight: 3.0 })` が呼ばれる

### テスト6: 在室人員密度変更でupdateNodeが呼ばれる

- **ID**: HZP-06
- **信頼性**: 🔵
- **Given**: HvacZonePanelが表示されている（occupantDensity=0.15）
- **When**: 在室人員密度 input を 0.2 に変更
- **Then**: `updateNode('hvac_zone_001', { occupantDensity: 0.2 })` が呼ばれる

### テスト7: designConditions表示

- **ID**: HZP-07
- **信頼性**: 🔵
- **Given**: designConditions = { coolingSetpoint: 26, heatingSetpoint: 22, relativeHumidity: 50, supplyAirTempDiff: 10 }
- **When**: HvacZonePanelをレンダリング
- **Then**:
  - 冷房設定温度 input に 26 が設定されている
  - 暖房設定温度 input に 22 が設定されている
  - 送風温度差 input に 10 が設定されている

### テスト8: designConditions編集でupdateNodeが呼ばれる

- **ID**: HZP-08
- **信頼性**: 🔵
- **Given**: HvacZonePanelが表示されている
- **When**: 冷房設定温度を 28 に変更
- **Then**: `updateNode('hvac_zone_001', { designConditions: { ...existingConditions, coolingSetpoint: 28 } })` が呼ばれる

### テスト9: perimeterSegments一覧表示

- **ID**: HZP-09
- **信頼性**: 🔵
- **Given**: perimeterSegments = [{ orientation: 'S', wallArea: 30.0, glazingRatio: 0.4 }, { orientation: 'W', wallArea: 20.0, glazingRatio: 0.3 }]
- **When**: HvacZonePanelをレンダリング
- **Then**:
  - 方位「S」「W」が表示される
  - 壁面積「30.0」「20.0」が表示される
  - ガラス面積比「40%」「30%」が表示される

### テスト10: perimeterSegments未設定時の誘導メッセージ

- **ID**: HZP-10
- **信頼性**: 🔵
- **Given**: perimeterSegments = []
- **When**: HvacZonePanelをレンダリング
- **Then**: 「未設定」を含むメッセージが表示される

---

## ファイル2: calc-result-panel.test.tsx

### モック構成

```
vi.mock('@pascal-app/viewer') → useViewer (selectedIds)
vi.mock('@pascal-app/core')   → useScene (nodes)
```

### テスト1: calcResult未設定時のメッセージ表示

- **ID**: CRP-01
- **信頼性**: 🔵
- **Given**: HvacZoneNode の calcResult が null で、selectedIds = ['hvac_zone_001']
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**: 「計算結果がありません」を含むテキストが表示される

### テスト2: 非hvac_zoneノード選択時は非表示

- **ID**: CRP-02
- **信頼性**: 🔵
- **Given**: selectedIds に wall ノードが設定されている
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**: null が返される（何も表示されない）

### テスト3: 冷暖房負荷のkW表示

- **ID**: CRP-03
- **信頼性**: 🔵
- **Given**: calcResult = { coolingLoad: 17400, heatingLoad: 10000, requiredAirflow: 4478, internalLoad: 8000, envelopeLoad: 9400, perimeterLoadBreakdown: [], status: 'success' }
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**:
  - 「17.4 kW」が表示される（冷房負荷）
  - 「10.0 kW」が表示される（暖房負荷）

### テスト4: 必要風量のカンマ区切り表示

- **ID**: CRP-04
- **信頼性**: 🔵
- **Given**: calcResult.requiredAirflow = 4478
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**: 「4,478」を含むテキストと「m³/h」が表示される

### テスト5: 内部負荷・外皮負荷の内訳表示

- **ID**: CRP-05
- **信頼性**: 🔵
- **Given**: calcResult = { internalLoad: 8000, envelopeLoad: 9400, ... }
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**:
  - 「8.0 kW」が内部負荷として表示される
  - 「9.4 kW」が外皮負荷として表示される

### テスト6: 方位別外皮負荷内訳テーブル表示

- **ID**: CRP-06
- **信頼性**: 🔵
- **Given**: perimeterLoadBreakdown = [{ orientation: 'S', solarCorrectionFactor: 1.0, envelopeLoadContribution: 2400 }, { orientation: 'W', solarCorrectionFactor: 1.2, envelopeLoadContribution: 1440 }]
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**:
  - テーブルに2行の方位別内訳が表示される
  - 方位「S」「W」が表示される
  - 各行に負荷値が表示される（「2.4 kW」「1.4 kW」）

### テスト7: 方位別内訳が空の場合はセクション非表示

- **ID**: CRP-07
- **信頼性**: 🔵
- **Given**: perimeterLoadBreakdown = []
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**: 「方位別」を含むセクション見出しが表示されない

### テスト8: エラーステータス時のエラーメッセージ表示

- **ID**: CRP-08
- **信頼性**: 🔵
- **Given**: calcResult = { ..., status: 'error', error: 'ペリメータ未設定' }
- **When**: `<CalcResultPanel />` をレンダリング
- **Then**: エラーメッセージ「ペリメータ未設定」が表示される

---

## ファイル3: format-load.test.ts

### テスト1: 1000W以上はkW表記

- **ID**: FL-01
- **信頼性**: 🔵
- **Given**: watts = 17400
- **When**: `formatLoad(17400)` を呼び出す
- **Then**: `'17.4 kW'` が返却される

### テスト2: 1000W未満はW表記

- **ID**: FL-02
- **信頼性**: 🔵
- **Given**: watts = 800
- **When**: `formatLoad(800)` を呼び出す
- **Then**: `'800 W'` が返却される

### テスト3: ちょうど1000WはkW表記

- **ID**: FL-03
- **信頼性**: 🔵
- **Given**: watts = 1000
- **When**: `formatLoad(1000)` を呼び出す
- **Then**: `'1.0 kW'` が返却される

### テスト4: 0Wの処理

- **ID**: FL-04
- **信頼性**: 🔵
- **Given**: watts = 0
- **When**: `formatLoad(0)` を呼び出す
- **Then**: `'0 W'` が返却される

### テスト5: 小数点以下の丸め

- **ID**: FL-05
- **信頼性**: 🔵
- **Given**: watts = 1555
- **When**: `formatLoad(1555)` を呼び出す
- **Then**: `'1.6 kW'` が返却される（小数1桁丸め）

---

## テストケースサマリー

| ファイル | テスト数 | カバー範囲 |
|---------|---------|-----------|
| hvac-zone-panel.test.tsx | 10 | 基本情報表示/編集、設計条件表示/編集、ペリメータ一覧 |
| calc-result-panel.test.tsx | 8 | 未設定表示、負荷表示フォーマット、風量表示、方位別内訳 |
| format-load.test.ts | 5 | kW/W切替、境界値、0W、丸め |
| **合計** | **23** | |

## タスク仕様との対応

| タスク仕様テスト | 本テストケースID |
|----------------|----------------|
| テスト1: ゾーン基本情報表示 | HZP-01 |
| テスト2: 用途変更 | HZP-04 |
| テスト3: calcResult未設定時の表示 | CRP-01 |
| テスト4: calcResult表示 | CRP-03, CRP-04 |
| テスト5: 方位別内訳表示 | CRP-06 |
| テスト6: formatLoad kW表記 | FL-01 |
| テスト7: formatLoad W表記 | FL-02 |
