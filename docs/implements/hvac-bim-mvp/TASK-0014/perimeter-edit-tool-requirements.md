# TDD用要件定義書: PerimeterEditTool -- 外皮条件入力

**タスクID**: TASK-0014
**要件名**: hvac-bim-mvp
**機能名**: PerimeterEditTool -- 外皮条件入力
**フェーズ**: Phase 2 - ゾーニング + 負荷計算
**推定工数**: 8時間
**作成日**: 2026-03-26

---

## 1. 機能の概要

### 1.1 何をする機能か 🔵

**信頼性**: 🔵 *REQ-205, REQ-208, REQ-209 に明示的記載*

方位別外壁面データ（perimeterSegments）を HvacZoneNode に入力するツール。建築参照データの外壁面とゾーン境界ポリゴンの交差検出による半自動入力と、建築参照が存在しない場合の手動入力フォールバックの両方を提供する。入力結果は `HvacZoneNode.perimeterSegments` フィールドに保存され、後続の負荷計算（TASK-0015: LoadCalcSystem）の入力データとなる。

### 1.2 どのような問題を解決するか 🔵

**信頼性**: 🔵 *PRD セクション 11.2 v2, REQ-302, REQ-303 より*

- 負荷計算に必要な外皮条件（方位、壁面積、ガラス面積比）を、ユーザーが効率的に入力できるようにする
- 建築参照データが存在する場合は交差検出で半自動入力し、入力工数を削減する
- 方位別日射補正係数（REQ-303: S=1.0, SE/SW=1.1, E/W=1.2, NE/NW=0.8, N=0.6）を正しく適用するために、方位情報を正確に取得する

### 1.3 想定されるユーザー 🔵

**信頼性**: 🔵 *ユーザストーリー 2.2 より*

HVAC 基本設計を行う設備設計者。HVAC モード、zone フェーズで作業中。

### 1.4 システム内での位置づけ 🔵

**信頼性**: 🔵 *architecture.md, dataflow.md のゾーン作成フローより*

- **パッケージ**: `packages/editor`（ツール配置ルールに準拠）
- **配置パス**: `packages/editor/src/components/tools/hvac/perimeter-edit-tool.tsx`
- **ロジック配置**: 交差検出アルゴリズムは純関数として `packages/core/src/systems/hvac/perimeter-detection.ts` に配置（計算ロジックは core に配置するルール）
- **ToolManager 連携**: phase=zone, mode=edit, tool=perimeter_edit 時にアクティベート
- **データフロー**: PerimeterEditTool → updateNode(hvacZoneId, {perimeterSegments}) → markDirty → LoadCalcSystem が dirty 検出 → 負荷再計算

**参照した EARS 要件**: REQ-205, REQ-208, REQ-209
**参照した設計文書**: architecture.md（ディレクトリ構造、packages/editor/src/components/tools/hvac/）、dataflow.md（機能1: ゾーン作成と負荷計算）

---

## 2. 入力・出力の仕様

### 2.1 入力パラメータ 🔵

**信頼性**: 🔵 *interfaces.ts の PerimeterSegment, HvacZoneNode 定義、architecture-loader.ts の ArchitectureWall 型より*

#### PerimeterEditTool コンポーネント Props

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| zoneId | string | Yes | 編集対象の HvacZoneNode ID（`hvac_zone_${string}` 形式） |

#### 交差検出関数 detectPerimeterSegments

| パラメータ | 型 | 説明 |
|---|---|---|
| zoneBoundary | `[number, number][]` | HvacZoneNode.boundary（2D ポリゴン頂点座標） |
| architectureWalls | `WallMetadata[]` | 建築参照の外壁面メタデータ（`packages/core/src/loaders/architecture-metadata.ts`） |
| wallHeight | number | 壁高さ（m）。HvacZoneNode.ceilingHeight を使用 |

**WallMetadata 型**（既存実装: `packages/core/src/loaders/architecture-metadata.ts`）:

```typescript
interface WallMetadata {
  wallId: string
  orientation: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  wallArea: number
  glazingRatio: number
  vertices: { x: number; y: number; z: number }[]
}
```

#### 手動入力フォーム

| フィールド | 型 | 範囲 | デフォルト | 説明 |
|---|---|---|---|---|
| orientation | Orientation enum | N, NE, E, SE, S, SW, W, NW | 'S' | 方位（8方位ドロップダウン） |
| wallArea | number | >= 0 | 0 | 壁面積（m2） |
| glazingRatio | number | 0.0 ~ 1.0 | 0.3 | ガラス面積比（ステップ 0.1） |

### 2.2 出力値 🔵

