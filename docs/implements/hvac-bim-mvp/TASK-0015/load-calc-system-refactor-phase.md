# TDD Refactorフェーズ記録: load-calc-system

**タスクID**: TASK-0015
**機能名**: load-calc-system
**要件名**: hvac-bim-mvp
**フェーズ**: Refactor（品質改善）
**実施日**: 2026-03-26

---

## 1. リファクタリング概要

### 改善対象ファイル

| ファイルパス | 改善内容 |
|---|---|
| `packages/core/src/systems/hvac/load-calc.ts` | 物理定数グループ化・型エイリアス整理・型エクスポート・コメント改善 |

### 改善前後の行数

| | 行数 |
|---|---|
| Greenフェーズ（改善前） | 308行 |
| Refactorフェーズ（改善後） | 337行（コメント強化による増加） |

---

## 2. 改善内容詳細

### 改善1: ファイルヘッダコメントの本番品質化 🔵

**Before:**
```typescript
// 【実装方針】: TASK-0015 の TDD Green フェーズ最小実装
```

**After:**
```typescript
// 【設計方針】:
//   - load-unit-table.json をマスタデータとして参照（定数ハードコード禁止）
//   - 副作用なしの純関数として設計（テスタビリティ・再利用性を重視）
//   - Three.js インポート禁止（Core パッケージのアーキテクチャ制約）
```

Green フェーズ用の文言を本番コードとして適切な設計方針の説明に置き換えた。 🔵

---

### 改善2: 型エイリアスの整理と型エクスポート 🔵

**Before:**
```typescript
// z.infer が各シグネチャで重複
function getLoadUnitEntry(usage: z.infer<typeof ZoneUsage>): { ... }
export function calculateInternalLoad(floorArea: number, usage: z.infer<typeof ZoneUsage>): number
export function calculateEnvelopeLoad(segments: z.infer<typeof PerimeterSegment>[]): EnvelopeLoadResult
export function calculateHeatingLoad(floorArea: number, usage: z.infer<typeof ZoneUsage>): number
// EnvelopeLoadResult と ZoneInput は内部型のみ（非エクスポート）
```

**After:**
```typescript
// 型エイリアスを1箇所に集約
type OrientationType = z.infer<typeof Orientation>
type ZoneUsageType = z.infer<typeof ZoneUsage>
type PerimeterSegmentType = z.infer<typeof PerimeterSegment>

// シグネチャが読みやすくなった
function getLoadUnitEntry(usage: ZoneUsageType): LoadUnitEntry
export function calculateInternalLoad(floorArea: number, usage: ZoneUsageType): number
export function calculateEnvelopeLoad(segments: PerimeterSegmentType[]): EnvelopeLoadResult
export function calculateHeatingLoad(floorArea: number, usage: ZoneUsageType): number

// EnvelopeLoadResult と ZoneInput を export 型として公開
export type EnvelopeLoadResult = { ... }
export type ZoneInput = { ... }
```

`z.infer<typeof ...>` の重複を型エイリアスで集約し、関数シグネチャの可読性を向上。
後続モジュール（load-calc-system.tsx 等）が `ZoneInput` / `EnvelopeLoadResult` を再利用できるようエクスポートを追加した。 🔵

---

### 改善3: 物理定数のグループ化 🔵

**Before:**
```typescript
const AIR_DENSITY = 1.2
const AIR_SPECIFIC_HEAT = 1005
const BASE_ENVELOPE_LOAD = 200
const DEFAULT_SUPPLY_AIR_TEMP_DIFF = 10
```

**After:**
```typescript
const PHYSICS_CONSTANTS = {
  /** 【空気密度】: 1.2 kg/m^3（標準大気圧・20°C 相当の値） */
  AIR_DENSITY: 1.2,
  /** 【空気比熱】: 1005 J/(kg·K)（乾燥空気の定圧比熱） */
  AIR_SPECIFIC_HEAT: 1005,
  /** 【ベース外皮負荷】: 200 W/m^2（ガラス面の基準熱貫流負荷） */
  BASE_ENVELOPE_LOAD: 200,
  /** 【デフォルト送風温度差】: 10 K（hvac-zone.ts の supplyAirTempDiff デフォルト値と一致） */
  DEFAULT_SUPPLY_AIR_TEMP_DIFF: 10,
} as const
```

関連する物理定数を1つのオブジェクトにまとめてグループ化した。
`as const` でリテラル型推論・不変性を保証。将来の高地対応などで定数を調整する際の場所が明確になった。 🔵

