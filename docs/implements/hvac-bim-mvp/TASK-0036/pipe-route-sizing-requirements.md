# TASK-0036: PipeRouteTool + PipeSizingSystem 要件定義書

**タスクID**: TASK-0036
**機能名**: 配管ルーティング + 口径選定 (pipe-route-sizing)
**要件名**: hvac-bim-mvp
**作成日**: 2026-03-26
**信頼性レベル**: 総合 🔵 (7/8項目が青信号)

---

## 1. 機能の概要

### 1.1 何をする機能か 🔵

**信頼性**: 🔵 *REQ-1101, REQ-1103, REQ-1104, REQ-1105, PRDセクション15.7より*

AHU の冷温水ポートから配管（PipeSegmentNode）を手動ルーティングするツール（PipeRouteTool）と、AHU のコイル能力（coolingCapacity）から冷水流量を算出し、流速制約の範囲内で標準口径にスナップして自動的に口径を決定するシステム（PipeSizingSystem）を実装する。

具体的な機能:
- AHU の冷温水ポート（CHW_S / CHW_R）から配管を描画するルーティングツール
- 冷温水2管（CWS + CWR）のペア描画
- AHU 冷房能力からの冷水流量自動算出
- 流速1.0~2.0 m/s 範囲制約による口径選定
- 標準口径表（15A~200A）へのスナップ
- 等価長さ法による配管圧損概算

### 1.2 どのような問題を解決するか 🔵

**信頼性**: 🔵 *ストーリー5.1「配管ルーティング」・PRDセクション11.11より*

HVAC 基本設計において、AHU と冷温水配管の接続ルーティングと口径選定は手計算で行うと煩雑である。本機能により、ルーティング操作に連動して口径が自動算出されるため、設計者の手計算負荷を軽減し、一筆書きワンパスデモの配管フェーズを完成させる。

### 1.3 想定されるユーザー 🔵

**信頼性**: 🔵 *ユーザストーリーより*

空調設備の基本設計を行う設備設計者。1フロア・1系統（AHU系）の冷温水配管を BIM ツール上で設計する。

### 1.4 システム内での位置づけ 🔵

**信頼性**: 🔵 *architecture.md コンポーネント構成・dataflow.md 機能4より*

- **PipeRouteTool**: `packages/editor/src/components/tools/hvac/pipe-route-tool.tsx` に配置。HVAC モードの route フェーズで有効なツール。ユーザー入力を受け取り useScene にPipeSegmentNode を作成する。
- **PipeSizingSystem**: `packages/core/src/systems/hvac/pipe-sizing-system.tsx` に配置。Core システムとして dirtyNodes を監視し、AHU コイル能力から口径を自動算出して PipeSegmentNode を更新する。
- **データフロー**: ユーザー操作 -> PipeRouteTool -> createNode(PipeSegment) -> markDirty -> PipeSizingSystem -> updateNode(nominalSize, calcResult) -> Viewer（口径比例太さ + 色分け表示）

**参照したEARS要件**: REQ-1101, REQ-1102, REQ-1103, REQ-1104, REQ-1105
**参照した設計文書**: architecture.md「packages/core 拡張」「packages/editor 拡張」セクション、dataflow.md「機能4: 圧損計算と配管」

---

## 2. 入力・出力の仕様

### 2.1 PipeRouteTool の入出力 🔵

**信頼性**: 🔵 *REQ-1101, REQ-1102, REQ-1105, interfaces.ts PipeSegmentNode/Port定義より*

#### 入力

| パラメータ | 型 | 説明 | 制約 |
|-----------|-----|------|------|
| AHU ポートクリック | ポインタイベント | AHU の CHW_S / CHW_R ポートを起点としてルーティング開始 | ポートの medium が `chilled_water` であること |
| 折点クリック | ポインタイベント（複数回） | 配管の中間折点を指定 | フロア平面上 |
| 終端確定 | ダブルクリック / Enter | ルーティング完了 | - |

#### 出力（作成されるノード）

| フィールド | 型 | 説明 | 出典 |
|-----------|-----|------|------|
| id | `pipe_seg_${string}` | 自動生成 ID | 既存パターン |
| type | `'pipe_segment'` | ノードタイプ | REQ-1102 |
| start | `[number, number, number]` | 始点座標 | REQ-1102 |
| end | `[number, number, number]` | 終点座標 | REQ-1102 |
| medium | `PipeMedium` | `'chilled_water'`（現行スキーマ） | REQ-1102, REQ-1105 |
| nominalSize | `number \| null` | 初期値 null（PipeSizingSystem が後で設定） | REQ-1103 |
| outerDiameter | `number \| null` | 初期値 null | 表示用 |
| startPortId | `string` | 始点ポートID | REQ-1102 |
| endPortId | `string` | 終点ポートID | REQ-1102 |
| systemId | `string` | AHU が属する系統ID | REQ-1102 |
| calcResult | `PipeCalcResult \| null` | 初期値 null | REQ-1104 |

