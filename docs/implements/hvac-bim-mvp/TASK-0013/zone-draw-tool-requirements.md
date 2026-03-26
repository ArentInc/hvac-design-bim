# TDD要件定義書: ZoneDrawTool -- ゾーン境界描画ツール

**タスクID**: TASK-0013
**機能名**: zone-draw-tool
**要件名**: hvac-bim-mvp
**フェーズ**: Phase 2 - ゾーニング + 負荷計算
**作成日**: 2026-03-26

---

## 1. 機能の概要

### 何をする機能か 🔵
- フロア平面上で HvacZone のポリゴン境界をインタラクティブに描画するツール
- グリッドイベントを購読して頂点を収集し、Shoelace formula で面積をリアルタイム算出する
- ダブルクリックまたは Enter キーで確定し、`HvacZoneNode.parse()` -> `createNode()` でシーンに追加する

**参照したEARS要件**: REQ-202（ゾーン境界描画）, REQ-1601（面積リアルタイム表示）

### どのような問題を解決するか 🔵
- HVAC設計者がフロア平面上にゾーン（空調区画）を視覚的に定義する手段を提供する
- 描画しながら面積をリアルタイムで確認できることで、設計判断の迅速化を支援する

**参照したEARS要件**: REQ-202, REQ-1601, dataflow.md 機能1

### 想定されるユーザー 🔵
- 空調設備の基本設計を行う設計者
- 「1フロア・1系統・1ワンパス」で条件入力から負荷算定までを一筆書きで完了する利用者

**参照した設計文書**: architecture.md システム概要セクション

### システム内での位置づけ 🔵
- **パッケージ**: `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx`
- **ストア依存**: `useScene`（core）から `createNode` を取得、`useViewer`（viewer）から `levelId` を取得
- **ツール管理**: `ToolManager` から phase=`zone` / mode=`build` 時にアクティベート
- **データフロー**: ユーザー入力 -> ZoneDrawTool -> `createNode(HvacZoneNode)` -> `useScene` -> `dirtyNodes` -> `LoadCalcSystem` へカスケード

**参照した設計文書**: architecture.md tools section, dataflow.md 機能1

---

## 2. 入力・出力の仕様

### 入力パラメータ

#### 2.1 グリッドポインタイベント 🔵
- **イベント名**: `grid:pointerdown`（頂点追加）, `grid:pointermove`（カーソル追跡）, `grid:dblclick`（確定）
- **型**: `GridEvent`（`packages/core/src/events/bus.ts` で定義）
- **座標系**: XZ平面（Three.js座標系）。`e.point.x` / `e.point.z` を使用
- **スナップ**: グリッドスナップ済みの座標を取得

**参照したEARS要件**: REQ-202
**参照した設計文書**: CLAUDE.md イベントバスルール

#### 2.2 キーボードイベント 🔵
- **Enter キー**: ポリゴン確定（`grid:dblclick` と同等の動作）
- **Escape キー**: 描画キャンセル（頂点リセット）

**参照したEARS要件**: REQ-202

#### 2.3 HvacZoneNode 入力フィールド 🔵
- **boundary**: `[number, number][]` -- ポリゴン頂点座標（XY平面、2D）
  - XZ平面 -> XY平面への変換: `{ x: point.x, y: point.z }`
- **floorArea**: `number` -- Shoelace formula で算出（m2）
- **usage**: `ZoneUsage` -- デフォルト `'office_general'`
- **zoneName**: `string` -- 自動生成（例: `'HvacZone 1'`）
- **ceilingHeight**: `number` -- デフォルト 2.7 m（スキーマデフォルト値）
- **occupantDensity**: `number` -- デフォルト 0.15 人/m2（スキーマデフォルト値）
- **designConditions**: デフォルト `{ coolingSetpoint: 26, heatingSetpoint: 22, relativeHumidity: 50, supplyAirTempDiff: 10 }`
- **perimeterSegments**: `[]`（空配列、後から PerimeterEditTool で入力）
- **systemId**: `null`（未グルーピング）
- **calcResult**: `null`（計算前）

