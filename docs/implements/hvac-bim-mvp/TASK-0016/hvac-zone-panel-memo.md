# HvacZonePanel + CalcResultPanel TDD開発完了記録

## 確認すべきドキュメント

- `docs/tasks/hvac-bim-mvp/TASK-0016.md`
- `docs/implements/hvac-bim-mvp/TASK-0016/hvac-zone-panel-requirements.md`
- `docs/implements/hvac-bim-mvp/TASK-0016/hvac-zone-panel-red-phase.md`
- `docs/implements/hvac-bim-mvp/TASK-0016/hvac-zone-panel-refactor-phase.md`

## 🎯 最終結果 (2026-03-26)
- **実装率**: 100% (29/29テストケース)
- **品質判定**: 合格（高品質）
- **スコープ内テスト成功率**: 100% (29/29)
- **スコープ外テスト**: 全通過（core: 142テスト, viewer: 49テスト）
- **TODO更新**: ✅完了マーク追加済み

## 💡 重要な技術学習

### 実装パターン

- **vitest実行はパッケージディレクトリから**: `packages/editor/vitest.config.ts` に `environment: 'happy-dom'` が設定されているため、ルートから `npx vitest run` すると `document is not defined` エラーが発生する。正しくは `cd packages/editor && npx vitest run ...`
- **type guardパターン**: `as unknown as HvacZoneNode` キャスト → `isHvacZoneNode()` type guard関数でtype safetyを確保（Refactorで改善）
- **useSceneセレクター最適化**: 複数の `useScene()` 呼び出し → 1回に集約し、対象ノードのみを取得してサブスクリプションを最小化
- **型エイリアス派生**: `type CalcResult = NonNullable<HvacZoneNode['calcResult']>` でスキーマ変更時の自動追従を実現

### テスト設計

- **モック戦略**: `vi.mock('@pascal-app/core')` + `vi.mock('@pascal-app/viewer')` でストア依存を完全分離
- **境界値テスト**: formatLoadのkW閾値（1000W/999W）・ゼロ値（0W）を明示的にテスト
- **updateNode呼び出し確認**: `vi.fn()` でupdateNodeをモックし、`fireEvent.change` 後に `expect(mockUpdateNode).toHaveBeenCalledWith(id, {field: value})` で検証

### 品質保証

- **formatLoad REQ-1505準拠**: `KW_THRESHOLD = 1000` 定数によるマジックナンバー除去
- **Biomeチェック**: `bun run check` でエラー・警告なし
- **ファイルサイズ**: format-load.ts(28行) / hvac-zone-panel.tsx(297行) / calc-result-panel.tsx(210行)、全て500行以下

## 仕様情報（再利用重要）

### formatLoad関数（REQ-1505）
- `watts >= 1000` → `${(watts / 1000).toFixed(1)} kW`
- `watts < 1000` → `${Math.round(watts)} W`
- 定数: `KW_THRESHOLD = 1000`

### HvacZonePanel構成
- `BasicInfoSection`: zoneName（input）/ usage（select 5種）/ floorArea（読取専用）/ ceilingHeight（number input）/ occupantDensity（number input, step=0.01）
- `DesignConditionsSection`: coolingSetpoint / heatingSetpoint / supplyAirTempDiff（全て number input）
- `PerimeterSection`: テーブル（方位/壁面積/ガラス面積比%）or 誘導メッセージ

### CalcResultPanel構成
- calcResult=null → 「計算結果がありません。ゾーンの設定を完了してください。」メッセージ
- 負荷サマリー dl: coolingLoad / heatingLoad / requiredAirflow（toLocaleString() + m³/h）
- 負荷内訳 dl: internalLoad / envelopeLoad
- 方位別テーブル: orientation / load(formatLoad) / percentage(toFixed(1)%)

### ZoneUsage select options
- `office_general`: 一般オフィス
- `conference`: 会議室
- `reception`: 受付/ロビー
- `office_server`: サーバー室
- `corridor`: 廊下
