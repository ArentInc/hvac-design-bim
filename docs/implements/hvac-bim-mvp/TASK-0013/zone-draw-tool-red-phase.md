# Redフェーズ記録: ZoneDrawTool — ゾーン境界描画ツール

**タスクID**: TASK-0013
**機能名**: zone-draw-tool
**フェーズ**: Red（失敗テスト作成）
**作成日**: 2026-03-26

---

## 作成したテストケースの一覧

### テストファイル1: calculatePolygonArea ユーティリティ（14テスト）

**ファイルパス**: `packages/core/src/utils/__tests__/polygon-area.test.ts`

| # | テストケース | 信頼性 |
|---|------------|--------|
| 1 | 10m×10m正方形の面積が100.0 m²になること | 🔵 |
| 2 | 底辺10m・高さ5mの三角形の面積が25.0 m²になること | 🔵 |
| 3 | 反時計回りの頂点順でも正しい面積を返すこと | 🔵 |
| 4 | L字型ポリゴン（凹多角形）の面積が正しく算出されること | 🟡 |
| 5 | 2頂点のみの場合に0を返すこと（頂点不足） | 🔵 |
| 6 | 空配列の場合に0を返すこと | 🔵 |
| 7 | 1頂点のみの場合に0を返すこと | 🔵 |
| 8 | 一直線上の3頂点の場合に0を返すこと（EDGE-001） | 🔵 |
| 9 | Y軸方向に一直線上の3頂点の場合に0を返すこと | 🔵 |
| 10 | 5m×10mの長方形の面積が50.0 m²になること | 🔵 |
| 11 | 浮動小数点座標でも正確に算出されること | 🟡 |
| 12 | 面積表示用のフォーマット文字列生成が正しいこと | 🟡 |
| 13 | 5頂点の複雑なポリゴンの面積が正しく算出されること | 🟡 |
| 14 | 非常に小さなポリゴン（面積 < 1.0 m²）でも正確に算出されること | 🟡 |

### テストファイル2: confirmZone ツールロジック（10テスト）

**ファイルパス**: `packages/core/src/schema/nodes/__tests__/zone-draw-tool-logic.test.ts`

| # | テストケース | 信頼性 |
|---|------------|--------|
| 1 | グリッドイベント座標（XZ平面）をHvacZoneNode境界座標（XY平面）に変換できること | 🔵 |
| 2 | 変換後の頂点列でcalculatePolygonAreaを呼び出せること | 🔵 |
| 3 | 有効な境界でHvacZoneNode.parseが成功すること | 🔵 |
| 4 | デフォルト値がHvacZoneNodeスキーマ仕様通りに適用されること | 🔵 |
| 5 | IDが"hvac_zone_"プレフィックスで自動生成されること | 🔵 |
| 6 | 面積が0の場合にconfirmZoneがcreateNodeを呼ばないこと（EDGE-001） | 🔵 |
| 7 | 頂点数が2の場合にconfirmZoneがcreateNodeを呼ばないこと | 🔵 |
| 8 | 有効なポリゴンでconfirmZoneがcreateNodeを正しく呼ぶこと | 🔵 |
| 9 | 確定後に頂点リストがリセットされること | 🔵 |
| 10 | 複数のゾーンを連続して確定できること（マルチゾーン対応） | 🟡 |

---

## テスト実行結果（Redフェーズ確認）

```
RUN  v4.1.1

 ❯ src/utils/__tests__/polygon-area.test.ts (0 test)
 ❯ src/schema/nodes/__tests__/zone-draw-tool-logic.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/utils/__tests__/polygon-area.test.ts
Error: Cannot find module '../polygon-area' imported from ...
 ❯ src/utils/__tests__/polygon-area.test.ts:13:1

 FAIL  src/schema/nodes/__tests__/zone-draw-tool-logic.test.ts
Error: Cannot find module '../../utils/polygon-area' imported from ...
 ❯ src/schema/nodes/__tests__/zone-draw-tool-logic.test.ts:18:1

 Test Files  2 failed (2)
      Tests  no tests
```

### 失敗の原因
- `packages/core/src/utils/polygon-area.ts` が未実装のため、`Cannot find module` エラー
- これは Redフェーズとして**正しい失敗**（実装すべき関数が存在しないことを確認）

---

## テスト実行コマンド

```bash
# packages/core ディレクトリから実行
cd packages/core
npx vitest run src/utils/__tests__/polygon-area.test.ts src/schema/nodes/__tests__/zone-draw-tool-logic.test.ts
```

---

## 期待される失敗内容

1. **テストファイル1（polygon-area.test.ts）**:
   - `Cannot find module '../polygon-area'`
   - `packages/core/src/utils/polygon-area.ts` が存在しないため

2. **テストファイル2（zone-draw-tool-logic.test.ts）**:
   - `Cannot find module '../../utils/polygon-area'`
   - 同上の理由

---

## Greenフェーズで実装すべき内容

### 1. `packages/core/src/utils/polygon-area.ts` の実装

```typescript
/**
 * Shoelace formula（ガウスの面積公式）でポリゴン面積を算出する
 * @param vertices - ポリゴンの頂点列 ({x, y} 形式、2D座標)
 * @returns 面積 (m²)。頂点数 < 3 の場合は 0 を返す
 */
export function calculatePolygonArea(vertices: { x: number; y: number }[]): number {
  if (vertices.length < 3) return 0

  let area = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  return Math.abs(area) / 2
}
```

### 2. `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx` の実装

- グリッドイベント（`grid:pointerdown`, `grid:pointermove`, `grid:dblclick`）の購読
- XZ平面 → XY平面 座標変換
- Shoelace formulaによるリアルタイム面積算出
- 確定処理（`HvacZoneNode.parse` → `createNode`）
- EDGE-001: 面積0以下の拒否
- プレビューポリゴン（`EDITOR_LAYER`=1 に描画）
- Escape キーでキャンセル

### 3. ToolManager への登録

- `packages/editor/src/components/tools/tool-manager.tsx` に phase=`zone` / mode=`build` / tool=`zone_draw` 登録

---

## 品質評価

- **テスト実行**: ✅ 実行可能（失敗を確認済み）
- **期待値**: ✅ 明確で具体的（面積値、呼び出し回数、引数の型）
- **アサーション**: ✅ 適切（toBeCloseTo, toHaveBeenCalledWith, toEqual 等）
- **実装方針**: ✅ 明確（calculatePolygonArea の実装が最優先）
- **信頼性レベル分布**: 🔵 16件 / 🟡 8件 / 🔴 0件

**判定**: ✅ 高品質
