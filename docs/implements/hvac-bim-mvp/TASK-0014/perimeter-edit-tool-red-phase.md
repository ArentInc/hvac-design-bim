# TDD Redフェーズ記録: PerimeterEditTool -- 外皮条件入力

**タスクID**: TASK-0014
**要件名**: hvac-bim-mvp
**機能名**: PerimeterEditTool -- 外皮条件入力
**フェーズ**: Red（失敗テスト作成）
**作成日**: 2026-03-26

---

## 1. 作成したテストケースの一覧

### テストファイル 1: 交差検出アルゴリズム（未実装モジュール対象）

**ファイル**: `packages/core/src/systems/hvac/__tests__/perimeter-detection.test.ts`

| テストID | テスト名 | 信頼性 | 状態 |
|---|---|---|---|
| TC-N01 | 完全一致する外壁面のセグメントが検出される | 🔵 | 失敗（モジュール未実装） |
| TC-N02 | 部分交差する外壁面の交差部分のみセグメントが生成される | 🔵 | 失敗（モジュール未実装） |
| TC-N03 | ゾーン境界と離れた外壁面は空配列を返す | 🔵 | 失敗（モジュール未実装） |
| TC-N04 | 複数方位の外壁面が同時に検出される（南面・東面） | 🟡 | 失敗（モジュール未実装） |
| TC-N04b | 南面・北面の対向する外壁面が同時に検出される | 🟡 | 失敗（モジュール未実装） |
| TC-N01b | wallArea が 交差長 × wallHeight で計算される | 🔵 | 失敗（モジュール未実装） |
| TC-N04c | 全4方向（南・東・北・西）の外壁面が同時に検出される | 🟡 | 失敗（モジュール未実装） |
| TC-B06 | 交差長がイプシロン（0.001m）以下の場合にセグメントが生成されない | 🟡 | 失敗（モジュール未実装） |
| TC-B07 | 建築参照の外壁面が空配列の場合に空配列が返る | 🟡 | 失敗（モジュール未実装） |

### テストファイル 2: PerimeterSegment バリデーション（既存スキーマ確認）

**ファイル**: `packages/core/src/schema/nodes/__tests__/perimeter-segment-validation.test.ts`

| テストID | テスト名 | 信頼性 | 状態 |
|---|---|---|---|
| TC-N05 | 有効な orientation/wallArea/glazingRatio の組み合わせがパースに成功する | 🔵 | 合格（スキーマ実装済み） |
| TC-N06 | 全 8 方位が有効値として受け入れられる | 🔵 | 合格（スキーマ実装済み） |
| TC-E01 | glazingRatio が 1.0 を超える場合にバリデーションエラーとなる（EDGE-002） | 🔵 | 合格（スキーマ実装済み） |
| TC-E02 | glazingRatio が 0.0 未満の場合にバリデーションエラーとなる | 🔵 | 合格（スキーマ実装済み） |
| TC-E03 | 8 方位以外の orientation 値がバリデーションエラーとなる | 🔵 | 合格（スキーマ実装済み） |
| TC-E03b | orientation に空文字列を渡した場合にバリデーションエラーとなる | 🔵 | 合格（スキーマ実装済み） |
| TC-E06 | wallArea に負の値を入力した場合の現行スキーマ動作を確認する | 🟡 | 合格（制限事項の文書化） |
| TC-B01 | glazingRatio = 0.0 が有効値として受け入れられる（下限境界値） | 🔵 | 合格（スキーマ実装済み） |
| TC-B02 | glazingRatio = 1.0 が有効値として受け入れられる（上限境界値） | 🔵 | 合格（スキーマ実装済み） |
| TC-B03 | glazingRatio = 1.001 がバリデーションエラーとなる（上限境界直外） | 🟡 | 合格（スキーマ実装済み） |
| TC-B04 | glazingRatio = -0.001 がバリデーションエラーとなる（下限境界直外） | 🟡 | 合格（スキーマ実装済み） |
| TC-B05 | wallArea = 0 が有効値として受け入れられる（現行スキーマ動作確認） | 🟡 | 合格（スキーマ実装済み） |

**注記**: `perimeter-segment-validation.test.ts` のテストが全合格している理由は、`PerimeterSegment` スキーマが `packages/core/src/schema/nodes/hvac-shared.ts` に既に実装済みだからです。これらは既存実装の回帰テストとして機能します。