**参照したEARS要件**: REQ-201, REQ-202, REQ-203, REQ-204, REQ-205, REQ-206, REQ-207
**参照した設計文書**: `packages/core/src/schema/nodes/hvac-zone.ts`

### 出力値

#### 2.4 シーンストアへの出力 🔵
- **型**: `HvacZoneNode`（Zod parse 済み）
- **形式**: `createNode(parsedNode, levelId)` で Level の children に追加
- **ID形式**: `hvac_zone_${nanoid()}` -- 自動生成

**参照したEARS要件**: REQ-005, REQ-202
**参照した設計文書**: CLAUDE.md フラットノードモデル

#### 2.5 プレビュー出力（ローカル状態） 🔵
- **プレビューポリゴン**: `EDITOR_LAYER`（1）に描画、半透明青色
- **頂点マーカー**: 各頂点に青色球体（半径 0.1）
- **面積表示**: ポリゴン中心付近にリアルタイム表示（例: `"52.3 m2"`）
- **カーソル追跡線**: currentPoint までの仮辺を表示

**参照したEARS要件**: REQ-1601
**参照した設計文書**: CLAUDE.md ツールルール（プレビューはローカル状態）

### データフロー 🔵

```
グリッドイベント
  -> ZoneDrawTool（頂点収集 + 面積計算 + プレビュー描画）
  -> ポリゴン確定
  -> HvacZoneNode.parse({boundary, floorArea, usage, ...})
  -> useScene.createNode(node, levelId)
  -> dirtyNodes に hvacZoneId 追加
  -> LoadCalcSystem が dirty 検出 -> 負荷計算（後続タスク）
```

**参照した設計文書**: dataflow.md 機能1

---

## 3. 制約条件

### パフォーマンス要件 🔵
- **30fps 維持**: プレビュー描画は EDITOR_LAYER で軽量に行い、UI スレッドをブロックしない
- **リアルタイム面積算出**: 頂点追加のたびに Shoelace formula を即時再計算（O(n) で十分高速）

**参照したEARS要件**: NFR-001

### アーキテクチャ制約 🔵
- **ツール配置**: `packages/editor/src/components/tools/hvac/` に配置
- **Three.js API 直接呼び出し禁止**: プレビュー描画は JSX（R3F: React Three Fiber）で行う
- **Viewer 隔離**: `@pascal-app/viewer` からのインポートは `useViewer`（ストア参照）のみ許可。レンダラーやシステムからはインポートしない
- **プレビュー管理**: ツールのローカル状態（useState）で管理。シーンストアに保存しない

**参照したEARS要件**: REQ-008, REQ-009, REQ-010
**参照した設計文書**: CLAUDE.md ツールルール, Viewer隔離ルール

### イベントバス制約 🔵
- リスナー登録（`eventBus.on`）と解除（`eventBus.off`）は同一関数参照を使用すること
- `useEffect` 内で on/off を対にすること
- レンダラーはイベントを emit のみ、ツールはイベントを listen のみ

**参照した設計文書**: CLAUDE.md イベントバスルール

### Three.js レイヤ制約 🔵
- プレビューは `EDITOR_LAYER`（1）に描画
- `SCENE_LAYER`（0）は確定済みノードのレンダラーが使用
- `ZONE_LAYER`（2）はゾーンフロアフィルが使用

**参照した設計文書**: CLAUDE.md Three.js Layers

### コードスタイル制約 🔵
- Biome 準拠: 2スペースインデント、シングルクォート、セミコロンなし、末尾カンマ、100文字行幅
- インポート自動整理

**参照した設計文書**: CLAUDE.md コードスタイル

### 座標変換の注意 🔵
- グリッドイベント座標は Three.js の XZ 平面（y は高さ方向）
- HvacZoneNode の boundary は 2D の `[x, y]` 配列
- 変換: `{ x: event.point.x, y: event.point.z }`

