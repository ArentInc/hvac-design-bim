# TDD Greenフェーズ記録: HvacZonePanel + CalcResultPanel

**タスクID**: TASK-0016
**要件名**: hvac-bim-mvp
**機能名**: HvacZonePanel + CalcResultPanel
**フェーズ**: Green（最小実装完了）
**作成日**: 2026-03-26

---

## 実装結果サマリー

**テスト結果**: 29/29 全通過 ✅

| ファイル | テスト数 | 結果 |
|---------|---------|------|
| format-load.test.ts | 8 | ✅ 全通過 |
| hvac-zone-panel.test.tsx | 11 | ✅ 全通過 |
| calc-result-panel.test.tsx | 10 | ✅ 全通過 |

---

## 実装ファイル

### 1. `packages/editor/src/components/ui/panels/hvac/format-load.ts`

**実装方針**: REQ-1505フォーマット仕様に準拠した最小実装。1000W以上はkW表記（toFixed(1)）、未満はW表記（Math.round）。

```typescript
// 【機能概要】: 負荷値（W）をPRDセクション21.5フォーマット（REQ-1505）に変換するユーティリティ
export function formatLoad(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(1)} kW`
  }
  return `${Math.round(watts)} W`
}
```

**信頼性**: 🔵（requirements.md 2.2、REQ-1505に明示）
**行数**: 22行

---

### 2. `packages/editor/src/components/ui/panels/hvac/hvac-zone-panel.tsx`

**実装方針**:
- `HvacZonePanel`: useViewer(selectedIds) + useScene(nodes, updateNode)から取得、型チェック後にサブコンポーネントへ委譲
- `BasicInfoSection`: zoneName/usage/floorArea/ceilingHeight/occupantDensityの表示・編集
- `DesignConditionsSection`: coolingSetpoint/heatingSetpoint/supplyAirTempDiffの表示・編集（designConditions既存値を保持しながら部分更新）
- `PerimeterSection`: 空配列時は誘導メッセージ、非空時はテーブル表示

**修正内容**: テスト7で `getByText('27.0')` が複数マッチする問題（モックデータS/Eが同値）のため、テストコードを `getAllByText` に修正（スキップ・削除ではなく意図を維持した修正）

**信頼性**: 🔵（requirements.md 2.1、REQ-203/204/205に明示）
**行数**: 177行

---

### 3. `packages/editor/src/components/ui/panels/hvac/calc-result-panel.tsx`

**実装方針**:
- `CalcResultPanel`: selectedIds空 → null、calcResult=null → メッセージ表示、設定済み → CalcResultDetails
- `CalcResultDetails`: 負荷サマリーdl（formatLoad + m³/h）、負荷内訳dl、方位別テーブル（割合%）

**信頼性**: 🔵（requirements.md 2.2、REQ-301/306/1505に明示）
**行数**: 124行

---

## テスト実行結果

```
Test Files: 3 passed (3)
      Tests: 29 passed (29)
   Duration: 3.54s
```

実行コマンド:
```bash
cd packages/editor && npx vitest run src/components/ui/panels/hvac/__tests__/
```

---

## 課題・改善点（Refactorフェーズで対応）

1. **型安全性**: `as unknown as HvacZoneNode` キャストをtype guardで置き換える
2. **スタイリング**: CSSクラス未設定（既存パネルのスタイルパターンに合わせる）
3. **USAGE_LABELS**: 別ファイルに定数として切り出す
4. **型定義の重複**: `HvacZoneCalcResultType` をcoreのimportに置き換える
5. **テストコード修正**: `getByText('27.0')` → `getAllByText` への修正（意図維持）

---

## 品質判定

```
✅ 高品質:
- テスト結果: 全29テスト成功
- 実装品質: シンプルかつ動作する
- リファクタ箇所: 上記5点が明確に特定可能
- 機能的問題: なし
- コンパイルエラー: なし
- ファイルサイズ: 全ファイル800行以下
- モック使用: 実装コードにモック・スタブ不使用
```
