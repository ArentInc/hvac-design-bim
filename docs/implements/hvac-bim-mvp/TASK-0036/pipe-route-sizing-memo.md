# TDD開発メモ: pipe-route-sizing

## 概要

- 機能名: 配管ルーティング + 口径選定 (pipe-route-sizing)
- 開発開始: 2026-03-26
- 現在のフェーズ: Green

## 関連ファイル

- 元タスクファイル: `docs/tasks/hvac-bim-mvp/TASK-0036.md`
- 要件定義: `docs/implements/hvac-bim-mvp/TASK-0036/pipe-route-sizing-requirements.md`
- テストケース定義: `docs/implements/hvac-bim-mvp/TASK-0036/pipe-route-sizing-testcases.md`
- テストファイル（core）: `packages/core/src/systems/hvac/__tests__/pipe-sizing-system.test.ts`
- テストファイル（editor）: `packages/editor/src/components/tools/hvac/__tests__/pipe-route-tool.test.ts`
- 実装ファイル（core）: `packages/core/src/systems/hvac/pipe-sizing.ts` ✅ 作成済み
- 実装ファイル（core system）: `packages/core/src/systems/hvac/pipe-sizing-system.tsx`（未作成）
- 実装ファイル（editor）: `packages/editor/src/components/tools/hvac/pipe-route-tool.tsx`（未作成）

## Greenフェーズ（最小実装）

### 実装日時

2026-03-26

### 実装方針

- `packages/core/src/systems/hvac/pipe-sizing.ts` を新規作成
- 純粋計算関数のみ（副作用なし、Three.js不使用）
- `standard-pipe-sizes.json` を直接インポートして口径表を参照
- `validateVelocityConstraint` は反復ループで口径を自動調整

### テスト結果

```
pipe-sizing-system.test.ts: 19 passed (全通過)
pipe-route-tool.test.ts: 9 passed (全通過、Redより継続)
```

### 課題・改善点（Refactorフェーズ向け）

- `pipe-sizing-system.tsx`（React コンポーネント）の実装が残っている
- `pipe-route-tool.tsx` へのロジック移行が残っている
- `tool-manager.tsx` の `pipe_route` ツール登録が残っている
- `packages/core/src/index.ts` への pipe-sizing モジュール公開

---

## Redフェーズ（失敗するテスト作成）

### 作成日時

2026-03-26

### テストケース概要

#### pipe-sizing-system.test.ts（19テストケース）

- `calculateFlowRate` 関数テスト（TC-001, TC-009, TC-011, TC-023）
- `calculateTheoreticalDiameter` 関数テスト（TC-002）
- `snapToStandardSize` 関数テスト（TC-003, TC-004, TC-016, TC-017）
- `validateVelocityConstraint` 関数テスト（TC-005, TC-020, TC-021, TC-012, TC-013）
- `calculatePressureDrop` 関数テスト（TC-006, TC-022）
- `selectPipeSize` 統合テスト（TC-010, TC-011統合）
- `PIPE_SIZING_DEFAULTS` 定数テスト

#### pipe-route-tool.test.ts（9テストケース）

DuctRouteToolパターン準拠:
- `detectPipePortSnap` テスト（TC-007: スナップ検出、冷水以外除外、接続済み除外）
- `startPipeRouting` テスト（TC-007拡張: ルーティング開始状態）
- `confirmPipeRoute` テスト（TC-008: ノード作成, TC-009: 折点あり複数セグメント）
- `updatePipePortConnection` テスト（TC-014a: ポート更新）
- `checkPortAlreadyConnected` テスト（TC-014b: 二重接続チェック）
- `cancelPipeRouting` テスト（キャンセル動作）

### テスト実行結果

#### pipe-sizing-system.test.ts
```
Error: Cannot find module '../pipe-sizing'
```
→ 実装ファイル未存在のため全テスト失敗。Redフェーズとして正常。

#### pipe-route-tool.test.ts
```
✓ 9 passed
```
→ DuctRouteToolパターン（テストファイル内にロジック内包）のため全テスト通過。
   Greenフェーズで `pipe-route-tool.tsx` へ実装を移行する。

### 期待される失敗

`pipe-sizing-system.test.ts` は `packages/core/src/systems/hvac/pipe-sizing.ts` が作成されるまで:
- `ERR_MODULE_NOT_FOUND` で失敗

`pipe-route-tool.test.ts` はロジックがテストファイル内にあるため現在通過。
Greenフェーズで実装ファイルへ移行後に外部インポートへ変更して動作を確認。

### 次のフェーズへの要求事項

Greenフェーズで実装すべき内容:

1. **`packages/core/src/systems/hvac/pipe-sizing.ts`（新規）**
   - `PIPE_SIZING_DEFAULTS` 定数オブジェクト
   - `calculateFlowRate(coolingCapacity, deltaT?)` — 冷水流量算出
   - `calculateTheoreticalDiameter(flowRate, targetVelocity)` — 理論口径算出（mm）
   - `snapToStandardSize(theoreticalDiameterMm)` — 標準口径表スナップ
   - `validateVelocityConstraint(nominalSize, innerDiameterM, flowRate)` — 流速制約検証
   - `calculatePressureDrop(straightLength, innerDiameterM, flowRate, lambda?, fittingFactor?)` — 圧損概算
   - `selectPipeSize(coolingCapacity, straightLength)` — 統合口径選定

2. **`packages/core/src/systems/hvac/pipe-sizing-system.tsx`（新規）**
   - React コンポーネント（`null` レンダリング）
   - `useFrame` で `dirtyNodes` 監視、PipeSegmentNode の口径自動算出

3. **`packages/editor/src/components/tools/hvac/pipe-route-tool.tsx`（新規）**
   - `detectPipePortSnap`, `startPipeRouting`, `confirmPipeRoute` 等の実装
   - `pipe-route-tool.test.ts` のロジックを移行

### 注意事項

- `standard-pipe-sizes.json` の口径表をインポートして使用すること
- `PipeMedium` は現行スキーマ（`chilled_water`）を使用（CWS/CWR の区別は別フィールドで対応）
- Three.js インポート禁止（Core システムルール）
- `@pascal-app/viewer` からのインポート禁止（Viewer隔離ルール）
- `coolingCapacity <= 0` の場合はスキップして `{ nominalSize: null, calcResult: null }` を返す