### 2.2 PipeSizingSystem の入出力 🔵

**信頼性**: 🔵 *REQ-1103, REQ-1104, PRDセクション15.7, interfaces.ts PipeCalcResult定義より*

#### 入力

| パラメータ | 型 | 説明 | 制約 |
|-----------|-----|------|------|
| dirtyNodes | `Set<string>` | dirty フラグが立った PipeSegmentNode の ID | 自動検出 |
| AhuNode.coolingCapacity | `number` | AHU 冷房能力 (kW) | >= 0 |
| PipeSegmentNode.start/end | `[number, number, number]` | 区間の始点・終点（直管長算出用） | - |
| standard-pipe-sizes.json | `Array<{nominalSize, outerDiameter, innerDiameter}>` | 標準口径表 | 15A ~ 200A |

#### 計算パラメータ（定数）

| パラメータ | 値 | 説明 | 信頼性 |
|-----------|-----|------|--------|
| cp（水の比熱） | 4.186 kJ/(kg*K) | 水の比熱容量 | 🔵 物理定数 |
| rho（水の密度） | 1000 kg/m3 | 水の密度 | 🔵 物理定数 |
| deltaT（冷水温度差） | 5 K | 冷水往還温度差（デフォルト） | 🔵 PRDセクション15.7 |
| targetVelocity | 1.5 m/s | 口径算出時の目標流速 | 🔵 REQ-1103 |
| minVelocity | 1.0 m/s | 流速下限 | 🔵 REQ-1103 |
| maxVelocity | 2.0 m/s | 流速上限 | 🔵 REQ-1103 |
| lambda（摩擦係数） | 0.02 | 鋼管概算値 | 🔵 REQ-1104 |
| fittingFactor | 0.5 | 継手等価長さ係数（直管長の50%） | 🔵 REQ-1104 |

#### 出力（更新されるフィールド）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| nominalSize | `number` | 選定された標準口径 (A) |
| outerDiameter | `number` | 対応する外径 (mm) |
| calcResult.velocity | `number` | 実流速 (m/s) |
| calcResult.pressureDrop | `number` | 区間圧損 (kPa) |

### 2.3 PipeMedium スキーマの差異について 🟡

**信頼性**: 🟡 *現行スキーマ vs interfaces.ts 仕様の差異を検出*

現行実装の `hvac-shared.ts` では `PipeMedium = 'chilled_water' | 'hot_water' | 'condensate'` だが、TASK-0036 の仕様書および `interfaces.ts` では `'chilled_water_supply' | 'chilled_water_return'` と定義されている。この差異は実装時に解決が必要。

**選択肢**:
- A) PipeMedium を `'chilled_water_supply' | 'chilled_water_return'` に変更（interfaces.ts 準拠）
- B) 現行 `'chilled_water'` のまま、CWS/CWR の区別は別フィールドで管理

**推奨**: 選択肢 A（interfaces.ts の設計意図に合致）

**参照したEARS要件**: REQ-1101, REQ-1102, REQ-1103, REQ-1104, REQ-1105
**参照した設計文書**: interfaces.ts PipeSegmentNode, PipeCalcResult, Port

---

## 3. 制約条件

### 3.1 アーキテクチャ制約 🔵

**信頼性**: 🔵 *CLAUDE.md, architecture.md 設計原則より*

- **Viewer 隔離ルール**: PipeRouteTool は `packages/editor` に配置し、`@pascal-app/viewer` からインポートしてはならない（REQ-009, REQ-010）
- **Core システムルール**: PipeSizingSystem は `packages/core/src/systems/hvac/` に配置し、Three.js インポートを含んではならない（REQ-008）
- **ツールルール**: PipeRouteTool は Three.js API を直接呼び出さない。プレビュー線はローカル state で管理（CLAUDE.md ツールルール）
- **ノード作成**: 必ず `PipeSegmentNode.parse({...})` 後に `createNode(node, parentId)` で作成（CLAUDE.md ノード作成ルール）

### 3.2 計算制約 🔵

**信頼性**: 🔵 *REQ-1103, REQ-1104より*

