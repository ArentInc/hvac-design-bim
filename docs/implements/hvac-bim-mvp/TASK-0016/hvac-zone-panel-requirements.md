# TDD要件定義書: HvacZonePanel + CalcResultPanel -- ゾーンプロパティ表示

**タスクID**: TASK-0016
**要件名**: hvac-bim-mvp
**機能名**: HvacZonePanel + CalcResultPanel
**フェーズ**: Phase 2 - ゾーニング + 負荷計算
**作成日**: 2026-03-26

---

## 1. 機能の概要（EARS要件定義書・設計文書ベース）

- 🔵 **何をする機能か**: 選択中のHvacZoneNodeの基本プロパティ（ゾーン名、用途、床面積、天井高、在室密度）、設計条件（冷暖房設定温度、送風温度差）、外皮条件（perimeterSegments）を右パネルに表示・編集し、負荷計算結果（冷暖房負荷、必要風量、方位別内訳）を読み取り専用で表示するUIパネルコンポーネント群を実装する。
  - *ユーザストーリー: ストーリー2.1,2.2,2.3「ゾーン作成→条件入力→負荷確認」*
- 🔵 **どのような問題を解決するか**: ゾーンの設計条件と負荷計算結果をユーザーが確認・調整するためのインターフェースを提供する。HVACモードでゾーン選択時に、必要な情報が右パネルに集約表示されないと、設計ワークフローが中断される問題を解決する。
- 🔵 **想定されるユーザー**: 空調設備の基本設計を行う設計者（PRD対象ユーザー）
- 🔵 **システム内での位置づけ**: packages/editor パッケージ内のUIコンポーネント。useScene（core）からノードデータを取得し、useViewer（viewer）から選択状態を取得する。architecture.md の「packages/editor拡張 > HVAC右パネル」に該当。
- **参照したEARS要件**: REQ-1403, REQ-1505, REQ-203, REQ-204, REQ-205, REQ-301, REQ-306
- **参照した設計文書**: architecture.md「packages/editor拡張」セクション、dataflow.md「機能1: ゾーン作成と負荷計算」

---

## 2. 入力・出力の仕様（EARS機能要件・TypeScript型定義ベース）

### 2.1 入力パラメータ

#### HvacZonePanelの入力

| パラメータ | 型 | ソース | 信頼性 |
|-----------|-----|--------|--------|
| selectedIds | `string[]` | useViewer ストア | 🔵 |
| nodes[zoneId] | `HvacZoneNode` | useScene ストア | 🔵 |
| updateNode | `(id: string, data: Partial<HvacZoneNode>) => void` | useScene ストア | 🔵 |

#### HvacZoneNode の表示対象フィールド（interfaces.ts準拠）

| フィールド | 型 | 編集可否 | 信頼性 |
|-----------|-----|---------|--------|
| zoneName | `string` | 編集可 | 🔵 REQ-203 |
| usage | `ZoneUsage` (`'office_general' \| 'office_server' \| 'conference' \| 'reception' \| 'corridor'`) | 編集可（select） | 🔵 REQ-203 |
| floorArea | `number` (m^2) | 読み取り専用（境界から自動算出） | 🔵 REQ-203 |
| ceilingHeight | `number` (m), default: 2.7 | 編集可（number input） | 🔵 REQ-203 |
| occupantDensity | `number` (人/m^2), default: 0.15 | 編集可（number input, step: 0.01） | 🔵 REQ-203 |
| designConditions.coolingSetpoint | `number` (C), default: 26 | 編集可 | 🔵 REQ-204 |
| designConditions.heatingSetpoint | `number` (C), default: 22 | 編集可 | 🔵 REQ-204 |
| designConditions.supplyAirTempDiff | `number` (K), default: 10 | 編集可 | 🔵 REQ-204, REQ-206 |
| perimeterSegments | `PerimeterSegment[]` | 読み取り専用（PerimeterEditToolで編集） | 🔵 REQ-205 |
| calcResult | `HvacZoneCalcResult \| null` | 読み取り専用 | 🔵 REQ-301 |

#### CalcResultPanelの入力

| パラメータ | 型 | ソース | 信頼性 |
|-----------|-----|--------|--------|
| selectedIds | `string[]` | useViewer ストア | 🔵 |
| nodes[zoneId].calcResult | `HvacZoneCalcResult \| null` | useScene ストア | 🔵 |

