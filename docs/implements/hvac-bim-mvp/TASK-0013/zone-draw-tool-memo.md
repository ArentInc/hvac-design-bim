# zone-draw-tool TDD開発完了記録

## 確認すべきドキュメント

- `docs/tasks/hvac-bim-mvp/TASK-0013.md`
- `docs/implements/hvac-bim-mvp/TASK-0013/zone-draw-tool-requirements.md`
- `docs/implements/hvac-bim-mvp/TASK-0013/zone-draw-tool-testcases.md`

## 🎯 最終結果 (2026-03-26)

- **実装率**: 100% (24/24 テストケース — コアロジック定義分)
- **追加実装**: editorパッケージに9件の追加テスト（polygon-area.test.ts: 9件 + zone-draw-tool.test.ts: 7件 = 16件）
- **総テスト数**: 40テスト全パス（core: 24/24、editor: 16/16）
- **品質判定**: ✅ 合格（高品質）
- **TODO更新**: ✅ 完了マーク追加

## 💡 重要な技術学習

### 実装パターン

- **循環依存回避**: `@pascal-app/core` を editor テストから直接インポートすると `three-mesh-bvh` 循環依存エラーが発生。`HvacZoneNode` を `vi.fn()` インラインモックに変更して回避
- **ローカル実装の同期**: `packages/core/src/utils/polygon-area.ts` と `packages/editor/src/components/tools/hvac/polygon-area.ts` は同一ロジック。アルゴリズム変更時は両ファイルの同期が必要（コメント明記済み）
- **イベントバス**: `emitter.on(event, handler)` と `emitter.off(event, handler)` は同一参照が必須。`useEffect` 内で対にする

### テスト設計

- **純粋関数の分離**: `calculatePolygonArea` は `packages/core/src/utils/polygon-area.ts` に純粋関数として配置し、テストが容易
- **ツールロジックテスト**: React コンポーネントをテストせず、confirmZone ロジックを直接テストする方針（`zone-draw-tool-logic.test.ts`）
- **モックパターン**: React フック（`useState`, `useCallback`）のモックではなく、ロジック関数をテスト対象として切り出す

### 品質保証

- **EDGE-001 の多角的テスト**: 面積0のケースは「コリニアな3頂点」「Y軸方向コリニア」「頂点数不足」と複数パターンを網羅
- **Shoelace formula の数学的検証**: 正方形・三角形・L字型・反時計回りで公式の正確性を多面的に確認
- **useMemo 活用**: `previewShape`、`areaLabel` はメモ化。`geometry.dispose()` でメモリリーク防止

## 実装ファイル一覧

| ファイルパス | 用途 |
|------------|------|
| `packages/core/src/utils/polygon-area.ts` | Shoelace formula 純粋関数 |
| `packages/core/src/index.ts` | calculatePolygonArea の公開エクスポート追加 |
| `packages/editor/src/components/tools/hvac/polygon-area.ts` | editor 用ローカル実装（循環依存回避） |
| `packages/editor/src/components/tools/hvac/zone-draw-tool.tsx` | ゾーン描画ツール本体（421行） |
| `packages/editor/src/components/tools/tool-manager.tsx` | zone_draw ToolManager 登録 |

## テストファイル一覧

| ファイルパス | テスト数 |
|------------|---------|
| `packages/core/src/utils/__tests__/polygon-area.test.ts` | 14件 |
| `packages/core/src/schema/nodes/__tests__/zone-draw-tool-logic.test.ts` | 10件 |
| `packages/editor/src/components/tools/hvac/__tests__/polygon-area.test.ts` | 9件 |
| `packages/editor/src/components/tools/hvac/__tests__/zone-draw-tool.test.ts` | 7件 |
