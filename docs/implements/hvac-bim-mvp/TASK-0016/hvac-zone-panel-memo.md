# TDD開発メモ: HvacZonePanel + CalcResultPanel

## 概要

- 機能名: HvacZonePanel + CalcResultPanel
- 開発開始: 2026-03-26
- 現在のフェーズ: Red

## 関連ファイル

- 元タスクファイル: `docs/tasks/hvac-bim-mvp/TASK-0016.md`
- 要件定義: `docs/implements/hvac-bim-mvp/TASK-0016/hvac-zone-panel-requirements.md`
- Redフェーズ記録: `docs/implements/hvac-bim-mvp/TASK-0016/hvac-zone-panel-red-phase.md`
- 実装ファイル（予定）:
  - `packages/editor/src/components/ui/panels/hvac/format-load.ts`
  - `packages/editor/src/components/ui/panels/hvac/hvac-zone-panel.tsx`
  - `packages/editor/src/components/ui/panels/hvac/calc-result-panel.tsx`
- テストファイル:
  - `packages/editor/src/components/ui/panels/hvac/__tests__/format-load.test.ts`
  - `packages/editor/src/components/ui/panels/hvac/__tests__/hvac-zone-panel.test.tsx`
  - `packages/editor/src/components/ui/panels/hvac/__tests__/calc-result-panel.test.tsx`

## Redフェーズ（失敗するテスト作成）

### 作成日時

2026-03-26

### テストケース

**format-load.test.ts**（8テスト）:
- formatLoad関数の数値フォーマット変換（kW/W表記、境界値）

**hvac-zone-panel.test.tsx**（11テスト）:
- ゾーン基本情報表示（zoneName/floorArea/ceilingHeight）
- 用途select（5種類のオプション）
- 各フィールド変更時のupdateNode呼び出し確認
- perimeterSegmentsテーブル/空配列時の誘導メッセージ
- 非HvacZoneノード/選択なし時のnull返却

**calc-result-panel.test.tsx**（10テスト）:
- calcResult=null時のメッセージ表示
- coolingLoad/heatingLoad/internalLoadのkW表記
- requiredAirflowのm³/h表記
- perimeterLoadBreakdownテーブル表示
- ラベル（冷房負荷/暖房負荷/必要風量/内部負荷/外皮負荷）存在確認

### 期待される失敗

全テストは実装ファイルが存在しないため `ERR_MODULE_NOT_FOUND` で失敗。
実行コマンド:
```
npx vitest run packages/editor/src/components/ui/panels/hvac/__tests__/format-load.test.ts
npx vitest run packages/editor/src/components/ui/panels/hvac/__tests__/hvac-zone-panel.test.tsx
npx vitest run packages/editor/src/components/ui/panels/hvac/__tests__/calc-result-panel.test.tsx
```

### 次のフェーズへの要求事項

Greenフェーズで以下の3ファイルを実装する：

1. **`format-load.ts`**: `formatLoad(watts: number): string` 関数
   - 1000W以上 → `${(watts/1000).toFixed(1)} kW`
   - 1000W未満 → `${Math.round(watts)} W`

2. **`hvac-zone-panel.tsx`**: `HvacZonePanel` コンポーネント
   - useViewer(selectedIds)、useScene(nodes, updateNode)から取得
   - type !== 'hvac_zone' または selectedIds 空の場合 null 返却
   - BasicInfoSection（zoneName/usage/floorArea/ceilingHeight/occupantDensity）
   - DesignConditionsSection（coolingSetpoint/heatingSetpoint/supplyAirTempDiff）
   - PerimeterSection（テーブルまたは誘導メッセージ）

3. **`calc-result-panel.tsx`**: `CalcResultPanel` コンポーネント
   - calcResult=null → 「計算結果がありません。ゾーンの設定を完了してください。」
   - 負荷サマリーdl（formatLoad + m³/h）
   - 負荷内訳dl（formatLoad）
   - 方位別テーブル

## Greenフェーズ（最小実装）

### 実装日時

（未実施）

### 実装方針

（未実施）

### 実装コード

（未実施）

### テスト結果

（未実施）

### 課題・改善点

（未実施）

## Refactorフェーズ（品質改善）

### リファクタ日時

（未実施）
