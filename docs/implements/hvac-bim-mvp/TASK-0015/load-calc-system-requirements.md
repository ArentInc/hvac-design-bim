# TDD要件定義書: LoadCalcSystem -- 負荷概算計算エンジン

**タスクID**: TASK-0015
**機能名**: load-calc-system
**要件名**: hvac-bim-mvp
**フェーズ**: Phase 2 - ゾーニング + 負荷計算
**作成日**: 2026-03-26

---

## 1. 機能の概要

### 1.1 何をする機能か 🔵

ゾーン（HvacZoneNode）ごとの冷房負荷・暖房負荷・必要風量を算出する計算エンジン。Core パッケージのシステムとして実装し、dirty node パターンで自動的に再計算を行う。

- **参照したEARS要件**: REQ-301（冷房負荷・暖房負荷・必要風量算出）
- **参照した設計文書**: architecture.md「HVAC 計算アーキテクチャ」セクション

### 1.2 どのような問題を解決するか 🔵

空調設備の基本設計において、ゾーンの用途や外皮条件に基づく負荷概算をリアルタイムで行い、設計者が条件入力後に即座に計算結果を得られるようにする。手計算で行っていた負荷概算を自動化し、設計ワークフローを加速する。

- **参照したEARS要件**: REQ-301
- **参照した設計文書**: dataflow.md「機能1: ゾーン作成と負荷計算」フロー

### 1.3 想定されるユーザー 🔵

空調設備の基本設計を行う設備設計者。1フロア・1系統規模の負荷概算を一筆書きで完了させたいユーザー。

- **参照**: requirements.md 概要

### 1.4 システム内での位置づけ 🔵

`packages/core/src/systems/hvac/load-calc-system.tsx` に配置されるCoreシステム。計算パイプラインの最上流に位置し、結果は後続の SystemAggregationSystem（TASK-0019）、EquipmentSelectionSystem（TASK-0021）へカスケードする。

- **参照した設計文書**: architecture.md「計算パイプライン」図、「計算システム一覧」テーブル

---

## 2. 入力・出力の仕様

### 2.1 入力パラメータ

#### HvacZoneNode からの入力 🔵

| パラメータ | 型 | 制約 | 出典 |
|---|---|---|---|
| `floorArea` | `number` | > 0 (m^2) | REQ-203, hvac-zone.ts |
| `usage` | `ZoneUsage` | `'office_general' \| 'office_server' \| 'conference' \| 'reception' \| 'corridor'` | REQ-203, hvac-shared.ts |
| `perimeterSegments` | `PerimeterSegment[]` | 各要素: orientation(8方位), wallArea(m^2), glazingRatio(0.0-1.0) | REQ-205, hvac-shared.ts |
| `designConditions.supplyAirTempDiff` | `number` | default: 10 (K) | REQ-206, hvac-zone.ts |

- **参照したEARS要件**: REQ-203, REQ-205, REQ-206
- **参照した型定義**: `packages/core/src/schema/nodes/hvac-zone.ts`, `packages/core/src/schema/nodes/hvac-shared.ts`

#### 負荷原単位テーブルからの入力 🔵 (注意: 乖離あり)

| usage | coolingLoadPerArea (W/m^2) | heatingLoadPerArea (W/m^2) | 出典 |
|---|---|---|---|
| office_general | 150 | 80 | load-unit-table.json |
| office_server | 800 | 0 | load-unit-table.json |
| conference | 200 | 100 | load-unit-table.json |
| reception | 130 | 70 | load-unit-table.json |
| corridor | 60 | 40 | load-unit-table.json |

> **注意**: TASK-0015 のコードサンプルに記載された値と `packages/core/src/data/load-unit-table.json` の実際の値に乖離があります。
> - `office_server`: TASK記載 500 vs JSON 800 (冷房), TASK記載 0 vs JSON 0 (暖房)
> - `reception`: TASK記載 120 vs JSON 130 (冷房), TASK記載 90 vs JSON 70 (暖房)
> - `corridor`: TASK記載 80 vs JSON 60 (冷房), TASK記載 60 vs JSON 40 (暖房)
> - `office_general`: TASK記載 100 vs JSON 80 (暖房)
> - `conference`: TASK記載 120 vs JSON 100 (暖房)
>
> **方針**: `load-unit-table.json`（TASK-0006で作成済みのマスタデータ）の値を正とする。 🟡