- **流速範囲**: 1.0 ~ 2.0 m/s。範囲外の場合は口径サイズを上下して再検証
- **標準口径表**: `standard-pipe-sizes.json` に定義された 15A ~ 200A の12サイズにスナップ
- **圧損計算**: ダルシー・ワイスバッハ式、lambda=0.02（鋼管概算）、等価長さ法
- **冷水温度差**: デフォルト 5K（将来ユーザー設定可能）

### 3.3 スコープ制約 🔵

**信頼性**: 🔵 *REQ-1105, TASK-0036 注意事項より*

- **MVP では冷水のみ**: 温水配管は UI フローとして未対応（スキーマ上は対応可能）
- **2管のみ**: CWS + CWR の冷温水2管。4管式は対象外
- **平行オフセット**: MVP では固定値（例: 0.1m）。将来ユーザー設定可能化は別タスク
- **単位**: 口径は A（呼び径）で表示。内部計算は m 単位。A -> m 変換は standard-pipe-sizes.json の innerDiameter を使用

### 3.4 パフォーマンス制約 🟡

**信頼性**: 🟡 *明示的な NFR なし、既存パターンから妥当な推測*

- PipeSizingSystem は useFrame 内で dirtyNodes を検出して処理。1フレームあたりの処理は軽量（単純な算術計算のみ）
- 配管ノード数は1系統あたり数十本程度を想定

**参照したEARS要件**: REQ-1103, REQ-1104, REQ-1105, REQ-008, REQ-009, REQ-010
**参照した設計文書**: architecture.md 設計原則、CLAUDE.md ツールルール・Viewer隔離ルール

---

## 4. 想定される使用例

### 4.1 基本的な使用パターン 🔵

**信頼性**: 🔵 *dataflow.md 機能4, ストーリー5.1より*

**シナリオ: AHU 冷水配管のルーティングと口径自動算出**

1. ユーザーが HVAC モード -> route フェーズ -> pipe_route ツールを選択
2. AHU の CHW_S（冷水供給）ポートをクリック -> ルーティング開始
3. フロア平面上で折点をクリック（1回以上）
4. ダブルクリック / Enter で終端確定
5. PipeSegmentNode が createNode で作成され、markDirty される
6. PipeSizingSystem が dirty 検出 -> AHU の coolingCapacity から冷水流量算出
7. 流量から口径算出 -> 標準口径スナップ -> 流速制約検証
8. nominalSize / outerDiameter / calcResult が自動設定される
9. Viewer が口径比例太さ + 色分けで表示更新

### 4.2 データフロー 🔵

**信頼性**: 🔵 *dataflow.md 機能4のシーケンス図より*

```
User -> PipeRouteTool: AHU冷水ポートクリック
PipeRouteTool -> useScene: createNode(PipeSegmentNode.parse({medium: 'chilled_water', ...}), levelId)
useScene -> useScene: markDirty(pipeId)
PipeSizingSystem -> useScene: dirtyNodes 検出
PipeSizingSystem: flowRate = coolingCapacity / (4.186 * deltaT * 1000)
PipeSizingSystem: diameter = sqrt(4 * flowRate / (pi * targetVelocity))
PipeSizingSystem: 標準口径スナップ + 流速範囲検証
PipeSizingSystem: pressureDrop = lambda * (totalLength / d) * (rho * v^2 / 2)
PipeSizingSystem -> useScene: updateNode(pipeId, {nominalSize, outerDiameter, calcResult})
Viewer: 口径比例太さ + 色分け表示
```

### 4.3 冷温水2管描画 🔵

**信頼性**: 🔵 *REQ-1105, TASK-0036 実装詳細2より*

- CHW_S ポートから CWS（冷水供給）配管を描画
- CHW_R ポートから CWR（冷水還水）配管を描画
- 2管は medium フィールドで区別（`'chilled_water_supply'` / `'chilled_water_return'` or 現行 `'chilled_water'`）
- 各配管は個別の PipeSegmentNode として管理

### 4.4 エッジケース: 流量ゼロ 🟡

**信頼性**: 🟡 *EDGE-103、具体的挙動は推測を含む*

- **条件**: AHU の coolingCapacity = 0 kW
- **動作**: flowRate = 0 -> 口径計算をスキップ
- **結果**: `system:warning` イベント発行（「冷房能力が設定されていないため配管口径を算出できません」）
- **表示**: 配管は描画されるが nominalSize = null, calcResult = null のまま

### 4.5 エッジケース: 流速制約を満たせない 🟡

**信頼性**: 🟡 *REQ-1103の範囲制約から推測*

- **条件**: 流量が極端に大きい/小さく、標準口径の最大/最小でも流速範囲に収まらない
- **動作**: 最も流速が範囲に近い口径を採用 + 警告ログ出力
- **結果**: nominalSize は設定されるが、calcResult.status = 'error' with エラーメッセージ