**参照した設計文書**: TASK-0013 注意事項

---

## 4. 想定される使用例

### 4.1 基本的な使用パターン: 矩形ゾーン描画 🔵

**Given**: ZoneDrawTool がアクティブ（phase=zone, mode=build, tool=zone_draw）
**When**: ユーザーがグリッド上で4点をクリックし、ダブルクリックで確定
**Then**:
1. 4点の頂点がポリゴンとして収集される
2. Shoelace formula で面積がリアルタイム表示される
3. HvacZoneNode が useScene に追加される
4. 頂点がリセットされ、次のゾーン描画に備える

**参照したEARS要件**: REQ-202, REQ-1601

### 4.2 基本的な使用パターン: Enter キーで確定 🔵

**Given**: 3点以上の頂点が描画済み
**When**: ユーザーが Enter キーを押す
**Then**: ダブルクリックと同様にポリゴンが確定される

**参照したEARS要件**: REQ-202

### 4.3 基本的な使用パターン: Escape キーでキャンセル 🔵

**Given**: 描画中（1点以上の頂点が追加済み）
**When**: ユーザーが Escape キーを押す
**Then**: 頂点がリセットされ、プレビューがクリアされる

**参照した設計文書**: TASK-0013 UI/UX要件

### 4.4 エッジケース: 面積0ポリゴンの拒否 🔵

**Given**: 一直線上の3頂点（例: `[{0,0}, {5,0}, {10,0}]`）
**When**: ダブルクリックまたは Enter で確定しようとする
**Then**: 面積が 0 以下であるため createNode は呼ばれず、ゾーンは作成されない

**参照したEARS要件**: EDGE-001

### 4.5 エッジケース: 頂点不足 🔵

**Given**: 2点以下の頂点のみ
**When**: ダブルクリックまたは Enter で確定しようとする
**Then**: 頂点数 < 3 であるため確定処理は無視される

**参照したEARS要件**: EDGE-001（面積0以下拒否の一般化）

### 4.6 エッジケース: 右クリックで直前の頂点 undo 🟡

**Given**: 3点以上の頂点が描画済み
**When**: 右クリック
**Then**: 直前に追加した頂点が除去され、プレビューが更新される

**参照した設計文書**: TASK-0013 UI/UX要件（右クリックundoの詳細仕様はタスクファイルのみで言及）

### 4.7 エッジケース: 最小面積閾値 🟡

**Given**: 非常に小さいポリゴン（面積 < 0.1 m2 程度）
**When**: 確定しようとする
**Then**: 面積が閾値未満の場合の挙動（拒否 or 警告）は要検討

**参照した設計文書**: TASK-0013 セクション6（最小面積閾値は推測）

---

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー
- ストーリー 2.1: ゾーン境界描画
- ストーリー 2.2: 用途・条件入力（後続タスク TASK-0014 で対応）

### 参照した機能要件
- **REQ-005**: useScene ストアを通じた CRUD 操作、dirtyNodes パターン準拠
- **REQ-201**: HvacZoneNode を既存 ZoneNode とは独立した別ノードタイプとして実装
- **REQ-202**: フロア平面上で HvacZone の境界をポリゴンとして描画
- **REQ-203**: HvacZoneNode のフィールド定義（zoneName, usage, floorArea, ceilingHeight, occupantDensity）
- **REQ-204**: 設計条件（designConditions）のデフォルト値
- **REQ-205**: perimeterSegments の配列保持（本ツールでは空配列で初期化）
- **REQ-206**: supplyAirTempDiff デフォルト 10 度C
- **REQ-207**: systemId は null（未グルーピング）で初期化

### 参照した非機能要件
- **NFR-001**: 30fps 維持、300ノード規模での操作
- **NFR-101**: Zod スキーマ検証を通ること（HvacZoneNode.parse）

### 参照した Edge ケース
- **EDGE-001**: ゾーン面積が 0 以下の場合、作成を拒否しエラー表示

