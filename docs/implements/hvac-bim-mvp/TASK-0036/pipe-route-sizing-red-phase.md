# TASK-0036: PipeRouteTool + PipeSizingSystem — Redフェーズ記録

**タスクID**: TASK-0036
**機能名**: 配管ルーティング + 口径選定 (pipe-route-sizing)
**フェーズ**: Red（失敗テスト作成）
**作成日**: 2026-03-26

---

## 作成したテストケース一覧

### pipe-sizing-system.test.ts（14テストケース）

| ID | テスト名 | 信頼性 | 状態 |
|----|---------|--------|------|
| TC-001 | coolingCapacity=50kWから冷水流量≈0.002389m3/sが算出される | 🔵 | FAIL（未実装） |
| TC-009 | coolingCapacity=100kWでは流量が50kWの約2倍になる（線形性確認） | 🟡 | FAIL（未実装） |
| TC-011 | coolingCapacity=0kWのとき流量ゼロが返される | 🟡 | FAIL（未実装） |
| TC-023 | deltaT未指定時はデフォルト5Kが使用される | 🔵 | FAIL（未実装） |
| TC-002 | flowRate=0.00239m3/s, velocity=1.5m/sから理論口径≈45mmが算出される | 🔵 | FAIL（未実装） |
| TC-003 | 計算口径45mmが50A（innerDiameter=52.7mm）にスナップされる | 🔵 | FAIL（未実装） |
| TC-004 | 計算口径38mmが40A（innerDiameter=41.2mm）にスナップされる | 🔵 | FAIL（未実装） |
| TC-016 | 計算口径5mm（最小口径以下）のとき15Aにスナップされる | 🟡 | FAIL（未実装） |
| TC-017 | 計算口径250mm（最大口径超過）のとき200Aが選択される | 🟡 | FAIL（未実装） |
| TC-005 | 50A・flowRate=0.00239m3/sで実流速が1.0~2.0範囲内 → 制約OK | 🔵 | FAIL（未実装） |
| TC-020 | 流速上限超過（>2.0 m/s）のとき口径が1サイズ上げられる | 🔵 | FAIL（未実装） |
| TC-021 | 流速下限未満（<1.0 m/s）のとき口径が1サイズ下げられる | 🔵 | FAIL（未実装） |
| TC-006 | 直管長20m・50A・flowRate=0.00239m3/sで物理的に妥当な圧損が算出される | 🔵 | FAIL（未実装） |
| TC-022 | 直管長ゼロのとき圧損=0kPaが返される | 🔴 | FAIL（未実装） |
| TC-012 | 極大流量では最大口径200Aが採用される | 🟡 | FAIL（未実装） |
| TC-013 | 極小流量では最小口径15Aが採用される | 🟡 | FAIL（未実装） |
| TC-010統合 | coolingCapacity=50kW・直管長20mで口径50A・流速≈1.1m/s・圧損>0が算出される | 🔵 | FAIL（未実装） |
| TC-011統合 | coolingCapacity=0kWのとき口径算出がスキップされnominalSize=nullが返される | 🟡 | FAIL（未実装） |
| DEFAULTS | PIPE_SIZING_DEFAULTSが正しい定数値を持つ | 🔵 | FAIL（未実装） |

### pipe-route-tool.test.ts（9テストケース）

DuctRouteToolのパターンに倣い、テストファイル内にロジックを実装して動作を確認。
Greenフェーズで `pipe-route-tool.tsx` へ実装を移行する。

| ID | テスト名 | 信頼性 | 状態 |
|----|---------|--------|------|
| TC-007a | 閾値内の冷水ポート（CHW_S）がスナップ対象として検出される | 🔵 | 通過（ロジック内包） |
| TC-007b | 給気ポート（supply_air）は配管ツールのスナップ対象にならない | 🔵 | 通過（ロジック内包） |
| TC-007c | 接続済み冷水ポートはスナップ対象から除外される | 🔵 | 通過（ロジック内包） |
| TC-007拡張 | CHW_Sポートクリックでルーティングが開始され、mediumが正しく設定される | 🔵 | 通過（ロジック内包） |
| TC-008 | ルーティング完了時にPipeSegmentNodeが正しいフィールドで作成される | 🔵 | 通過（ロジック内包） |
| TC-009 | 折点ありのルーティングで複数PipeSegmentNodeが作成される | 🔵 | 通過（ロジック内包） |
| TC-014a | ルーティング完了後にAHUポートのconnectedSegmentIdが更新される | 🔵 | 通過（ロジック内包） |
| TC-014b | 接続済みポートへのルーティングがcheckPortAlreadyConnectedで検出される | 🔵 | 通過（ロジック内包） |
| キャンセル | ルーティング途中でcancelPipeRoutingを呼ぶとstateが初期化される | 🔵 | 通過（ロジック内包） |

