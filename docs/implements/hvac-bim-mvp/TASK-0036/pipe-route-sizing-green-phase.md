# TASK-0036: PipeRouteTool + PipeSizingSystem — Greenフェーズ記録

**タスクID**: TASK-0036
**機能名**: 配管ルーティング + 口径選定 (pipe-route-sizing)
**フェーズ**: Green（最小実装 → テスト通過）
**作成日**: 2026-03-26

---

## 実装概要

### 実装したファイル

| ファイル | 種別 | 状態 |
|---------|------|------|
| `packages/core/src/systems/hvac/pipe-sizing.ts` | 新規作成 | ✅ 完了 |

Redフェーズの分析により、`pipe-route-tool.test.ts` はテストファイル内にロジックを内包しているため全通過済み。
`pipe-sizing-system.test.ts` が `../pipe-sizing` を require しているため、`pipe-sizing.ts` の新規実装が必要だった。

---

## 実装内容

### `packages/core/src/systems/hvac/pipe-sizing.ts`

**実装した関数・エクスポート**:

1. **`PIPE_SIZING_DEFAULTS`** — 計算パラメータ定数オブジェクト
2. **`calculateFlowRate(coolingCapacity, deltaT?)`** — 冷水流量算出
3. **`calculateTheoreticalDiameter(flowRate, targetVelocity)`** — 理論口径算出 (mm)
4. **`snapToStandardSize(theoreticalDiameterMm)`** — 標準口径表スナップ
5. **`validateVelocityConstraint(nominalSize, innerDiameterM, flowRate)`** — 流速制約検証
6. **`calculatePressureDrop(straightLength, innerDiameterM, flowRate, lambda?, fittingFactor?)`** — 圧損概算
7. **`selectPipeSize(coolingCapacity, straightLength)`** — 統合口径選定

**実装方針**:
- 全て純粋関数（副作用なし）
- Three.js インポートなし（Core システムルール準拠）
- `standard-pipe-sizes.json` を直接インポートして口径表を参照
- `validateVelocityConstraint` は反復ループで口径を自動調整（最大/最小口径に到達で `size-limit` 返却）
- `selectPipeSize` は全処理のパイプライン統合

**主要な計算式**:
- 流量: `Q = P / (cp * ΔT * ρ)` [m3/s]
- 理論口径: `d = sqrt(4Q / πv) * 1000` [mm]
- 圧損: `ΔP = λ * (L_eq / d) * (ρv²/2) / 1000` [kPa]
- 等価長さ: `L_eq = L_straight * (1 + fittingFactor)`

---

## テスト実行結果

### pipe-sizing-system.test.ts（19テストケース）

```
Test Files  1 passed (1)
     Tests  19 passed (19)
  Duration  314ms
```

| テストケース | 結果 |
|-------------|------|
| TC-001: 50kW → 流量≈0.00239m3/s | ✅ PASS |
| TC-009: 100kW → 50kWの2倍（線形性） | ✅ PASS |
| TC-011: 0kW → 流量ゼロ | ✅ PASS |
| TC-023: deltaT省略 → デフォルト5K | ✅ PASS |
| TC-002: 理論口径≈45mm算出 | ✅ PASS |
| TC-003: 45mm → 50A スナップ | ✅ PASS |
| TC-004: 38mm → 40A スナップ | ✅ PASS |
| TC-016: 5mm → 15A（最小口径） | ✅ PASS |
| TC-017: 250mm → 200A（最大口径） | ✅ PASS |
| TC-005: 50A・0.00239m3/s → 流速範囲内 | ✅ PASS |
| TC-020: 流速>2.0 → 1サイズ上げ | ✅ PASS |
| TC-021: 流速<1.0 → 1サイズ下げ | ✅ PASS |
| TC-006: 直管20m・50A → 圧損>0 | ✅ PASS |
| TC-022: 直管長ゼロ → 圧損=0 | ✅ PASS |
| TC-012: 極大流量 → 200A採用 | ✅ PASS |
| TC-013: 極小流量 → 15A採用 | ✅ PASS |
| TC-010統合: 50kW・20m → 50A・流速・圧損 | ✅ PASS |
| TC-011統合: 0kW → null | ✅ PASS |
| DEFAULTS: 定数値確認 | ✅ PASS |

### pipe-route-tool.test.ts（9テストケース）

```
Test Files  1 passed (1)
     Tests  9 passed (9)
  Duration  511ms
```

（Redフェーズより全通過：テストファイル内にロジック内包）

---

## 品質判定

```
✅ 高品質:
- テスト結果: 全28テスト成功（pipe-sizing 19 + pipe-route 9）
- 実装品質: シンプルな純粋関数、副作用なし
- ファイルサイズ: 233行（800行制限以内）
- モック使用: 実装コードにモック・スタブなし
- Three.js: 使用なし（Core システムルール準拠）
- @pascal-app/viewer: インポートなし（Viewer隔離ルール準拠）
```

---

## Refactorフェーズで対応すべき課題

1. **`pipe-sizing-system.tsx`（React コンポーネント）の実装**
   - Redフェーズでは「未作成」と記録されているが、テスト対象は `pipe-sizing.ts` の純粋関数
   - PipeSizingSystem コンポーネント（useFrame で dirtyNodes 監視）は別途実装が必要

2. **`pipe-route-tool.tsx`（ルーティングツール）の実装**
   - `pipe-route-tool.test.ts` のロジックをテストファイル外に移行
   - Refactorフェーズで実装ファイルへの移行を検討

3. **`tool-manager.tsx` の更新**
   - `pipe_route` ツールの登録

4. **型安全性向上**
   - `snapToStandardSize` の戻り値型を `PipeSizeEntry` として明示
   - `selectPipeSize` の内部で `findIndex` を使った最適化

5. **エクスポート整理**
   - `packages/core/src/index.ts` への `pipe-sizing` モジュール公開

---

## 信頼性レベル分布

| レベル | 件数 | 内容 |
|--------|------|------|
| 🔵 青信号 | 主要実装全て | REQ-1103, REQ-1104, PRDセクション15.7に明示 |
| 🟡 黄信号 | validateVelocityConstraint の size-limit 分岐 | REQ-1103の範囲制約から推測 |
| 🔴 赤信号 | なし | — |