### 2.2 出力値

#### HvacZonePanel出力

| 出力 | 型 | 形式 | 信頼性 |
|------|-----|------|--------|
| ゾーン基本情報表示 | React JSX | テキスト入力/セレクト/数値入力/読み取り表示 | 🔵 |
| 設計条件表示 | React JSX | 数値入力フォーム | 🔵 |
| 外皮条件一覧 | React JSX | テーブル表示（方位, 壁面積, ガラス面積比%） | 🔵 |
| updateNode 呼び出し | `void` | フィールド変更時に即座にuseScene.updateNode呼び出し | 🔵 |

#### CalcResultPanel出力

| 出力 | 型 | 形式 | 信頼性 |
|------|-----|------|--------|
| 負荷サマリー | React JSX | dl形式: 冷房負荷, 暖房負荷, 必要風量 | 🔵 REQ-1505 |
| 負荷内訳 | React JSX | dl形式: 内部負荷, 外皮負荷 | 🔵 |
| 方位別外皮負荷 | React JSX | テーブル: 方位, 負荷(W), 割合(%) | 🔵 REQ-306 |

#### formatLoadユーティリティ出力

| 入力 | 出力 | 例 | 信頼性 |
|------|------|-----|--------|
| watts: number (>= 1000) | `string` | `17400` -> `'17.4 kW'` | 🔵 REQ-1505 |
| watts: number (< 1000) | `string` | `800` -> `'800 W'` | 🔵 REQ-1505 |

### 2.3 入出力の関係性

- 🔵 HvacZonePanelは選択IDをキーにuseSceneからノードを取得し、表示する
- 🔵 フィールド編集時はuseScene.updateNodeを呼び出し、dirtyNodesに自動マークされる
- 🔵 usage/designConditions変更 -> dirtyマーク -> LoadCalcSystem再計算 -> calcResult更新 -> CalcResultPanel再レンダリング
- 🔵 floorAreaは読み取り専用（ゾーン境界ポリゴンから自動算出）
- 🔵 perimeterSegmentsは読み取り専用表示（編集はTASK-0014 PerimeterEditToolで実施）

### 2.4 データフロー

```
ユーザー → HvacZonePanel（編集操作）
  → useScene.updateNode(id, partial)
  → dirtyNodes.add(id)
  → LoadCalcSystem（検出 → 再計算）
  → useScene.updateNode(id, {calcResult})
  → CalcResultPanel（再レンダリング）
```

- **参照したEARS要件**: REQ-203, REQ-204, REQ-205, REQ-301, REQ-306, REQ-1403, REQ-1505
- **参照した設計文書**: interfaces.ts の HvacZoneNode, HvacZoneCalcResult, DesignConditions, PerimeterSegment

---

## 3. 制約条件（EARS非機能要件・アーキテクチャ設計ベース）

### 3.1 パフォーマンス要件

- 🔵 useSceneからのノード取得は選択IDベースのルックアップ（O(1)）。全ノード走査は避ける（NFR-001）
- 🟡 プロパティ変更時のupdateNode呼び出しはデバウンス不要（既存パターンで即座に反映）。ただし数値入力のonChangeは高頻度になりうるため、パフォーマンスを注視

### 3.2 アーキテクチャ制約

- 🔵 packages/editor パッケージに配置する（`packages/editor/src/components/ui/panels/hvac/`）（REQ-010, architecture.md）
- 🔵 useViewerからselectedIdsのみ参照可。viewerパッケージからは他のimportを行わない（Viewer隔離ルール）
- 🔵 updateNode経由の変更はすべてundo/redo対象（Zundo 50ステップ、既存パターン）
- 🔵 Biomeコードスタイル準拠: 2スペースインデント、シングルクォート、セミコロンなし、100文字行幅

### 3.3 UI/UX制約

- 🔵 右パネルに表示（既存のプロパティパネルと同じ位置）（REQ-1403）
- 🔵 計算結果は読み取り専用（編集不可）
- 🟡 基本情報セクションと計算結果セクションをアコーディオンまたはタブで切替可能（タスク仕様のUI/UX要件だが具体的UIライブラリは未指定）
- 🟡 負荷値はカラーコーディング（冷房=青, 暖房=赤）（タスク仕様のUI/UX要件）
- 🟡 perimeterSegments未設定時は警告アイコン表示（タスク仕様のUI/UX要件）