---

### 改善4: `LoadUnitEntry` 型の定義 🔵

**Before:**
```typescript
function getLoadUnitEntry(usage: ...): {
  coolingLoadPerArea: number
  heatingLoadPerArea: number
} {
```

**After:**
```typescript
type LoadUnitEntry = {
  coolingLoadPerArea: number
  heatingLoadPerArea: number
}

function getLoadUnitEntry(usage: ...): LoadUnitEntry {
```

戻り値型を匿名インライン型からnamed型エイリアスに変更し、再利用性と可読性を向上させた。 🔵

---

### 改善5: ヘルパー関数コメントの強化 🟡

`getLoadUnitEntry` のコメントに `【ヘルパー関数】`・`【再利用性】`・`【単一責任】` のセクションを追加し、設計意図を明示した。

---

## 3. セキュリティレビュー結果

| 項目 | 結果 |
|---|---|
| 入力値検証 | ✅ `floorArea <= 0` を検証済み、Zod スキーマで型レベル保護 |
| SQLインジェクション | ✅ 該当なし（DB操作なし、JSON読み込みのみ） |
| XSS | ✅ 該当なし（UI操作なし、純計算関数） |
| CSRF | ✅ 該当なし |
| データ漏洩 | ✅ 該当なし（外部通信なし） |
| ゼロ除算 | ✅ `supplyAirTempDiff <= 0` で防御済み |
| 例外安全 | ✅ `calculateZoneLoad` で try-catch 済み |

**総合判定**: 重大な脆弱性なし 🔵

---

## 4. パフォーマンスレビュー結果

| 項目 | 結果 |
|---|---|
| `getLoadUnitEntry` の計算量 | O(n)だがテーブルサイズが5行固定のため実用上問題なし |
| `loadUnitTable` の読み込み | モジュール評価時に1回だけ（再読み込みなし） |
| `calculateEnvelopeLoad` の計算量 | O(m)（m=ペリメータセグメント数、通常1〜8程度） |
| メモリ | 各関数呼び出しで小さな配列を生成するのみ（問題なし） |
| requestIdleCallback | load-calc-system.tsx で実装予定（本ファイルは対象外） |

**総合判定**: 重大な性能課題なし 🔵

---

## 5. テスト実行結果

```
 ✓ packages/core/src/systems/hvac/__tests__/load-calc.test.ts (29 tests) 25ms

 Test Files  1 passed (1)
      Tests  29 passed (29)
   Start at  21:51:11
   Duration  751ms
```

**全29テストケースが引き続き通過。**

---

## 6. コード品質チェック結果

| チェック項目 | 結果 |
|---|---|
| Biome（lint + format） | ✅ エラーなし |
| TypeScript 型チェック | ✅ エラーなし |
| ファイルサイズ | ✅ 337行（500行制限以内） |
| テスト除外 | ✅ skip/xtest なし |

---

## 7. 改善されたコードの構造

```
packages/core/src/systems/hvac/load-calc.ts (337行)
├── ファイルヘッダ（設計方針コメント）
├── 型定義セクション
│   ├── OrientationType, ZoneUsageType, PerimeterSegmentType（型エイリアス）
│   ├── HvacZoneCalcResultType
│   ├── export type EnvelopeLoadResult ★エクスポート追加
│   └── export type ZoneInput         ★エクスポート追加
├── 定数定義セクション
│   ├── SOLAR_COEFFICIENTS（export）
│   └── PHYSICS_CONSTANTS             ★物理定数グループ化
├── ヘルパー関数セクション
│   ├── type LoadUnitEntry             ★新規型定義
│   └── getLoadUnitEntry（private）
└── 公開関数セクション
    ├── calculateInternalLoad
    ├── calculateEnvelopeLoad
    ├── calculateCoolingLoad
    ├── calculateRequiredAirflow
    ├── calculateHeatingLoad
    └── calculateZoneLoad（統合計算）
```

---

## 8. 信頼性レベルサマリー

| 改善項目 | 信頼性 | 根拠 |
|---|---|---|
| ヘッダコメントの本番品質化 | 🔵 | 既存設計方針に基づく |
| 型エイリアス整理・エクスポート | 🔵 | REQ-306、後続モジュール連携の必要性 |
| 物理定数グループ化 | 🔵 | REQ-304 に全定数が明示 |
| LoadUnitEntry 型定義 | 🔵 | load-unit-table.json の構造に対応 |
| ヘルパー関数コメント強化 | 🟡 | コメントテンプレートに基づく改善 |