### 参照した受け入れ基準
- グリッド pointerdown イベントで頂点が収集される
- Shoelace formula で面積がリアルタイム算出・表示される
- ダブルクリックまたは Enter キーでポリゴンが確定される
- 確定時に `HvacZoneNode.parse()` -> `createNode(node, levelId)` が呼ばれる
- プレビューポリゴンが `EDITOR_LAYER`（1）に表示される
- 面積 0 以下のポリゴンは拒否される

### 参照した設計文書
- **アーキテクチャ**: architecture.md tools section, packages/editor 拡張セクション
- **データフロー**: dataflow.md 機能1（ゾーン作成と負荷計算フロー）
- **型定義**: interfaces.ts HvacZoneNode, DesignConditions, ZoneUsage, PerimeterSegment
- **既存実装パターン**: `packages/editor/src/components/tools/zone/zone-tool.tsx`（既存 ZoneTool の構造を参考）
- **スキーマ定義**: `packages/core/src/schema/nodes/hvac-zone.ts`（HvacZoneNode Zod スキーマ）
- **共有型**: `packages/core/src/schema/nodes/hvac-shared.ts`（ZoneUsage, Orientation, PerimeterSegment）
- **定数**: `packages/editor/src/lib/constants.ts`（EDITOR_LAYER = 1）

---

## 6. 実装対象ファイル一覧

| # | ファイルパス | 内容 | 信頼性 |
|---|-------------|------|--------|
| 1 | `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx` | ゾーン描画ツール本体 | 🔵 |
| 2 | `packages/core/src/utils/polygon-area.ts` | Shoelace formula ユーティリティ関数（純粋関数） | 🔵 |
| 3 | `packages/editor/src/components/tools/tool-manager.tsx` | ToolManager への zone_draw 登録（既存ファイルへの追加） | 🔵 |

---

## 7. テスト対象の分離

### 純粋関数（ユニットテスト対象） 🔵
- `calculatePolygonArea(vertices: { x: number; y: number }[]): number`
  - Shoelace formula による面積算出
  - 頂点不足（< 3）の場合 0 を返す
  - 一直線上の頂点の場合 0 を返す

### ツールロジック（統合テスト対象） 🔵
- グリッドイベントによる頂点収集
- 確定処理（HvacZoneNode.parse -> createNode）
- 面積 0 以下の拒否
- Escape キーによるキャンセル

---

## 8. 信頼性レベルサマリー

| # | 要件項目 | 信頼性 | 根拠 |
|---|---------|--------|------|
| 1 | 機能概要 | 🔵 | REQ-202, dataflow.md 機能1に明示 |
| 2 | グリッドイベント入力仕様 | 🔵 | 既存ツールパターン（zone-tool.tsx）+ イベントバスルール |
| 3 | HvacZoneNode 入力フィールド | 🔵 | hvac-zone.ts スキーマ定義 + interfaces.ts 型定義 |
| 4 | プレビュー出力仕様 | 🔵 | CLAUDE.md ツールルール + EDITOR_LAYER 定数 |
| 5 | Shoelace formula 面積算出 | 🔵 | REQ-1601 に明示、数学的に確定 |
| 6 | ダブルクリック/Enter 確定 | 🔵 | REQ-202 に明示 |
| 7 | 面積 0 以下拒否 | 🔵 | EDGE-001 に明示 |
| 8 | アーキテクチャ制約 | 🔵 | CLAUDE.md, REQ-008/009/010 |
| 9 | 右クリック頂点 undo | 🟡 | TASK-0013 UI/UX要件のみで言及、EARS要件に明示なし |
| 10 | 最小面積閾値 | 🟡 | TASK-0013 セクション6 で検討事項として言及、具体値は未確定 |

**総合評価**: 🔵（8/10 項目が青信号、2項目が黄信号。主要機能は EARS 要件定義書とデータフロー設計に明確に裏付けられている）