### 4.6 エッジケース: ポート未接続 🔵

**信頼性**: 🔵 *REQ-1101, Port.connectedSegmentId定義より*

- ルーティング完了時に AHU ポートの connectedSegmentId を更新
- 既に接続済みポートへの二重接続は不可（バリデーション）

**参照したEARS要件**: REQ-1101, REQ-1103, REQ-1105, EDGE-103
**参照した設計文書**: dataflow.md 機能4シーケンス図

---

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー
- ストーリー5.1: 配管ルーティング

### 参照した機能要件
- **REQ-1101**: AHU冷温水入出口から配管ルーティング
- **REQ-1102**: PipeSegmentNode のフィールド仕様
- **REQ-1103**: 口径自動算出 + 流速制約 + 標準口径スナップ
- **REQ-1104**: 等価長さ法での圧損概算
- **REQ-1105**: 冷温水2管のみ対応

### 参照した非機能要件
- **REQ-008**: HVAC計算システムの配置制約（Core、Three.js禁止）
- **REQ-009**: HVACレンダラーの配置制約（Viewer隔離）
- **REQ-010**: HVACツールの配置制約（Three.js API直接呼出禁止）

### 参照したEdgeケース
- **EDGE-103**: 配管流量ゼロ時のスキップ + 警告

### 参照した受け入れ基準
- AHU冷水ポートから配管ルーティングが可能
- 冷温水2管（CWS + CWR）が描画される
- 冷水流量がAHU冷房能力から正しく算出される
- 口径が流速範囲制約内で標準口径表にスナップされる
- 等価長さ法で配管圧損が概算される
- 流量ゼロ時にスキップ + 警告が発生する
- 全テストが pass

### 参照した設計文書
- **アーキテクチャ**: architecture.md「packages/core 拡張」「packages/editor 拡張」セクション
- **データフロー**: dataflow.md「機能4: 圧損計算と配管」シーケンス図
- **型定義**: interfaces.ts の PipeSegmentNode, PipeCalcResult, Port, PipeMedium
- **データベース**: N/A（クライアントサイドのみ、IndexedDB 永続化）
- **API仕様**: N/A（サーバーレス）

---

## 6. 実装対象ファイル一覧

| ファイル | パッケージ | 種別 | 説明 |
|---------|-----------|------|------|
| `packages/editor/src/components/tools/hvac/pipe-route-tool.tsx` | editor | 新規作成 | 配管ルーティングツール |
| `packages/core/src/systems/hvac/pipe-sizing-system.tsx` | core | 新規作成 | 口径選定システム |
| `packages/core/src/systems/hvac/__tests__/pipe-sizing-system.test.ts` | core | 新規作成 | 口径選定テスト |
| `packages/editor/src/components/tools/hvac/__tests__/pipe-route-tool.test.ts` | editor | 新規作成 | ルーティングツールテスト |
| `packages/core/src/schema/nodes/hvac-shared.ts` | core | 修正 | PipeMedium の拡張（CWS/CWR 区別） |
| `packages/core/src/data/standard-pipe-sizes.json` | core | 既存参照 | 標準口径表データ |
| `packages/editor/src/components/tools/tool-manager.tsx` | editor | 修正 | pipe_route ツール登録 |

---

## 7. 信頼性レベルサマリー

| # | 項目 | 信頼性 | 根拠 |
|---|------|--------|------|
| 1 | 機能概要 | 🔵 | REQ-1101, REQ-1103~1105, PRDセクション15.7 |
| 2 | PipeRouteTool 入出力 | 🔵 | REQ-1101, REQ-1102, interfaces.ts |
| 3 | PipeSizingSystem 入出力 | 🔵 | REQ-1103, REQ-1104, interfaces.ts |
| 4 | PipeMedium スキーマ差異 | 🟡 | 現行スキーマ vs interfaces.ts の差異を検出 |
| 5 | アーキテクチャ制約 | 🔵 | CLAUDE.md, architecture.md |
| 6 | 計算制約 | 🔵 | REQ-1103, REQ-1104 |
| 7 | 基本使用パターン | 🔵 | dataflow.md 機能4 |
| 8 | エッジケース（流量ゼロ） | 🟡 | EDGE-103、具体的挙動は推測 |
| 9 | エッジケース（流速制約不可） | 🟡 | REQ-1103 の範囲制約から推測 |
| 10 | パフォーマンス制約 | 🟡 | 明示的 NFR なし |

**総合**: 🔵6 / 🟡4 -- 主要機能仕様は青信号、エッジケースと補助仕様に黄信号あり