- **参照したEARS要件**: REQ-305
- **参照した設計文書**: `packages/core/src/data/load-unit-table.json`

#### 方位別日射補正係数 🔵

| 方位 | 補正係数 | 出典 |
|---|---|---|
| S | 1.0 | REQ-303 |
| SE, SW | 1.1 | REQ-303 |
| E, W | 1.2 | REQ-303 |
| NE, NW | 0.8 | REQ-303 |
| N | 0.6 | REQ-303 |

- **参照したEARS要件**: REQ-303
- **参照した設計文書**: interfaces.ts `SolarCorrectionCoefficients`

#### 物理定数 🔵

| 定数 | 値 | 単位 |
|---|---|---|
| 空気密度 | 1.2 | kg/m^3 |
| 空気比熱 | 1005 | J/(kg*K) |
| ベース外皮負荷 | 200 | W/m^2 |

- **参照したEARS要件**: REQ-304（風量計算式に明示）
- **参照した設計文書**: TASK-0015 実装詳細セクション3

### 2.2 出力値

#### CalcResult 型 🔵

| フィールド | 型 | 単位 | 説明 |
|---|---|---|---|
| `coolingLoad` | `number` | W | 冷房負荷（内部負荷 + 外皮負荷） |
| `heatingLoad` | `number` | W | 暖房負荷（原単位ベース） |
| `requiredAirflow` | `number` | m^3/h | 必要風量 |
| `internalLoad` | `number` | W | 内部負荷（面積 x 冷房原単位） |
| `envelopeLoad` | `number` | W | 外皮負荷（方位別合算） |
| `perimeterLoadBreakdown` | `PerimeterLoadBreakdownEntry[]` | - | 方位別外皮負荷内訳 |
| `status` | `'success' \| 'error'` | - | 計算ステータス |
| `error` | `string?` | - | エラーメッセージ（error時のみ） |

この型は既に `packages/core/src/schema/nodes/hvac-zone.ts` に `HvacZoneCalcResult` として Zod スキーマが定義済み。

- **参照したEARS要件**: REQ-301, REQ-306
- **参照した型定義**: `packages/core/src/schema/nodes/hvac-zone.ts` L12-27

#### PerimeterLoadBreakdownEntry 🔵

| フィールド | 型 | 説明 |
|---|---|---|
| `orientation` | `Orientation` | 方位 |
| `solarCorrectionFactor` | `number` | 日射補正係数 |
| `envelopeLoadContribution` | `number` | 外皮負荷寄与分 (W) |

> **注意**: TASK-0015 の `PerimeterLoadBreakdown` 型（`orientation, load, percentage`）と `HvacZoneCalcResult` スキーマの `perimeterLoadBreakdown`（`orientation, solarCorrectionFactor, envelopeLoadContribution`）で構造が異なります。既存 Zod スキーマの定義を正とします。 🟡

- **参照した型定義**: `packages/core/src/schema/nodes/hvac-zone.ts` L18-24

### 2.3 入出力の関係性 🔵

```
internalLoad = floorArea * coolingLoadPerArea[usage]
envelopeLoad = SUM(wallArea * glazingRatio * solarCoeff[orientation] * BASE_ENVELOPE_LOAD)
coolingLoad  = internalLoad + envelopeLoad
heatingLoad  = floorArea * heatingLoadPerArea[usage]
requiredAirflow = (coolingLoad / (AIR_DENSITY * AIR_SPECIFIC_HEAT * supplyAirTempDiff)) * 3600
```

- **参照したEARS要件**: REQ-302, REQ-303, REQ-304

### 2.4 データフロー 🔵