**信頼性**: 🔵 *interfaces.ts の PerimeterSegment 定義、hvac-shared.ts の PerimeterSegment Zod スキーマより*

#### PerimeterSegment（既存スキーマ: `packages/core/src/schema/nodes/hvac-shared.ts`）

```typescript
const PerimeterSegment = z.object({
  orientation: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
  wallArea: z.number(),
  glazingRatio: z.number().min(0).max(1),
})
```

#### 保存先

- `useScene.updateNode(hvacZoneId, { perimeterSegments: PerimeterSegment[] })`
- updateNode 内部で自動的に `dirtyNodes.add(hvacZoneId)` が実行される

### 2.3 入出力の関係性 🔵

**信頼性**: 🔵 *dataflow.md 機能1 のシーケンス図より*

```
[半自動モード]
ゾーン境界 + 建築参照外壁面 → detectPerimeterSegments() → PerimeterSegment[] → ユーザー確認/修正 → updateNode

[手動モード]
ユーザー入力（方位 + 壁面積 + ガラス面積比）→ PerimeterSegment[] → バリデーション → updateNode
```

### 2.4 データフロー 🔵

**信頼性**: 🔵 *dataflow.md 機能1 より*

1. ユーザーが HvacZoneNode を選択し、perimeter_edit ツールをアクティベート
2. 建築参照データの有無を判定
   - 有: `detectPerimeterSegments()` で半自動入力 → 結果をテーブル表示
   - 無: 手動入力フォームを表示
3. ユーザーが結果を確認・修正
4. 保存ボタン押下 → Zod バリデーション → `updateNode(hvacZoneId, { perimeterSegments })`
5. `markDirty(hvacZoneId)` が自動実行
6. LoadCalcSystem（TASK-0015）が dirty 検出 → 負荷再計算

**参照した EARS 要件**: REQ-205, REQ-208, REQ-209
**参照した設計文書**: interfaces.ts（PerimeterSegment, HvacZoneNode）、architecture-metadata.ts（WallMetadata）、dataflow.md（機能1）

---

## 3. 制約条件

### 3.1 パフォーマンス要件 🔵

**信頼性**: 🔵 *NFR-001, NFR-002 より*

- 交差検出は同期実行で問題ない（1フロアの外壁面数は通常数十程度）
- バリデーションは入力時にリアルタイムで実行（体感遅延なし）
- updateNode 後の dirty 検出 → 負荷再計算は非同期（5秒以内）

### 3.2 アーキテクチャ制約 🔵

**信頼性**: 🔵 *CLAUDE.md ツールルール、Viewer 隔離ルールより*

- **ツール配置**: `packages/editor/src/components/tools/hvac/` に配置
- **Three.js 禁止**: ツールは Three.js API を直接呼び出してはならない
- **計算ロジック分離**: 交差検出ロジックは `packages/core` に配置（純関数として実装）
- **Viewer 隔離**: `@pascal-app/viewer` からのインポート禁止（ツールルール準拠）。ただし `useViewer` の selection 参照は例外的に許可（TASK-0013 の実装パターンに従う）

### 3.3 スキーマ制約 🔵

**信頼性**: 🔵 *hvac-shared.ts の既存 PerimeterSegment スキーマより*

- `PerimeterSegment` スキーマは既に `packages/core/src/schema/nodes/hvac-shared.ts` に定義済み
- `glazingRatio` は `z.number().min(0).max(1)` で制約済み（EDGE-002）
- `wallArea` は `z.number()`（現状 nonnegative 制約なし、要確認）
- `orientation` は 8方位 enum で制約済み

### 3.4 互換性要件 🔵

**信頼性**: 🔵 *CLAUDE.md undo 対応、既存 updateNode パターンより*

- `updateNode` 経由のため、Zundo 50-step undo/redo が自動適用
- 既存の IndexedDB 永続化パターンと互換

### 3.5 2D 交差判定の精度要件 🟡

**信頼性**: 🟡 *TASK-0014 注意事項から妥当な推測*

- 交差検出は 2D（XY 平面）で実施。3D 交差は不要
- 浮動小数点演算の誤差を考慮し、交差長さの比較ではイプシロン（0.001m）を使用
- ゾーン境界の各辺と外壁面の各辺の 2D ラインセグメント交差判定

**参照した EARS 要件**: NFR-001, NFR-002, REQ-007, REQ-008, REQ-010, EDGE-002
**参照した設計文書**: architecture.md（アーキテクチャ制約）、hvac-shared.ts（PerimeterSegment スキーマ）

---

## 4. 想定される使用例

