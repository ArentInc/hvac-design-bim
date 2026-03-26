# Refactorフェーズ記録: ZoneDrawTool — ゾーン境界描画ツール

**タスクID**: TASK-0013
**機能名**: zone-draw-tool
**フェーズ**: Refactor（品質改善）
**実施日**: 2026-03-26

---

## 改善概要

Greenフェーズでは `packages/core/src/utils/polygon-area.ts` の最小実装のみ行い、以下を未実施としていた。本フェーズでこれらを全て対応した。

| 改善項目 | 信頼性 | 対応状況 |
|---------|--------|---------|
| `calculatePolygonArea` を core の index.ts に export 追加 | 🔵 | ✅ 完了 |
| `packages/editor/src/components/tools/hvac/polygon-area.ts` 作成 | 🔵 | ✅ 完了 |
| editor パッケージのテスト修正（サブパスインポート → ローカルモック化） | 🟡 | ✅ 完了 |
| `zone-draw-tool.tsx` ツール本体の実装 | 🔵 | ✅ 完了 |
| `tool-manager.tsx` への zone_draw 登録 | 🔵 | ✅ 完了 |
| Biome フォーマット・import 整序 | 🔵 | ✅ 完了 |

---

## 改善詳細

### 改善1: `packages/core/src/index.ts` — calculatePolygonArea の export 追加
🔵 信頼性: CLAUDE.md パッケージ公開 API ルールに準拠

```typescript
// Utilities
export { calculatePolygonArea } from './utils/polygon-area'
export { isObject } from './utils/types'
```

### 改善2: `packages/editor/src/components/tools/hvac/polygon-area.ts` 作成
🟡 信頼性: three-mesh-bvh 循環依存制約により @pascal-app/core 経由不可 → 直接実装

Shoelace formula を `packages/core/src/utils/polygon-area.ts` と同一ロジックでエディターパッケージ内に直接実装。
アルゴリズム変更時は両ファイルの同期が必要（コメントで明記）。

### 改善3: editor テストの修正
🟡 信頼性: three-mesh-bvh 循環依存制約への対応

`@pascal-app/core` をテストファイルから直接インポートすると `three-mesh-bvh` の循環依存エラーが発生。
`HvacZoneNode` を `vi.fn()` でインライン定義するモックパターンに変更し、依存を排除した。

### 改善4: `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx` 実装
🔵 信頼性: TASK-0013 要件定義、既存 ZoneTool パターンに基づく

**実装仕様:**
- `emitter.on('grid:click')` — 頂点追加（REQ-202）
- `emitter.on('grid:double-click')` — ダブルクリックで確定（REQ-202）
- `emitter.on('grid:move')` — カーソル追跡（REQ-1601 プレビュー）
- `keydown` — Enter で確定、Escape でキャンセル（REQ-202）
- `commitZoneDrawing()` — EDGE-001 面積0拒否 + HvacZoneNode.parse + createNode
- プレビュー: EDITOR_LAYER（1）に半透明フィルメッシュ + 頂点マーカー（REQ-1601）
- 面積ラベル: `areaLabel` で `toFixed(1) m²` 形式の文字列を生成（REQ-1601）

**行数**: 421行（500行制限以内）

### 改善5: `packages/editor/src/components/tools/tool-manager.tsx` 更新
🔵 信頼性: TASK-0013 要件定義セクション1.4に明示

```typescript
zone: {
  // 【zone_draw】: HvacZone ゾーン境界描画ツール（TASK-0013, REQ-202）
  zone_draw: ZoneDrawTool,
},
```

---

## セキュリティレビュー結果

| 観点 | 評価 | 備考 |
|------|------|------|
| 入力値検証 | ✅ | 頂点数 < 3、面積 ≤ 0 の早期リターン実装済み |
| XSS | ✅ | 文字列操作なし（数値計算のみ） |
| インジェクション | ✅ | DOM 操作なし、Three.js JSX のみ |
| 型安全性 | ✅ | TypeScript + Zod スキーマ検証（HvacZoneNode.parse） |

---

## パフォーマンスレビュー結果

| 観点 | 評価 | 備考 |
|------|------|------|
| Shoelace formula | ✅ O(n) | 頂点数に対して線形、リアルタイム算出に適する |
| useMemo 活用 | ✅ | previewShape, areaLabel は useMemo でメモ化 |
| geometry.dispose() | ✅ | Three.js BufferGeometry は dispose() でメモリリーク防止 |
| useEffect 依存 | ✅ | `[currentLevelId]` のみ。不要な再サブスクライブを防止 |

---

## テスト実行結果

```
# packages/core
Test Files  2 passed (2)
      Tests  24 passed (24)
   Duration  395ms

# packages/editor
Test Files  2 passed (2)
      Tests  16 passed (16)
   Duration  787ms

# 合計
Test Files  4 passed (4)
      Tests  40 passed (40)
```

---

## Biome チェック結果

`bun run check:fix` 実行後:
- `packages/core/src/index.ts` — import 順序修正
- `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx` — JSX フォーマット修正
- `packages/editor/src/components/tools/tool-manager.tsx` — import 順序修正

3ファイル自動修正済み。全ファイルチェック通過。

---

## 品質判定

| 項目 | 評価 | 備考 |
|------|------|------|
| テスト結果 | ✅ 高品質 | 40/40 pass |
| セキュリティ | ✅ 高品質 | 重大な脆弱性なし |
| パフォーマンス | ✅ 高品質 | O(n) Shoelace, useMemo, dispose() 実装済み |
| コード品質 | ✅ 高品質 | Biome 通過、日本語コメント充実 |
| ファイルサイズ | ✅ 高品質 | 最大 421 行（500 行制限以内） |
| ドキュメント | ✅ 完成 | refactor-phase.md, memo.md 更新済み |

**総合判定**: ✅ 高品質
