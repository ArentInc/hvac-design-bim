# hvac-bim-mvp タスク概要

**作成日**: 2026-03-26
**推定工数**: 364時間
**総タスク数**: 46件

## 関連文書

- **要件定義書**: [requirements.md](../../spec/hvac-bim-mvp/requirements.md)
- **設計文書**: [architecture.md](../../design/hvac-bim-mvp/architecture.md)
- **データフロー図**: [dataflow.md](../../design/hvac-bim-mvp/dataflow.md)
- **インターフェース定義**: [interfaces.ts](../../design/hvac-bim-mvp/interfaces.ts)
- **コンテキストノート**: [note.md](../../spec/hvac-bim-mvp/note.md)
- **設計ヒアリング**: [design-interview.md](../../design/hvac-bim-mvp/design-interview.md)

## フェーズ構成

| フェーズ | 成果物 | タスク数 | 工数 | ファイル |
|---------|--------|----------|------|----------|
| Phase 1 - 基盤整備 (MVP-0) | スキーマ、データ、ストア拡張、UI基盤 | 10件 | 76h | [TASK-0001~0010](#phase-1-基盤整備-mvp-0) |
| Phase 2 - ゾーニング+負荷計算 (MVP-1) | ゾーンレンダラー、描画ツール、負荷計算 | 8件 | 64h | [TASK-0011~0018](#phase-2-ゾーニング--負荷計算-mvp-1) |
| Phase 3 - 系統構成+機器配置 (MVP-2) | 系統集計、AHU/制気口レンダラー・ツール | 9件 | 72h | [TASK-0019~0027](#phase-3-系統構成--機器配置-mvp-2) |
| Phase 4 - ダクト+配管 (MVP-3) | ダクト/配管レンダラー・ツール・計算システム | 10件 | 80h | [TASK-0028~0037](#phase-4-ダクト--配管ルーティング-mvp-3) |
| Phase 5 - 警告+UI統合+デモ (MVP-4) | バリデーション、プリセット、デモ検証 | 9件 | 72h | [TASK-0038~0046](#phase-5-警告--ui統合--デモ-mvp-4) |

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0046
**次回開始番号**: TASK-0047

## 全体進捗

- [x] Phase 1: 基盤整備 (MVP-0)
- [ ] Phase 2: ゾーニング + 負荷計算 (MVP-1) *(TASK-0018のみ未完了)*
- [x] Phase 3: 系統構成 + 機器配置 (MVP-2)
- [ ] Phase 4: ダクト + 配管ルーティング (MVP-3)
- [ ] Phase 5: 警告 + UI統合 + デモ (MVP-4)

## マイルストーン

- **M1: 基盤完成**: スキーマ・データ・ストア拡張・UI基盤が動作
- **M2: ゾーニング完成**: ゾーン描画→負荷計算→結果表示が一連動作
- **M3: 機器配置完成**: 系統グルーピング→AHU/制気口配置が動作
- **M4: ルーティング完成**: ダクト/配管ルーティング→風量配分→寸法→圧損が動作
- **M5: MVP完成**: 全警告→プリセット→ワンパスデモが通し動作

---

## Phase 1: 基盤整備 (MVP-0)

**目標**: HVAC機能の基盤（スキーマ、データ、ストア拡張、UI基盤）を構築
**成果物**: 7 HVACノードスキーマ、サンプルデータ、useEditor拡張、モード切替UI

### タスク一覧

- [x] [TASK-0001: vitest導入 + テスト基盤構築](TASK-0001.md) - 8h (DIRECT) 🟡
- [x] [TASK-0002: HvacZoneNode + SystemNode スキーマ定義](TASK-0002.md) - 8h (TDD) 🔵
- [x] [TASK-0003: AhuNode + DiffuserNode スキーマ定義](TASK-0003.md) - 8h (TDD) 🔵
- [x] [TASK-0004: DuctSegmentNode + DuctFittingNode + PipeSegmentNode スキーマ定義](TASK-0004.md) - 8h (TDD) 🔵
- [x] [TASK-0005: AnyNode統合 + LevelNode.children拡張 + sceneRegistry拡張](TASK-0005.md) - 8h (TDD) 🔵
- [x] [TASK-0006: サンプルデータJSON作成](TASK-0006.md) - 8h (DIRECT) 🔵
- [x] [TASK-0007: useEditor拡張 — EditorMode + Phase型拡張 + HvacTool型](TASK-0007.md) - 8h (TDD) 🔵
- [x] [TASK-0008: イベントバス拡張 — HVACノードイベント型追加](TASK-0008.md) - 4h (TDD) 🔵
- [x] [TASK-0009: 接続グラフユーティリティ — hvac-graph.ts](TASK-0009.md) - 8h (TDD) 🟡
- [x] [TASK-0010: モード切替UI + フェーズ切替タブ + NodeRenderer分岐追加](TASK-0010.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0001 → TASK-0002, TASK-0003, TASK-0004, TASK-0007
TASK-0002, TASK-0003, TASK-0004 → TASK-0005
TASK-0005 → TASK-0008, TASK-0010
TASK-0007 → TASK-0010
TASK-0004 → TASK-0009
TASK-0006 (独立)
```

---

## Phase 2: ゾーニング + 負荷計算 (MVP-1)

**目標**: ゾーン描画→外皮条件入力→負荷計算→結果表示の一連フローを構築
**成果物**: HvacZoneRenderer、描画/編集ツール、LoadCalcSystem、プロパティパネル

### タスク一覧

- [x] [TASK-0011: 建築参照読込 + サンプル建築JSON表示](TASK-0011.md) - 8h (TDD) 🔵
- [x] [TASK-0012: HvacZoneRenderer — ゾーン3D描画](TASK-0012.md) - 8h (TDD) 🔵
- [x] [TASK-0013: ZoneDrawTool — ゾーン境界描画ツール](TASK-0013.md) - 8h (TDD) 🔵
- [x] [TASK-0014: PerimeterEditTool — 外皮条件入力](TASK-0014.md) - 8h (TDD) 🔵
- [x] [TASK-0015: LoadCalcSystem — 負荷概算計算エンジン](TASK-0015.md) - 8h (TDD) 🔵
- [x] [TASK-0016: HvacZonePanel + CalcResultPanel — ゾーンプロパティ表示](TASK-0016.md) - 8h (TDD) 🔵
- [x] [TASK-0017: ZoneListPanel — ゾーン一覧サイドバー](TASK-0017.md) - 8h (TDD) 🔵
- [x] [TASK-0018: ゾーン操作フィードバック — 面積リアルタイム表示 + カラーフェードイン](TASK-0018.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0006, TASK-0010 → TASK-0011
TASK-0005, TASK-0008 → TASK-0012
TASK-0012 → TASK-0013, TASK-0014, TASK-0016, TASK-0017
TASK-0011 → TASK-0014
TASK-0002, TASK-0006 → TASK-0015
TASK-0015 → TASK-0016, TASK-0018
TASK-0013 → TASK-0018
```

---

## Phase 3: 系統構成 + 機器配置 (MVP-2)

**目標**: ゾーングルーピング→系統集計→AHU候補選定→AHU/制気口配置を構築
**成果物**: SystemAggregation、EquipmentSelection、AHU/Diffuserレンダラー・ツール・パネル

### タスク一覧

- [x] [TASK-0019: SystemAggregationSystem — 系統集計計算](TASK-0019.md) - 8h (TDD) 🔵
- [x] [TASK-0020: ZoneGroupingTool — ゾーングルーピング](TASK-0020.md) - 8h (TDD) 🔵
- [x] [TASK-0021: EquipmentSelectionSystem — AHU候補選定ロジック](TASK-0021.md) - 8h (TDD) 🔵
- [x] [TASK-0022: AhuRenderer — AHU 3D表示（直方体+ポート円筒）](TASK-0022.md) - 8h (TDD) 🔵
- [x] [TASK-0023: AhuPlaceTool — AHU配置ツール](TASK-0023.md) - 8h (TDD) 🔵
- [x] [TASK-0024: DiffuserRenderer — 制気口3D表示](TASK-0024.md) - 8h (TDD) 🔵
- [x] [TASK-0025: DiffuserPlaceTool — 制気口配置 + 風量均等配分](TASK-0025.md) - 8h (TDD) 🔵
- [x] [TASK-0026: SystemPanel + AhuPanel + DiffuserPanel](TASK-0026.md) - 8h (TDD) 🔵
- [x] [TASK-0027: SystemTreePanel + EquipmentCatalogPanel](TASK-0027.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0002, TASK-0015 → TASK-0019
TASK-0019 → TASK-0020, TASK-0021
TASK-0005, TASK-0008 → TASK-0022, TASK-0024
TASK-0022, TASK-0021 → TASK-0023
TASK-0024 → TASK-0025
TASK-0022, TASK-0024 → TASK-0026
TASK-0020, TASK-0021 → TASK-0027
```

---

## Phase 4: ダクト + 配管ルーティング (MVP-3)

**目標**: ダクト/配管の3D表示→手動ルーティング→風量配分→寸法選定→圧損計算を構築
**成果物**: Duct/Pipeレンダラー・ツール、Airflow/Sizing/PressureLossシステム

### タスク一覧

- [x] [TASK-0028: DuctSegmentRenderer — ダクト3D表示](TASK-0028.md) - 8h (TDD) 🔵
- [x] [TASK-0029: DuctFittingRenderer — 継手3D表示](TASK-0029.md) - 8h (TDD) 🔵
- [x] [TASK-0030: DuctRouteTool — ダクト手動ルーティング + ポートスナップ](TASK-0030.md) - 8h (TDD) 🔵
- [ ] [TASK-0031: AirflowDistributionSystem — 風量自動配分](TASK-0031.md) - 8h (TDD) 🔵
- [ ] [TASK-0032: DuctSizingSystem — ダクト寸法選定（等速法）](TASK-0032.md) - 8h (TDD) 🔵
- [ ] [TASK-0033: DuctVisualSystem — ダクト太さ・色・ラベル更新](TASK-0033.md) - 8h (TDD) 🔵
- [ ] [TASK-0034: PressureLossSystem — ダクト圧損計算](TASK-0034.md) - 8h (TDD) 🔵
- [x] [TASK-0035: PipeSegmentRenderer — 配管3D表示](TASK-0035.md) - 8h (TDD) 🔵
- [ ] [TASK-0036: PipeRouteTool + PipeSizingSystem — 配管ルーティング + 口径選定](TASK-0036.md) - 8h (TDD) 🔵
- [ ] [TASK-0037: DuctPanel + PipePanel + PipeVisualSystem](TASK-0037.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0005, TASK-0008 → TASK-0028, TASK-0029, TASK-0035
TASK-0028, TASK-0029 → TASK-0030
TASK-0009, TASK-0030 → TASK-0031
TASK-0031, TASK-0006 → TASK-0032
TASK-0028, TASK-0032 → TASK-0033
TASK-0032 → TASK-0034
TASK-0035, TASK-0006 → TASK-0036
TASK-0033, TASK-0036 → TASK-0037
```

---

## Phase 5: 警告 + UI統合 + デモ (MVP-4)

**目標**: 警告バリデーション、再計算カスケード統合、プリセット、デモシナリオ通し検証
**成果物**: ValidationSystem、WarningBadge/Panel、プリセットデータ、ワンパスデモ

### タスク一覧

- [ ] [TASK-0038: ValidationSystem — 警告バリデーションエンジン](TASK-0038.md) - 8h (TDD) 🔵
- [ ] [TASK-0039: WarningBadgeSystem — ノード上警告バッジ表示](TASK-0039.md) - 8h (TDD) 🔵
- [ ] [TASK-0040: WarningListPanel — 警告一覧 + ノード選択ズーム](TASK-0040.md) - 8h (TDD) 🔵
- [ ] [TASK-0041: 再計算カスケード統合 — 全計算パイプライン結合テスト](TASK-0041.md) - 8h (TDD) 🔵
- [ ] [TASK-0042: プリセットデータ作成（5段階）+ 読込UI](TASK-0042.md) - 8h (DIRECT) 🔵
- [ ] [TASK-0043: 保存/復元検証 — HVACノードのIndexedDB永続化](TASK-0043.md) - 8h (TDD) 🔵
- [ ] [TASK-0044: 画面表示仕様 — ゾーンカラー、ダクトラベル、配管色分け統合](TASK-0044.md) - 8h (TDD) 🔵
- [ ] [TASK-0045: 操作フィードバック統合 — 風量一斉更新、トースト通知等](TASK-0045.md) - 8h (TDD) 🔵
- [ ] [TASK-0046: デモシナリオ検証 — ワンパス通し確認 + 最終調整](TASK-0046.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0034, TASK-0036 → TASK-0038
TASK-0038 → TASK-0039, TASK-0040, TASK-0041
TASK-0041 → TASK-0042, TASK-0043
TASK-0033, TASK-0037 → TASK-0044
TASK-0044 → TASK-0045
TASK-0045, TASK-0042 → TASK-0046
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 46件
- 🔵 **青信号**: 43件 (93%)
- 🟡 **黄信号**: 3件 (7%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 8 | 2 | 0 | 10 |
| Phase 2 | 8 | 0 | 0 | 8 |
| Phase 3 | 9 | 0 | 0 | 9 |
| Phase 4 | 10 | 0 | 0 | 10 |
| Phase 5 | 9 | 0 | 0 | 9 |

**品質評価**: 高品質 — 93%の設計が要件定義書・設計文書・ユーザヒアリングに裏付けられている

## クリティカルパス

```
TASK-0001 → TASK-0002 → TASK-0005 → TASK-0008 → TASK-0012 → TASK-0013 → TASK-0018
                                                                    ↓
TASK-0006 → TASK-0015 → TASK-0019 → TASK-0021 → TASK-0023
                                                    ↓
TASK-0005 → TASK-0028 → TASK-0030 → TASK-0031 → TASK-0032 → TASK-0034 → TASK-0038 → TASK-0041 → TASK-0046
```

**クリティカルパス工数**: 約120時間（15日）
**並行作業可能工数**: 約244時間

## 次のステップ

タスクを実装するには:
- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0001`