### 4.1 基本パターン1: 半自動入力フロー 🔵

**信頼性**: 🔵 *REQ-208, dataflow.md 機能1 より*

- **Given**: 建築参照データが読み込まれ、HvacZoneNode が存在する
- **When**: ユーザーが HvacZoneNode を選択し、perimeter_edit ツールをアクティベート
- **Then**:
  - `detectPerimeterSegments()` が自動実行
  - ゾーン境界と外壁面の交差が検出され、perimeterSegments がテーブル表示
  - ユーザーは結果を確認し、必要に応じて修正
  - 保存ボタンで `updateNode` が実行される

### 4.2 基本パターン2: 手動入力フロー 🔵

**信頼性**: 🔵 *REQ-209 より*

- **Given**: 建築参照データなし、HvacZoneNode が存在する
- **When**: ユーザーが HvacZoneNode を選択し、perimeter_edit ツールをアクティベート
- **Then**:
  - 手動入力フォームが表示される
  - ユーザーが「外壁面を追加」ボタンで行を追加
  - 方位（ドロップダウン）、壁面積（数値）、ガラス面積比（数値 0.0~1.0）を入力
  - 保存ボタンで `updateNode` が実行される

### 4.3 交差検出: 完全一致 🔵

**信頼性**: 🔵 *REQ-208 の交差検出仕様より*

- **Given**: 10m x 10m のゾーン境界と、南面に一致する 10m 幅の外壁
- **When**: `detectPerimeterSegments(boundary, walls)` を呼び出す
- **Then**: `orientation='S', wallArea=10 x wallHeight` のセグメントが 1 件返却される

### 4.4 交差検出: 部分交差 🔵

**信頼性**: 🔵 *REQ-208 より*

- **Given**: 10m x 10m のゾーン境界と、5m 分だけ重なる外壁
- **When**: `detectPerimeterSegments(boundary, walls)` を呼び出す
- **Then**: `wallArea=5 x wallHeight` のセグメントが返却される

### 4.5 交差検出: 交差なし 🔵

**信頼性**: 🔵 *REQ-208 より*

- **Given**: ゾーン境界と完全に離れた外壁
- **When**: `detectPerimeterSegments(boundary, walls)` を呼び出す
- **Then**: 空配列が返却される

### 4.6 エッジケース: EDGE-002 glazingRatio 範囲外 🔵

**信頼性**: 🔵 *EDGE-002 として定義*

- **Given**: `glazingRatio=1.5` の PerimeterSegment
- **When**: `PerimeterSegment.safeParse(segment)` を呼び出す
- **Then**: `success=false` が返却される

### 4.7 エッジケース: glazingRatio 境界値 🔵

**信頼性**: 🔵 *EDGE-002 の境界値テスト*

- **Given**: `glazingRatio=0.0` および `glazingRatio=1.0`
- **When**: `PerimeterSegment.safeParse(segment)` を呼び出す
- **Then**: 両方とも `success=true` が返却される

### 4.8 エッジケース: 空の perimeterSegments で保存 🟡

**信頼性**: 🟡 *TASK-0015 との連携から妥当な推測*

- **Given**: perimeterSegments が空配列
- **When**: 保存ボタンを押下
- **Then**: `updateNode(hvacZoneId, { perimeterSegments: [] })` が実行される（外皮負荷 0 として計算される）

### 4.9 エッジケース: wallArea が 0 の場合 🟡

**信頼性**: 🟡 *バリデーション仕様の妥当な推測*

- **Given**: `wallArea=0` の PerimeterSegment
- **When**: バリデーション
- **Then**: スキーマ上は許容（`z.number()` で nonnegative 制約なし）。ただし壁面積 0 は実質的に外皮負荷 0 となる

**参照した EARS 要件**: REQ-208, REQ-209, EDGE-002
**参照した設計文書**: dataflow.md（機能1）

---

## 5. EARS 要件・設計文書との対応関係

### 参照したユーザストーリー

- ストーリー 2.2: ゾーン外皮条件入力

### 参照した機能要件

- **REQ-205**: HvacZoneNode はペリメータセグメント（方位、壁面積、ガラス面積比）の配列を保持しなければならない 🔵
- **REQ-208**: ゾーン作成時に建築参照モデルの外壁面とゾーン辺の交差を検出できた場合、perimeterSegments に半自動入力しなければならない 🔵
- **REQ-209**: 半自動検出ができない場合、方位別手動入力 UI を提供しなければならない 🔵

### 参照した非機能要件