### 3.4 表示フォーマット制約（REQ-1505）

- 🔵 負荷値: 1000W以上はkW表記（小数点1桁）、1000W未満はW表記（整数）
- 🔵 風量: m^3/h（カンマ区切り: `toLocaleString()`）
- 🔵 割合: %表記（小数点1桁）
- 🔵 glazingRatio: パーセント表記（x100, 小数点0桁）
- 🔵 wallArea: m^2（小数点1桁）
- 🔵 floorArea: m^2（小数点1桁）

### 3.5 互換性制約

- 🔵 HvacZoneNodeの型はZodスキーマ（`packages/core/src/schema/nodes/hvac-zone.ts`）から導出された型を使用
- 🔵 既存のuseScene/useViewerストアAPIを変更しない

- **参照したEARS要件**: NFR-001, NFR-202, REQ-1403, REQ-1505, REQ-010
- **参照した設計文書**: architecture.md「packages/editor拡張」「技術的制約」セクション

---

## 4. 想定される使用例（EARSEdgeケース・データフローベース）

### 4.1 基本的な使用パターン

#### パターン1: ゾーン選択→プロパティ確認 🔵

- **Given**: HvacZoneNodeが存在し、calcResultが計算済み
- **When**: ユーザーがゾーンを選択（selectedIdsに追加）
- **Then**: HvacZonePanelにゾーン基本情報・設計条件・外皮条件が表示され、CalcResultPanelに計算結果が表示される

#### パターン2: 用途変更→再計算 🔵

- **Given**: HvacZonePanelが表示されている
- **When**: ユーザーが用途をoffice_generalからconferenceに変更
- **Then**: updateNode(id, {usage: 'conference'})が呼ばれ、dirtyマーク→LoadCalcSystem再計算→CalcResultPanel更新

#### パターン3: 設計条件変更→再計算 🔵

- **Given**: HvacZonePanelが表示されている
- **When**: ユーザーが冷房設定温度を26から28に変更
- **Then**: updateNode(id, {designConditions: {..., coolingSetpoint: 28}})が呼ばれ、再計算トリガー

### 4.2 エッジケース

#### エッジ1: 非HvacZoneノード選択時 🔵

- **Given**: Wall等のHvacZoneではないノードが選択されている
- **When**: HvacZonePanelをレンダリング
- **Then**: `null`を返し、何も表示しない

#### エッジ2: calcResult未設定時 🔵

- **Given**: HvacZoneNodeが存在するがcalcResultがnull
- **When**: CalcResultPanelをレンダリング
- **Then**: 「計算結果がありません。ゾーンの設定を完了してください。」メッセージを表示

#### エッジ3: perimeterSegments空配列時 🔵

- **Given**: HvacZoneNodeのperimeterSegmentsが空配列
- **When**: PerimeterSectionをレンダリング
- **Then**: 「未設定（PerimeterEditToolで入力してください）」メッセージを表示

#### エッジ4: 選択IDなし 🔵

- **Given**: selectedIdsが空配列
- **When**: HvacZonePanel/CalcResultPanelをレンダリング
- **Then**: `null`を返し、何も表示しない

#### エッジ5: formatLoad境界値（1000W） 🟡

- **Given**: watts = 1000
- **When**: formatLoad(1000)を呼び出す
- **Then**: `'1.0 kW'`を返す（1000以上はkW表記）

- **参照したEARS要件**: REQ-1403, REQ-1505
- **参照した設計文書**: dataflow.md「機能1: ゾーン作成と負荷計算」

---

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー
- ストーリー2.1: ゾーン作成
- ストーリー2.2: 外皮条件入力
- ストーリー2.3: 負荷計算結果確認

### 参照した機能要件
- REQ-203: HvacZoneNodeはゾーン名、用途、面積、天井高、在室密度を保持
- REQ-204: HvacZoneNodeは設計条件を保持
- REQ-205: HvacZoneNodeはペリメータセグメントの配列を保持
- REQ-206: 送風温度差のデフォルト値は10度C、上書き可能
- REQ-301: 冷房負荷、暖房負荷、必要風量を算出
- REQ-306: 負荷計算結果はperimeterLoadBreakdownを含む
- REQ-1403: 右パネルに選択ノードのプロパティを表示
- REQ-1505: 右パネルの表示フォーマットはPRDセクション21.5準拠