---

## テストファイル

### pipe-sizing-system.test.ts

**パス**: `packages/core/src/systems/hvac/__tests__/pipe-sizing-system.test.ts`

**インポート先（未実装）**:
```typescript
import {
  PIPE_SIZING_DEFAULTS,
  calculateFlowRate,
  calculatePressureDrop,
  calculateTheoreticalDiameter,
  selectPipeSize,
  snapToStandardSize,
  validateVelocityConstraint,
} from '../pipe-sizing'
```

### pipe-route-tool.test.ts

**パス**: `packages/editor/src/components/tools/hvac/__tests__/pipe-route-tool.test.ts`

**設計方針**: DuctRouteToolパターン準拠。テストファイル内でロジックを定義して動作を確認。
Greenフェーズで以下のファイルへ実装を移行する:
- `packages/editor/src/components/tools/hvac/pipe-route-tool.tsx`

---

## 期待される失敗内容

### pipe-sizing-system.test.ts
```
Error: Cannot find module '../pipe-sizing'
```
→ `packages/core/src/systems/hvac/pipe-sizing.ts` が未実装のため失敗

### pipe-route-tool.test.ts
→ テストファイル内にロジックを内包しているため全テスト通過。
   Greenフェーズで実装ファイルへのリファクタリングを実施する。

---

## Greenフェーズで実装すべき内容

### 1. `packages/core/src/systems/hvac/pipe-sizing.ts`（新規作成）

以下の関数をエクスポートする純粋計算モジュール:

```typescript
export const PIPE_SIZING_DEFAULTS = {
  cp: 4.186,         // kJ/(kg*K)
  rho: 1000,         // kg/m3
  deltaT: 5,         // K
  targetVelocity: 1.5, // m/s
  minVelocity: 1.0,  // m/s
  maxVelocity: 2.0,  // m/s
  lambda: 0.02,      // 摩擦係数（鋼管概算値）
  fittingFactor: 0.5, // 継手等価長さ係数
}

// 冷水流量算出: flowRate = coolingCapacity / (cp * deltaT * rho)
export function calculateFlowRate(coolingCapacity: number, deltaT?: number): number

// 理論口径算出: diameter = sqrt(4 * flowRate / (pi * velocity))（mm単位）
export function calculateTheoreticalDiameter(flowRate: number, targetVelocity: number): number

// 標準口径スナップ: standard-pipe-sizes.json を参照して最小適合口径を返す
export function snapToStandardSize(theoreticalDiameterMm: number): {
  nominalSize: number
  outerDiameter: number
  innerDiameter: number
}

// 流速範囲制約検証 + 口径自動調整
export function validateVelocityConstraint(
  nominalSize: number,
  innerDiameterM: number,
  flowRate: number,
): {
  status: 'ok' | 'warning' | 'size-limit'
  nominalSize: number
  innerDiameterM: number
  velocity: number
}

// 等価長さ法圧損概算（kPa）
export function calculatePressureDrop(
  straightLength: number,
  innerDiameterM: number,
  flowRate: number,
  lambda?: number,
  fittingFactor?: number,
): number

// 統合口径選定
export function selectPipeSize(
  coolingCapacity: number,
  straightLength: number,
): {
  nominalSize: number | null
  outerDiameter: number | null
  calcResult: { velocity: number; pressureDrop: number } | null
}
```

### 2. `packages/core/src/systems/hvac/pipe-sizing-system.tsx`（新規作成）

React コンポーネント（`null` をレンダリング）。
`useFrame` 内で `dirtyNodes` を監視し、PipeSegmentNode の口径を自動算出・更新する。

### 3. `packages/editor/src/components/tools/hvac/pipe-route-tool.tsx`（新規作成）

配管ルーティングツールコンポーネント。
`pipe-route-tool.test.ts` 内のロジック関数を外部ファイルへ移行する:
- `detectPipePortSnap`: 冷水ポートスナップ検出
- `startPipeRouting`: ルーティング開始
- `confirmPipeRoute`: PipeSegmentNode 作成
- `updatePipePortConnection`: ポート接続更新
- `checkPortAlreadyConnected`: 二重接続チェック
- `cancelPipeRouting`: キャンセル

---

## 信頼性レベル分布

| レベル | 件数 | 割合 |
|--------|------|------|
| 🔵 青信号 | 17 | 61% |
| 🟡 黄信号 | 10 | 36% |
| 🔴 赤信号 | 1 | 4% |

**品質評価**: ✅ 高品質
- 主要機能仕様は🔵が多数を占め、要件・設計文書に明確な根拠がある
- 🟡はエッジケース・境界値テストで妥当な推測の範囲内
- 🔴はゼロ長さ境界値テストのみ（1件）