- **NFR-001**: 100~300 ノード規模で 30fps 以上
- **NFR-002**: 単発再計算は 5 秒以内
- **NFR-101**: 保存データが Zod スキーマ検証を通ること
- **NFR-203**: 主要操作は 3 クリック程度で開始できること

### 参照した Edge ケース

- **EDGE-002**: glazingRatio が 0.0~1.0 の範囲外の場合、バリデーションエラーを表示すること 🔵

### 参照した受け入れ基準

- 建築参照外壁面とゾーン境界の交差検出が動作し、perimeterSegments が半自動入力される
- 手動入力 UI で方位選択 + 壁面積 + ガラス面積比が入力可能
- glazingRatio 0.0~1.0 のバリデーションが機能する
- `updateNode(hvacZoneId, {perimeterSegments})` → markDirty が実行される

### 参照した設計文書

- **アーキテクチャ**: architecture.md（ディレクトリ構造、計算とレンダリングの分離）
- **データフロー**: dataflow.md（機能1: ゾーン作成と負荷計算シーケンス）
- **型定義**: interfaces.ts（PerimeterSegment, HvacZoneNode, WallMetadata, Orientation）
- **既存スキーマ**: `packages/core/src/schema/nodes/hvac-shared.ts`（PerimeterSegment Zod スキーマ）
- **既存スキーマ**: `packages/core/src/schema/nodes/hvac-zone.ts`（HvacZoneNode Zod スキーマ）
- **既存ローダー**: `packages/core/src/loaders/architecture-loader.ts`（Architecture, ArchitectureWall 型）
- **既存メタデータ**: `packages/core/src/loaders/architecture-metadata.ts`（WallMetadata, extractWallMetadata）
- **既存ツール**: `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx`（TASK-0013 の実装パターン）

---

## 6. 実装ファイル構成

### 6.1 新規作成ファイル

| ファイル | パッケージ | 責務 |
|---|---|---|
| `packages/core/src/systems/hvac/perimeter-detection.ts` | core | 2D 交差検出アルゴリズム（純関数） |
| `packages/editor/src/components/tools/hvac/perimeter-edit-tool.tsx` | editor | 外皮条件編集 UI コンポーネント |

### 6.2 テストファイル

| ファイル | 対象 |
|---|---|
| `packages/core/src/systems/hvac/__tests__/perimeter-detection.test.ts` | 交差検出アルゴリズム |
| `packages/core/src/schema/nodes/__tests__/perimeter-segment-validation.test.ts` | PerimeterSegment バリデーション |
| `packages/editor/src/components/tools/hvac/__tests__/perimeter-edit-tool.test.tsx` | UI コンポーネント |

### 6.3 既存ファイル参照（変更なし）

| ファイル | 参照目的 |
|---|---|
| `packages/core/src/schema/nodes/hvac-shared.ts` | PerimeterSegment スキーマ（既存） |
| `packages/core/src/schema/nodes/hvac-zone.ts` | HvacZoneNode スキーマ（既存） |
| `packages/core/src/loaders/architecture-loader.ts` | Architecture 型（既存） |
| `packages/core/src/loaders/architecture-metadata.ts` | WallMetadata 型、extractWallMetadata（既存） |
| `packages/core/src/store/use-scene.ts` | useScene（updateNode） |

---

## 7. 信頼性レベルサマリー

| # | 項目 | 信頼性 | 根拠 |
|---|---|---|---|
| 1 | 機能概要 | 🔵 | REQ-205, REQ-208, REQ-209 に明示的記載 |
| 2 | 入力パラメータ | 🔵 | interfaces.ts, hvac-shared.ts, architecture-metadata.ts の型定義より |
| 3 | 出力仕様 | 🔵 | PerimeterSegment スキーマが既に実装済み |
| 4 | データフロー | 🔵 | dataflow.md 機能1 のシーケンス図より |
| 5 | 半自動入力フロー | 🔵 | REQ-208 に明示的記載 |
| 6 | 手動入力フロー | 🔵 | REQ-209 に明示的記載 |
| 7 | glazingRatio バリデーション | 🔵 | EDGE-002 として定義、スキーマ実装済み |
| 8 | updateNode → markDirty | 🔵 | dirty node システム準拠（CLAUDE.md） |
| 9 | 交差検出精度（イプシロン） | 🟡 | TASK-0014 注意事項から妥当な推測 |
| 10 | 空 perimeterSegments 保存 | 🟡 | TASK-0015 連携から妥当な推測 |
| 11 | wallArea=0 の扱い | 🟡 | バリデーション仕様の妥当な推測 |

**総合評価**: 🔵（8/11 項目が青信号 -- 主要要件は全て EARS 要件定義書・設計文書に裏付けあり）