```
HvacZoneNode dirty
  -> LoadCalcSystem 検出 (useFrame)
  -> requestIdleCallback で非同期計算
  -> calculateZoneLoad(zone) 実行
  -> updateNode(zoneId, { calcResult: result })
  -> clearDirty(zoneId) 自動実行
```

- **参照した設計文書**: dataflow.md「機能1: ゾーン作成と負荷計算」

---

## 3. 制約条件

### 3.1 パフォーマンス要件 🔵

- 計算は `requestIdleCallback`（timeout: 100ms）で非同期実行し、UI をブロックしない
- SSR 環境では `setTimeout(callback, 0)` にフォールバック
- 1フロア 300 ノード規模で 30fps を維持（NFR-001）
- 単発再計算は 5 秒以内に完了（NFR-002）

- **参照したEARS要件**: NFR-001, NFR-002
- **参照した設計文書**: architecture.md「パフォーマンス制約」

### 3.2 アーキテクチャ制約 🔵

- `packages/core/src/systems/hvac/` に配置（REQ-008）
- Three.js インポート禁止（CLAUDE.md Coreシステムルール）
- `@pascal-app/viewer` への依存禁止
- System コンポーネントは `null` を返す
- `useFrame` 内で dirty 検出を行い、計算は `requestIdleCallback` で非同期実行

- **参照したEARS要件**: REQ-008
- **参照した設計文書**: architecture.md「アーキテクチャ制約」、CLAUDE.md「Systems vs Renderers」

### 3.3 互換性制約 🔵

- 既存の dirty node システム（`useScene.dirtyNodes`）と統合
- `updateNode` 呼び出しで `clearDirty` が自動実行される既存動作に従う
- `HvacZoneCalcResult` の Zod スキーマ（既存定義済み）との整合性を保つ

- **参照したEARS要件**: REQ-005
- **参照した設計文書**: CLAUDE.md「Dirty Node System」

### 3.4 計算精度 🔵

- サンプル案件の手計算結果と +-20% 以内で一致（NFR-301）
- 浮動小数点演算のため、テストでは適切な tolerance を使用（`toBeCloseTo`）
- `requiredAirflow` は整数に丸める（`Math.round`）

- **参照したEARS要件**: NFR-301

### 3.5 計算失敗ハンドリング 🔵

- 計算失敗時もエディタがクラッシュしない（NFR-102）
- 失敗時は `calcResult.status = 'error'`、`calcResult.error` にメッセージを格納
- `supplyAirTempDiff <= 0` の場合はゼロ除算防止で `requiredAirflow = 0`

- **参照したEARS要件**: NFR-102

### 3.6 コードスタイル制約 🔵

- Biome 準拠: 2スペースインデント、シングルクォート、セミコロンなし、トレーリングカンマ、100文字行幅
- `bun run check` が pass すること
- `bun run check-types` が pass すること

- **参照した設計文書**: CLAUDE.md「Code Style」

---

## 4. 想定される使用例

### 4.1 基本的な使用パターン 🔵

**ゾーン作成後の自動計算**:
1. ユーザーが ZoneDrawTool でゾーンを描画
2. PerimeterEditTool で外皮条件を入力
3. `updateNode` で `perimeterSegments` が更新され、dirty フラグが立つ
4. LoadCalcSystem が dirty を検出し、非同期で負荷計算を実行
5. 計算結果が `calcResult` に格納され、TASK-0016 の CalcResultPanel で表示

- **参照したEARS要件**: REQ-301
- **参照した設計文書**: dataflow.md「機能1」シーケンス図

### 4.2 条件変更時の再計算 🔵

**ゾーン用途変更時**:
1. ユーザーが HvacZonePanel で `usage` を `office_general` から `conference` に変更
2. `updateNode` で dirty フラグが立つ
3. LoadCalcSystem が再計算し、新しい原単位で負荷を算出
4. 後続の SystemAggregationSystem が連鎖的に再計算

- **参照したEARS要件**: REQ-1801
- **参照した設計文書**: architecture.md「再計算カスケード」

