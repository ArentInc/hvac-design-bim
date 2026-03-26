# TDD Greenフェーズ記録: PerimeterEditTool -- 外皮条件入力

**タスクID**: TASK-0014
**要件名**: hvac-bim-mvp
**機能名**: PerimeterEditTool -- 外皮条件入力
**フェーズ**: Green（最小実装）
**実装日**: 2026-03-26

---

## 1. 実装概要

### 実装ファイル

| ファイル | 行数 | 状態 |
|---|---|---|
| `packages/core/src/systems/hvac/perimeter-detection.ts` | 203行 | 新規作成 |

### テスト結果

- **perimeter-detection.test.ts**: 9件 全pass
- **perimeter-segment-validation.test.ts**: 12件 全pass（既存スキーマの回帰テスト）
- **packages/core 全テスト**: 17ファイル 113件 全pass

---

## 2. 実装ファイル全文

### packages/core/src/systems/hvac/perimeter-detection.ts

```typescript
/**
 * 【機能概要】: ゾーン境界ポリゴンと建築参照外壁面の 2D 交差検出
 * 【実装方針】: 2D XY 平面上でゾーン境界の各辺と外壁ラインセグメントの
 *   コリニアな重なり（1D 投影交差）を計算し、PerimeterSegment 配列を返す。
 * 【テスト対応】: TASK-0014 TC-N01〜TC-N04c, TC-B06, TC-B07
 * 🔵 信頼性レベル: REQ-208、TASK-0014 実装詳細に明示的記載
 */

import type { WallMetadata } from '../../loaders/architecture-metadata'
import { PerimeterSegment } from '../../schema/nodes/hvac-shared'
import type { z } from 'zod'

type PerimeterSegmentType = z.infer<typeof PerimeterSegment>

const EPSILON = 0.001

export function detectPerimeterSegments(
  zoneBoundary: [number, number][],
  architectureWalls: WallMetadata[],
  wallHeight: number,
): PerimeterSegmentType[] {
  if (architectureWalls.length === 0) return []
  const zoneEdges = extractZoneEdges(zoneBoundary)
  const result: PerimeterSegmentType[] = []

  for (const wall of architectureWalls) {
    if (wall.vertices.length < 2) continue
    const wallStart: [number, number] = [wall.vertices[0].x, wall.vertices[0].y]
    const wallEnd: [number, number] = [wall.vertices[wall.vertices.length - 1].x, wall.vertices[wall.vertices.length - 1].y]

    let maxOverlap = 0
    for (const edge of zoneEdges) {
      if (!areCollinear(edge[0], edge[1], wallStart, wallEnd)) continue
      const overlapLength = calcOverlapLength1D(edge[0], edge[1], wallStart, wallEnd)
      if (overlapLength > maxOverlap) maxOverlap = overlapLength
    }

    if (maxOverlap <= EPSILON) continue
    result.push({
      orientation: wall.orientation,
      wallArea: maxOverlap * wallHeight,
      glazingRatio: wall.glazingRatio,
    })
  }
  return result
}
```

---

## 3. 実装方針と判断理由

### アルゴリズム設計

テストケースを分析した結果、ゾーン境界の辺と外壁面が「コリニア（同一直線上）」な場合の1D重なり検出が本質的な問題であることを確認した。

**判断理由**:
- テストデータのパターンを見ると、外壁は常にゾーン境界の辺と平行・同一直線上に配置されている
- `[0,0,0]-[10,0,0]` の外壁が `[0,0]-[10,0]` のゾーン辺と重なるケース（TC-N01）
- `[x=10, y=0〜10]` の外壁が `[10,0]-[10,10]` の東辺と重なるケース（TC-N04）
- これはまさに「コリニア2線分の1D投影オーバーラップ」問題

**アルゴリズムの3ステップ**:
1. `areCollinear`: 外積（クロス積）で同一直線判定。距離が EPSILON * len 以下ならコリニアと判定
2. `calcOverlapLength1D`: 1D スカラー射影で区間 [lo, hi] を計算し重なり長を取得
3. EPSILON フィルタ: 微小な重なり（≤ 0.001m）を除外（TC-B06）

### TC-B06 の実装詳細

外壁 `[-0.0005, 0.0005]` が ゾーン辺 `[0, 10]` と重なる場合：
- 外壁範囲 bLo=-0.0005, bHi=0.0005
- ゾーン辺 aLo=0, aHi=10
- overlapLo = max(0, -0.0005) = 0
- overlapHi = min(10, 0.0005) = 0.0005
- overlap = 0.0005 ≤ EPSILON(0.001) → 除外 ✅

---

## 4. テスト実行結果

```
RUN v4.1.1

 Test Files  17 passed (17)
       Tests  113 passed (113)
    Start at  21:11:07
    Duration  934ms

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

## 5. 品質評価

| 項目 | 評価 |
|---|---|
| テスト結果 | ✅ 全113件pass |
| 実装品質 | ✅ シンプルな純関数設計 |
| ファイルサイズ | ✅ 203行（800行以下） |
| モック使用 | ✅ 実装コードにモックなし |
| コンパイルエラー | ✅ なし |

**総合評価: ✅ 高品質**

---

## 6. 課題・改善点（Refactorフェーズで対応）

1. **`areCollinear` と `calcOverlapLength1D` の統合検討**: 両関数は同じ方向ベクトル計算を繰り返している。統合してパフォーマンスを改善できる
2. **外壁が複数頂点（多角形外壁）への対応**: 現在は `vertices[0]` と `vertices[last]` のみ使用。中間頂点がある外壁への拡張が可能
3. **型安全性の向上**: `PerimeterSegmentType` の明示的な型注釈追加
4. **コリニア判定の厳密化**: 現在は端点の距離チェックのみ。方向ベクトルの平行チェックも追加可能

---

## 7. 信頼性レベルサマリー

| 関数 | 信頼性 | 根拠 |
|---|---|---|
| `detectPerimeterSegments` | 🔵 | REQ-208 に明示的記載 |
| `extractZoneEdges` | 🔵 | 標準的なポリゴン処理 |
| `areCollinear` | 🟡 | 標準的な 2D 幾何学アルゴリズム |
| `calcOverlapLength1D` | 🟡 | 標準的な 1D 区間オーバーラップ計算 |
| EPSILON = 0.001 | 🟡 | TASK-0014 注意事項から妥当な推測 |
