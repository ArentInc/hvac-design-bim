# TDD Refactorフェーズ記録: PerimeterEditTool -- 外皮条件入力

**タスクID**: TASK-0014
**要件名**: hvac-bim-mvp
**機能名**: PerimeterEditTool -- 外皮条件入力
**フェーズ**: Refactor（品質改善）
**実施日**: 2026-03-26

---

## 1. リファクタリング概要

### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `packages/core/src/systems/hvac/perimeter-detection.ts` | 更新 | 重複計算統合、型安全性向上 |
| `packages/core/src/systems/hvac/__tests__/perimeter-detection.test.ts` | 更新 | noUncheckedIndexedAccess 対応 |

### テスト結果（変更後）

- **packages/core 全テスト**: 17ファイル 113件 全pass（継続）

---

## 2. セキュリティレビュー

### 評価結果

| 観点 | 評価 | 詳細 |
|---|---|---|
| 入力値検証 | ✅ 強化 | `zoneBoundary.length < 3` チェックを追加（防御的実装） |
| 数値オーバーフロー | ✅ 問題なし | 浮動小数点数の通常演算のみ。IEEE754 範囲内 |
| 外部データ漏洩 | ✅ 問題なし | 純関数。外部副作用なし |
| SQLインジェクション | ✅ 該当なし | DB操作なし |
| XSS | ✅ 該当なし | UI コンポーネントではない |

**セキュリティ評価: ✅ 重大な脆弱性なし**

---

## 3. パフォーマンスレビュー

### 計算量分析

| 処理 | 計算量 | 評価 |
|---|---|---|
| `detectPerimeterSegments` 全体 | O(E × W) | E=ゾーン辺数、W=外壁数。現実的スケールで問題なし |
| `extractZoneEdges` | O(E) | 線形処理 |
| `calcSegmentOverlap` | O(1) | Math.sqrt 1回のみ |

### 改善内容

**Green フェーズ**: `areCollinear` + `calcOverlapLength1D` の2関数呼び出し
- Math.sqrt: 2回
- dx/dy 計算: 2回重複

**Refactor フェーズ**: `calcSegmentOverlap` に統合
- Math.sqrt: 1回（半減）
- dx/dy 計算: 1回のみ

**パフォーマンス評価: ✅ 重大な性能課題なし。冗長な計算を削減**

---

## 4. 改善ポイント詳細

### 改善1: 重複計算の統合（DRY原則）🟡

**Before（Green フェーズ）**:
```typescript
// areCollinear と calcOverlapLength1D の両方で同じ計算を実行
function areCollinear(a0, a1, b0, b1) {
  const dx = a1[0] - a0[0]  // ← 重複
  const dy = a1[1] - a0[1]  // ← 重複
  const len = Math.sqrt(...)  // ← 重複（Math.sqrt 1回目）
  // ...
}
function calcOverlapLength1D(a0, a1, b0, b1) {
  const dx = a1[0] - a0[0]  // ← 重複
  const dy = a1[1] - a0[1]  // ← 重複
  const len = Math.sqrt(...)  // ← 重複（Math.sqrt 2回目）
  // ...
}
```

**After（Refactor フェーズ）**:
```typescript
// calcSegmentOverlap に統合: dx/dy/len を1回だけ計算
function calcSegmentOverlap(edgeA: Edge2D, edgeB: Edge2D): number {
  const dx = a1[0] - a0[0]
  const dy = a1[1] - a0[1]
  const len = Math.sqrt(dx * dx + dy * dy)  // ← 1回のみ
  // コリニア判定 → 1D 投影 → 重なり計算 を連続して実行
}
```

### 改善2: import type の適用（バンドルサイズ削減）🔵

**Before**:
```typescript
import { PerimeterSegment } from '../../schema/nodes/hvac-shared'
```

**After**:
```typescript
import type { PerimeterSegment } from '../../schema/nodes/hvac-shared'
// PerimeterSegment は型推論にのみ使用 → 実行時バンドルに含まれない
```

### 改善3: 型エイリアス追加（可読性向上）🔵

```typescript
// 内部型エイリアスで関数シグネチャが読みやすくなる
type Point2D = [number, number]
type Edge2D = [Point2D, Point2D]

// Before: 複雑な型
function calcOverlapLength1D(a0: [number, number], a1: [number, number], ...): number

// After: 明瞭な型
function calcSegmentOverlap(edgeA: Edge2D, edgeB: Edge2D): number
```

### 改善4: 防御的入力検証の追加（セキュリティ強化）🟡

```typescript
// zoneBoundary が三角形未満（3頂点未満）は有効なポリゴンではない
if (zoneBoundary.length < 3) {
  return []
}
```