### 4.3 エッジケース 🔵

#### perimeterSegments が空の場合
- `envelopeLoad = 0`、`coolingLoad = internalLoad` のみ
- 外皮条件未入力でも計算は成功する

- **参照したEARS要件**: TASK-0015 テスト8

#### ゼロ除算防止 🔵
- `supplyAirTempDiff <= 0` の場合、`requiredAirflow = 0` を返す

- **参照したEARS要件**: TASK-0015 テスト6

#### 不明な用途（usage） 🟡
- `load-unit-table.json` に存在しない usage が指定された場合のフォールバック
- TASK-0015 ではデフォルト値（office_general相当）を適用と記載
- 実装では `load-unit-table.json` の参照方式に合わせてフォールバックを決定

#### 複数ゾーンの同時 dirty 🔵
- 複数ゾーンが同時に dirty の場合、バッチ処理で一括計算
- 同一フレームで同じゾーンが複数回計算されない制御が必要

- **参照**: TASK-0015 注意事項

### 4.4 エラーケース 🟡

| ケース | 期待動作 |
|---|---|
| `floorArea` が負の値 | `calcResult.status = 'error'`、エラーメッセージ格納 |
| `glazingRatio` が範囲外 | Zod スキーマで `.min(0).max(1)` 制約済み（hvac-shared.ts） |
| 計算中の例外発生 | try-catch でキャッチ、`status: 'error'` を返す |

- **参照したEARS要件**: NFR-102, EDGE-001

---

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー
- ストーリー 2.1: ゾーン描画
- ストーリー 2.2: 外皮条件入力
- ストーリー 2.3: 負荷計算結果確認

### 参照した機能要件
- **REQ-301**: ゾーンごとの冷房/暖房/風量算出
- **REQ-302**: 面積 x 用途別原単位 + 外皮補正
- **REQ-303**: 方位別日射補正係数テーブル
- **REQ-304**: 風量計算式（coolingLoad / (1.2 x 1005 x ΔT) -> m^3/h）
- **REQ-305**: 用途別原単位テーブル参照
- **REQ-306**: perimeterLoadBreakdown 出力

### 参照した非機能要件
- **NFR-001**: 30fps維持（300ノード規模）
- **NFR-002**: 再計算5秒以内
- **NFR-102**: 計算失敗時のクラッシュ防止
- **NFR-301**: 手計算結果と +-20% 一致

### 参照したEdgeケース
- **EDGE-001**: ゾーン面積0以下の拒否

### 参照した受け入れ基準
- internalLoad 計算の正確性
- envelopeLoad 計算の正確性
- requiredAirflow 計算の正確性
- heatingLoad 計算の正確性
- perimeterLoadBreakdown の出力
- dirty -> 計算 -> updateNode サイクルの動作
- requestIdleCallback による非同期実行

### 参照した設計文書

- **アーキテクチャ**: architecture.md「計算パイプライン」「計算システム一覧」「再計算カスケード」
- **データフロー**: dataflow.md「機能1: ゾーン作成と負荷計算」シーケンス図
- **型定義**: interfaces.ts `HvacZoneNode`, `HvacZoneCalcResult`, `PerimeterSegment`, `DesignConditions`, `SolarCorrectionCoefficients`
- **既存スキーマ**: `packages/core/src/schema/nodes/hvac-zone.ts`（HvacZoneCalcResult Zod スキーマ）
- **既存スキーマ**: `packages/core/src/schema/nodes/hvac-shared.ts`（Orientation, ZoneUsage, PerimeterSegment）
- **マスタデータ**: `packages/core/src/data/load-unit-table.json`（負荷原単位テーブル）

---

## 6. 実装対象ファイル

