# TDD Greenフェーズ記録: load-calc-system

**タスクID**: TASK-0015
**機能名**: load-calc-system
**要件名**: hvac-bim-mvp
**フェーズ**: Green（最小実装）
**実装日**: 2026-03-26

---

## 1. 実装概要

### 実装したファイル

| ファイルパス | 役割 | 新規/変更 |
|---|---|---|
| `packages/core/src/systems/hvac/load-calc.ts` | 純関数群（計算ロジック） | **新規** |

### 実装方針

1. **`load-unit-table.json` を参照**: 定数をコードにハードコードせず、JSON マスタデータを参照
2. **純関数設計**: 副作用なし、全てエクスポート関数として実装
3. **例外安全**: `calculateZoneLoad` に try-catch を設け NFR-102 を満たす
4. **ゼロ除算防止**: `supplyAirTempDiff <= 0` の場合は 0 を返す
5. **バリデーション**: `floorArea <= 0` の場合はエラーステータスを返す
6. **不正方位のエラー化**: `SOLAR_COEFFICIENTS` に存在しない orientation が渡された場合に例外をスロー（TC-E05 対応）

---

## 2. 実装コード

### `packages/core/src/systems/hvac/load-calc.ts`（308行）

```typescript
// エクスポートした関数・定数:
export const SOLAR_COEFFICIENTS: Record<Orientation, number>
export function calculateInternalLoad(floorArea: number, usage: ZoneUsage): number
export function calculateEnvelopeLoad(segments: PerimeterSegment[]): EnvelopeLoadResult
export function calculateCoolingLoad(internalLoad: number, envelopeLoad: number): number
export function calculateRequiredAirflow(coolingLoad: number, supplyAirTempDiff?: number): number
export function calculateHeatingLoad(floorArea: number, usage: ZoneUsage): number
export function calculateZoneLoad(zone: ZoneInput): HvacZoneCalcResultType
```

主な実装判断:
- `SOLAR_COEFFICIENTS`: S=1.0, SE/SW=1.1, E/W=1.2, NE/NW=0.8, N=0.6（REQ-303 通り）
- `calculateEnvelopeLoad`: セグメントごとに計算し `breakdown` 配列にも格納（HvacZoneCalcResult スキーマ準拠）
- `calculateRequiredAirflow`: `coolingLoad / (1.2 × 1005 × ΔT) × 3600` → `Math.round` で整数丸め
- `getLoadUnitEntry`（内部ヘルパー）: JSON ファイルを検索し、未知の usage は `office_general` にフォールバック

---

## 3. テスト実行結果

```
 ✓ packages/core/src/systems/hvac/__tests__/load-calc.test.ts (29 tests) 21ms

 Test Files  1 passed (1)
      Tests  29 passed (29)
   Start at  21:44:11
   Duration  546ms
```

**全29テストケースが通過。**

---

## 4. 品質評価

### 品質判定: ✅ 高品質

| 項目 | 結果 |
|---|---|
| テスト結果 | ✅ 29/29 全通過 |
| 実装品質 | ✅ シンプルかつ動作する |
| リファクタ箇所 | ✅ 明確に特定可能 |
| 機能的問題 | ✅ なし |
| Biome チェック | ✅ エラーなし |
| 型チェック（load-calc.ts） | ✅ エラーなし |
| ファイルサイズ | ✅ 308行（800行以下） |
| モック使用 | ✅ 実装コードにモック・スタブなし |

---

## 5. 課題・改善点（Refactorフェーズで対応）

1. **型アサーションの整理**: `getLoadUnitEntry` の戻り値型をより厳密にできる
2. **`ZoneInput` 型の改善**: `z.infer` の重複使用を整理
3. **物理定数のグループ化**: `AIR_DENSITY`, `AIR_SPECIFIC_HEAT`, `BASE_ENVELOPE_LOAD` をオブジェクト定数にまとめる
4. **コメントの整理**: 開発時コメントを整理し、本番コードとして適切な粒度に調整
5. **型エクスポートの検討**: `EnvelopeLoadResult` 型をエクスポートして他モジュールから参照可能にする