---

## 2. 期待される失敗内容

### perimeter-detection.test.ts の失敗

```
FAIL  src/systems/hvac/__tests__/perimeter-detection.test.ts
Error: Cannot find module '../perimeter-detection' imported from
  C:/Users/.../packages/core/src/systems/hvac/__tests__/perimeter-detection.test.ts
```

**失敗理由**: `packages/core/src/systems/hvac/perimeter-detection.ts` が未実装のため、インポートが失敗する。これが Red フェーズの正常な状態。

---

## 3. テストコードの全文

### ファイル: packages/core/src/systems/hvac/__tests__/perimeter-detection.test.ts

対象テストケース（9件）:
- TC-N01: 完全一致する外壁面のセグメント検出
- TC-N02: 部分交差する外壁面のセグメント検出
- TC-N03: 交差なし（空配列）
- TC-N04: 複数方位同時検出（南・東）
- TC-N04b: 対向する外壁面の同時検出（南・北）
- TC-N01b: wallArea = 交差長 × wallHeight の計算確認
- TC-N04c: 全4方向の同時検出
- TC-B06: 交差長がイプシロン以下の場合の除外
- TC-B07: 空の architectureWalls

### ファイル: packages/core/src/schema/nodes/__tests__/perimeter-segment-validation.test.ts

対象テストケース（12件）:
- TC-N05, TC-N06: 正常系パース
- TC-E01, TC-E02, TC-E03, TC-E03b, TC-E06: 異常系バリデーション
- TC-B01, TC-B02, TC-B03, TC-B04, TC-B05: 境界値テスト

---

## 4. Greenフェーズで実装すべき内容

### 新規実装ファイル

#### `packages/core/src/systems/hvac/perimeter-detection.ts`

```typescript
import type { WallMetadata } from '../../loaders/architecture-metadata'
import type { z } from 'zod'
import { PerimeterSegment } from '../../schema/nodes/hvac-shared'

type PerimeterSegmentType = z.infer<typeof PerimeterSegment>

/** イプシロン定数（浮動小数点誤差の閾値、単位: m） */
const EPSILON = 0.001

/**
 * ゾーン境界ポリゴンと建築参照外壁面の 2D 交差検出
 * @param zoneBoundary HvacZoneNode.boundary（2D ポリゴン頂点座標、XY平面）
 * @param architectureWalls 建築参照の外壁面メタデータ配列
 * @param wallHeight 壁高さ（m）。HvacZoneNode.ceilingHeight を使用
 * @returns 検出された PerimeterSegment 配列
 */
export function detectPerimeterSegments(
  zoneBoundary: [number, number][],
  architectureWalls: WallMetadata[],
  wallHeight: number,
): PerimeterSegmentType[] {
  // TODO: Greenフェーズで実装
  // 1. ゾーン境界の各辺を抽出
  // 2. 各外壁面の vertices から 2D ラインセグメントを抽出
  // 3. ゾーン辺と外壁ラインセグメントの 2D 交差長さを計算
  // 4. 交差長 > EPSILON の場合、PerimeterSegment を生成
  //    wallArea = 交差長 × wallHeight
  //    glazingRatio = 外壁の glazingRatio
  //    orientation = 外壁の orientation
  // 5. PerimeterSegment 配列を返却
  throw new Error('Not implemented')
}
```

#### 実装手順

1. 2D ラインセグメント交差検出の純関数を実装
2. イプシロン（0.001m）による微小交差の除外ロジック
3. 交差長 × wallHeight による wallArea 計算
4. 複数外壁面の一括処理

---

## 5. 信頼性レベル分布

- 🔵 青信号（元の資料に明記）: TC-N01, TC-N02, TC-N03, TC-N01b, TC-N05, TC-N06, TC-E01, TC-E02, TC-E03, TC-E03b, TC-B01, TC-B02（12件）
- 🟡 黄信号（妥当な推測）: TC-N04, TC-N04b, TC-N04c, TC-B06, TC-B07, TC-E06, TC-B03, TC-B04, TC-B05（9件）
- 🔴 赤信号（推測）: 0件

**総合評価**: ✅ 高品質（🔵 12件 / 全21件 = 57% 青信号、主要な交差検出テストは全て青信号）