| ファイルパス | 役割 | 新規/変更 |
|---|---|---|
| `packages/core/src/systems/hvac/load-calc-system.tsx` | LoadCalcSystem 本体 | 新規 |
| `packages/core/src/systems/hvac/load-calc.ts` | 純関数群（計算ロジック） | 新規 |
| `packages/core/src/systems/hvac/__tests__/load-calc.test.ts` | 単体テスト | 新規 |
| `packages/core/src/systems/hvac/__tests__/load-calc-system.test.tsx` | 統合テスト | 新規 |

### 依存ファイル（既存・変更なし）

| ファイルパス | 参照内容 |
|---|---|
| `packages/core/src/schema/nodes/hvac-zone.ts` | HvacZoneNode スキーマ、HvacZoneCalcResult |
| `packages/core/src/schema/nodes/hvac-shared.ts` | Orientation, ZoneUsage, PerimeterSegment |
| `packages/core/src/data/load-unit-table.json` | 負荷原単位テーブル |
| `packages/core/src/store/use-scene.ts` | useScene ストア（dirtyNodes, nodes, updateNode） |

---

## 7. 既存実装との乖離に関する注意事項

### 7.1 負荷原単位の値の乖離 🟡

TASK-0015 のコードサンプルに埋め込まれた定数値と `load-unit-table.json` の値が異なります。

| usage | TASK冷房 | JSON冷房 | TASK暖房 | JSON暖房 |
|---|---|---|---|---|
| office_general | 150 | **150** | 100 | **80** |
| office_server | 500 | **800** | 0 | **0** |
| conference | 200 | **200** | 120 | **100** |
| reception | 120 | **130** | 90 | **70** |
| corridor | 80 | **60** | 60 | **40** |

**方針**: `load-unit-table.json` をマスタデータとして参照し、コードに定数をハードコードしない。テストケースの期待値もJSON値に合わせる。

### 7.2 PerimeterLoadBreakdown の構造の乖離 🟡

TASK-0015 のコードサンプル:
```typescript
interface PerimeterLoadBreakdown {
  orientation: string
  load: number
  percentage: number
}
```

HvacZoneCalcResult スキーマ（既存）:
```typescript
z.object({
  orientation: Orientation,
  solarCorrectionFactor: z.number(),
  envelopeLoadContribution: z.number(),
})
```

**方針**: 既存 Zod スキーマの構造を正とする。

---

## 信頼性レベルサマリー

| # | 項目 | 信頼性 | 根拠 |
|---|---|---|---|
| 1 | 機能概要 | 🔵 | REQ-301, architecture.md |
| 2 | 入力: HvacZoneNode フィールド | 🔵 | REQ-203,205,206, 既存 Zod スキーマ |
| 3 | 入力: 負荷原単位テーブル | 🟡 | load-unit-table.json（値の乖離あり） |
| 4 | 入力: 日射補正係数 | 🔵 | REQ-303 |
| 5 | 入力: 物理定数 | 🔵 | REQ-304 |
| 6 | 出力: CalcResult 型 | 🔵 | 既存 HvacZoneCalcResult スキーマ |
| 7 | 出力: PerimeterLoadBreakdown | 🟡 | 既存スキーマとTASK記載に乖離 |
| 8 | 計算式（内部負荷） | 🔵 | REQ-302 |
| 9 | 計算式（外皮負荷） | 🔵 | REQ-303 |
| 10 | 計算式（冷房負荷合算） | 🔵 | REQ-301 |
| 11 | 計算式（風量） | 🔵 | REQ-304 |
| 12 | 計算式（暖房負荷） | 🔵 | REQ-305 |
| 13 | 非同期実行 | 🔵 | PRD 15.1, architecture.md |
| 14 | dirty-計算-updateNodeサイクル | 🔵 | CLAUDE.md, architecture.md |
| 15 | パフォーマンス要件 | 🔵 | NFR-001, NFR-002 |
| 16 | エラーハンドリング | 🔵 | NFR-102 |
| 17 | 不明用途のフォールバック | 🟡 | TASK記載あり、正式仕様なし |
| 18 | コードスタイル | 🔵 | CLAUDE.md |

**総合**: 🔵 15件 (83%), 🟡 3件 (17%), 🔴 0件 (0%)