### 改善5: noUncheckedIndexedAccess 対応（型安全性）🔵

Green フェーズで発生していた型エラーを修正:
- 実装ファイル: `wall.vertices[0]!.x` のように `!` アサーションを適用（`length >= 2` の事前チェック済み）
- テストファイル: `result[0]` を `const seg0 = result[0]!` として型安全に変数化

---

## 5. 改善後コードの全文

```typescript
// packages/core/src/systems/hvac/perimeter-detection.ts
// （189行、500行以下）

import type { WallMetadata } from '../../loaders/architecture-metadata'
import type { z } from 'zod'
import type { PerimeterSegment } from '../../schema/nodes/hvac-shared'

type PerimeterSegmentType = z.infer<typeof PerimeterSegment>
const EPSILON = 0.001
type Point2D = [number, number]
type Edge2D = [Point2D, Point2D]

export function detectPerimeterSegments(
  zoneBoundary: Point2D[],
  architectureWalls: WallMetadata[],
  wallHeight: number,
): PerimeterSegmentType[]

function extractZoneEdges(boundary: Point2D[]): Edge2D[]

function calcSegmentOverlap(edgeA: Edge2D, edgeB: Edge2D): number
```

---

## 6. テスト実行結果

```
RUN v4.1.1

 Test Files  17 passed (17)
       Tests  113 passed (113)
    Duration  964ms

✓ TC-N01: 完全一致する外壁面のセグメントが検出される
✓ TC-N02: 部分交差する外壁面の交差部分のみセグメントが生成される
✓ TC-N03: ゾーン境界と離れた外壁面は空配列を返す
✓ TC-N04: 複数方位の外壁面が同時に検出される（南面・東面）
✓ TC-B06: 交差長がイプシロン（0.001m）以下の場合にセグメントが生成されない
✓ TC-B07: 建築参照の外壁面が空配列の場合に空配列が返る
✓ TC-N04b: 南面・北面の対向する外壁面が同時に検出される
✓ TC-N01b: wallArea が 交差長 × wallHeight で計算される
✓ TC-N04c: 全4方向（南・東・北・西）の外壁面が同時に検出される
```

---

## 7. 型チェック結果

TASK-0014 関連ファイルの型エラー: **0件**

**注記**: `src/utils/polygon-area.ts` に既存の型エラー4件あり（TASK-0014 スコープ外の既存問題）

---

## 8. 品質評価

| 項目 | Before（Green） | After（Refactor） |
|---|---|---|
| ファイルサイズ | 203行 | 190行 |
| Math.sqrt 呼び出し回数 | 2回/外壁 | 1回/外壁 |
| 関数数 | 4（detect, extract, areCollinear, calcOverlap1D） | 3（detect, extract, calcSegmentOverlap） |
| 型安全性 | 型エラー 6件 | 型エラー 0件 |
| import type | ❌ 値として import | ✅ 型のみ import |
| 入力検証 | architectureWalls のみ | architectureWalls + zoneBoundary |
| Biomeチェック | ❌ 問題あり | ✅ クリア |

**総合評価: ✅ 高品質**

---

## 9. 追加リファクタリング（Biome対応）

### 改善6: biome-ignore suppressionの削除（コード品質向上）🔵

**問題**: `biome-ignore lint/style/noNonNullAssertion` コメントがBiomeに未対応のルール（suppressions/unused エラー）として検出されていた。

**対処**: コメントを削除。`vertices.length >= 2` の事前チェックによる型安全性の根拠は通常コメントとして保持。

### 改善7: import順序の整理（Biome organizeImports対応）🔵

**問題**: `import type { WallMetadata }` と `import type { z }` の順序がBiomeの `organizeImports` 規則に反していた。

**対処**: `import type { z } from 'zod'`（外部パッケージ）を先に、`import type { WallMetadata }` および `import type { PerimeterSegment }`（内部パス）を後にする正規順序に修正。

### 改善8: 長行のフォーマット対応（100文字制限）🔵

**問題**: `wallEnd` の定義行が100文字を超過していた。

**対処**: 配列要素を複数行に分割:
```typescript
// Before: 100文字超過
const wallEnd: Point2D = [wall.vertices[wall.vertices.length - 1]!.x, wall.vertices[wall.vertices.length - 1]!.y]

// After: フォーマット準拠
const wallEnd: Point2D = [
  wall.vertices[wall.vertices.length - 1]!.x,
  wall.vertices[wall.vertices.length - 1]!.y,
]
```

### テスト実行結果（Biome対応後）

```
Test Files  17 passed (17)
      Tests  113 passed (113)
   Duration  1.31s

Biome check: クリア（TASK-0014スコープ外の既存エラーを除く）
```