### 参照した非機能要件
- NFR-001: 300ノード規模で30fps以上
- NFR-202: 選択中ノードの諸元・計算結果が常に右パネルで見える

### 参照したEdgeケース
- EDGE-002: glazingRatioが0.0〜1.0の範囲外のバリデーション（スキーマ側で保証）

### 参照した受け入れ基準
- ゾーン基本情報が表示・編集可能
- designConditionsが表示・編集可能
- perimeterSegments一覧が表示される
- calcResult表示がPRDフォーマット準拠
- 全単体テストがpass

### 参照した設計文書
- **アーキテクチャ**: architecture.md「packages/editor拡張 > HVAC右パネル」セクション
- **データフロー**: dataflow.md「機能1: ゾーン作成と負荷計算」フロー図
- **型定義**: interfaces.ts の HvacZoneNode, HvacZoneCalcResult, DesignConditions, PerimeterSegment, PerimeterLoadBreakdownEntry
- **Zodスキーマ**: `packages/core/src/schema/nodes/hvac-zone.ts`, `packages/core/src/schema/nodes/hvac-shared.ts`

---

## 6. 実装対象ファイル

| # | ファイルパス | 内容 | 信頼性 |
|---|-------------|------|--------|
| 1 | `packages/editor/src/components/ui/panels/hvac/hvac-zone-panel.tsx` | ゾーン基本情報・設計条件・外皮条件の表示/編集パネル | 🔵 |
| 2 | `packages/editor/src/components/ui/panels/hvac/calc-result-panel.tsx` | 負荷計算結果表示パネル | 🔵 |
| 3 | `packages/editor/src/components/ui/panels/hvac/format-load.ts` | formatLoadユーティリティ関数 | 🔵 |

### テストファイル

| # | ファイルパス | 内容 |
|---|-------------|------|
| 1 | `packages/editor/src/components/ui/panels/hvac/__tests__/hvac-zone-panel.test.tsx` | HvacZonePanel単体テスト |
| 2 | `packages/editor/src/components/ui/panels/hvac/__tests__/calc-result-panel.test.tsx` | CalcResultPanel単体テスト |
| 3 | `packages/editor/src/components/ui/panels/hvac/__tests__/format-load.test.ts` | formatLoadユーティリティテスト |

---

## 7. テスト仕様サマリー

### 単体テスト

| # | テスト名 | 信頼性 | 概要 |
|---|---------|--------|------|
| 1 | ゾーン基本情報表示 | 🔵 | zoneName, usage, floorAreaが正しく表示される |
| 2 | 用途変更 | 🔵 | usage変更時にupdateNodeが正しく呼ばれる |
| 3 | calcResult未設定時の表示 | 🔵 | 「計算結果がありません」メッセージ表示 |
| 4 | calcResult表示（kW/m^3/h表記） | 🔵 | 17400W -> '17.4 kW', 4478 -> '4,478 m^3/h' |
| 5 | 方位別内訳表示 | 🔵 | テーブルに方位別行が表示される |
| 6 | formatLoad -- kW表記 | 🔵 | 17400 -> '17.4 kW' |
| 7 | formatLoad -- W表記 | 🔵 | 800 -> '800 W' |

### 統合テスト

| # | テスト名 | 信頼性 | 概要 |
|---|---------|--------|------|
| 1 | 選択→パネル表示 | 🔵 | ゾーン選択時にHvacZonePanel+CalcResultPanelが表示される |

---

## 8. 信頼性レベルサマリー

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 機能概要 | 4 | 0 | 0 | 4 |
| 入出力仕様 | 18 | 1 | 0 | 19 |
| 制約条件 | 10 | 3 | 0 | 13 |
| 使用例 | 7 | 1 | 0 | 8 |
| **合計** | **39** | **5** | **0** | **44** |

**信頼性分布**: 青 88.6% / 黄 11.4% / 赤 0%

**総合評価**: 高品質 -- 大多数の項目がEARS要件定義書・設計文書・既存実装に明確に裏付けられている。黄信号の5項目はUI詳細実装（カラーコーディング、アコーディオン/タブ切替、警告アイコン、デバウンス要否、formatLoad境界値）であり、実装時に容易に確定可能。
