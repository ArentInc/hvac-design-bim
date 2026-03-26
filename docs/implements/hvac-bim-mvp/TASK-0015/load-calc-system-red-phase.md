# TDD Redフェーズ記録: load-calc-system

**タスクID**: TASK-0015
**機能名**: load-calc-system
**要件名**: hvac-bim-mvp
**フェーズ**: Red（失敗するテスト作成）
**作成日**: 2026-03-26

---

## 1. 作成したテストケース一覧

### 実装済みテストケース（合計 20 件）

| テストID | テスト名 | 分類 | 信頼性 |
|---|---|---|---|
| TC-N01 | 一般オフィスの内部冷房負荷が正しく算出される | 正常系 | 🔵 |
| TC-N02 | サーバー室の内部冷房負荷が正しく算出される | 正常系 | 🔵 |
| TC-N03 | 会議室の内部冷房負荷が正しく算出される | 正常系 | 🔵 |
| TC-N04 | 受付ロビーの内部冷房負荷が正しく算出される | 正常系 | 🔵 |
| TC-N05 | 廊下の内部冷房負荷が正しく算出される | 正常系 | 🔵 |
| TC-N06 | 南面のみの外皮負荷が正しく算出される | 正常系 | 🔵 |
| TC-N07 | 複数方位の外皮負荷が正しく合算される | 正常系 | 🔵 |
| TC-N08 | 方位別外皮負荷内訳が正しく出力される | 正常系 | 🔵 |
| TC-N09 | 冷房負荷が内部負荷と外皮負荷の合計として正しく算出される | 正常系 | 🔵 |
| TC-N10 | 冷房負荷から必要風量が正しく算出される | 正常系 | 🔵 |
| TC-N11 | 送風温度差を省略した場合にデフォルト値（10K）が適用される | 正常系 | 🔵 |
| TC-N12 | 一般オフィスの暖房負荷が正しく算出される | 正常系 | 🔵 |
| TC-N13 | サーバー室の暖房負荷が 0 になる | 正常系 | 🔵 |
| TC-N14 | 全 8 方位の日射補正係数が設計値と一致する | 正常系 | 🔵 |
| TC-N15 | ゾーン全体の負荷計算が正しく統合される | 正常系 | 🔵 |
| TC-N16 | calculateZoneLoad の戻り値が HvacZoneCalcResult スキーマでパースできる | 正常系 | 🔵 |
| TC-N17 | 全 5 用途タイプで暖房負荷が正しく算出される | 正常系 | 🔵 |
| TC-E01 | 送風温度差が 0 の場合にゼロ除算せず 0 を返す | 異常系 | 🔵 |
| TC-E02 | 送風温度差が負の値の場合に 0 を返す | 異常系 | 🔵 |
| TC-E03 | 床面積が負の値の場合にエラーステータスが返される | 異常系 | 🟡 |
| TC-E04 | 床面積が 0 の場合にエラーステータスが返される | 異常系 | 🟡 |
| TC-E05 | 計算中に例外が発生した場合にエラーステータスが返される | 異常系 | 🟡 |
| TC-E06 | 未知の usage が指定された場合にデフォルト値でフォールバックする | 異常系 | 🟡 |
| TC-B01 | ペリメータセグメントが空の場合に外皮負荷が 0 になる | 境界値 | 🔵 |
| TC-B02 | ガラス面積比が 0 の場合に外皮負荷が 0 になる | 境界値 | 🔵 |
| TC-B03 | ガラス面積比が 1.0 の場合に外皮負荷が最大になる | 境界値 | 🔵 |
| TC-B06 | 冷房負荷が 0 の場合に必要風量が 0 になる | 境界値 | 🔵 |
| TC-B07 | 全 8 方位のセグメントが同時に存在する場合に正しく合算される | 境界値 | 🔵 |
| TC-B08 | 同じ方位に複数セグメントがある場合に正しく処理される | 境界値 | 🟡 |

**信頼性レベル分布**: 🔵 青信号 23件 (79%), 🟡 黄信号 6件 (21%), 🔴 赤信号 0件 (0%)

---

## 2. テストファイルのパス

- `packages/core/src/systems/hvac/__tests__/load-calc.test.ts`

---

## 3. 期待される失敗内容

テスト実行時に以下のエラーが発生することを確認済み:

```
Error: Cannot find module '../load-calc' imported from ...load-calc.test.ts
  Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }
```

**理由**: `packages/core/src/systems/hvac/load-calc.ts` がまだ存在しないため、
インポート時点でモジュール解決エラーが発生する。

---

## 4. テスト実行コマンド

```bash
# 新規作成したテストファイルのみ実行
npx vitest run packages/core/src/systems/hvac/__tests__/load-calc.test.ts

# テストファイル + ウォッチモード
npx vitest packages/core/src/systems/hvac/__tests__/load-calc.test.ts
```

---

## 5. Greenフェーズで実装すべき内容

### 実装対象ファイル

| ファイルパス | 役割 | 新規/変更 |
|---|---|---|
| `packages/core/src/systems/hvac/load-calc.ts` | 純関数群（計算ロジック） | **新規** |

### エクスポートすべき関数・定数

```typescript
// 日射補正係数テーブル（REQ-303）
export const SOLAR_COEFFICIENTS: Record<Orientation, number>
// S=1.0, SE=1.1, SW=1.1, E=1.2, W=1.2, NE=0.8, NW=0.8, N=0.6

// 内部負荷計算（REQ-302）
export function calculateInternalLoad(floorArea: number, usage: ZoneUsage): number

// 外皮負荷計算（REQ-303）
export function calculateEnvelopeLoad(segments: PerimeterSegment[]): {
  total: number
  breakdown: Array<{
    orientation: Orientation
    solarCorrectionFactor: number
    envelopeLoadContribution: number
  }>
}

// 冷房負荷合算（REQ-301）
export function calculateCoolingLoad(internalLoad: number, envelopeLoad: number): number

// 必要風量計算（REQ-304）
export function calculateRequiredAirflow(coolingLoad: number, supplyAirTempDiff?: number): number
// ρ=1.2, Cp=1005, ΔT デフォルト 10K, Math.round で整数丸め
// supplyAirTempDiff <= 0 の場合は 0 を返す

// 暖房負荷計算（REQ-305）
export function calculateHeatingLoad(floorArea: number, usage: ZoneUsage): number

// 統合計算（REQ-301〜306）
export function calculateZoneLoad(zone: {
  floorArea: number
  usage: ZoneUsage
  perimeterSegments: PerimeterSegment[]
  designConditions?: { supplyAirTempDiff?: number }
}): HvacZoneCalcResultType
// floorArea <= 0 の場合は status='error' を返す
// try-catch で例外を捕捉し、status='error' を返す
```

### 実装時の注意事項

1. **負荷原単位テーブル**: `packages/core/src/data/load-unit-table.json` を参照（コードに定数をハードコードしない）
2. **物理定数**: 空気密度=1.2 kg/m^3, 空気比熱=1005 J/(kg·K), ベース外皮負荷=200 W/m^2
3. **perimeterLoadBreakdown の構造**: `HvacZoneCalcResult` Zod スキーマ（hvac-zone.ts）の構造を厳守
4. **Three.js インポート禁止**: Core パッケージのルール
5. **コードスタイル**: Biome 準拠（2スペース, シングルクォート, セミコロンなし, 100文字行幅）

---

## 6. 品質評価

### テスト実行結果

- **失敗確認**: ✅ `ERR_MODULE_NOT_FOUND` でテストが失敗することを確認
- **期待値**: ✅ 明確で具体的（数値計算値が明示）
- **アサーション**: ✅ 適切（toBe, toHaveLength, toBeDefined, toHaveProperty 等）
- **実装方針**: ✅ 明確（エクスポート関数・定数が定義済み）
- **信頼性レベル**: ✅ 🔵 青信号が多数（79%）

### 判定: ✅ 高品質
