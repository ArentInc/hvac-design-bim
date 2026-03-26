# hvac-bim-mvp アーキテクチャ設計

**作成日**: 2026-03-26
**関連要件定義**: [requirements.md](../../spec/hvac-bim-mvp/requirements.md)
**ヒアリング記録**: [design-interview.md](design-interview.md)

**【信頼性レベル凡例】**:
- 🔵 **青信号**: EARS要件定義書・設計文書・ユーザヒアリングを参考にした確実な設計
- 🟡 **黄信号**: EARS要件定義書・設計文書・ユーザヒアリングから妥当な推測による設計
- 🔴 **赤信号**: EARS要件定義書・設計文書・ユーザヒアリングにない推測による設計

---

## システム概要 🔵

**信頼性**: 🔵 *要件定義書概要・PRDセクション9より*

Pascal Editor をフォークした空調設備基本設計BIMツール「Kühl」。既存の建築エディタに HVAC 設計機能を追加し、1フロア・1系統（AHU系）・1ワンパスで条件入力→負荷算定→機器仮選定→ダクト/配管一次ルーティング→計算結果確認を一筆書きで完了する。

全てクライアントサイドで動作し、永続化は IndexedDB（idb-keyval）。Supabase は MVP 後に導入予定。

## アーキテクチャパターン 🔵

**信頼性**: 🔵 *CLAUDE.md・既存実装分析・ヒアリングより*

- **パターン**: 既存の3ストア＋フラットノードモデル＋Dirty Nodeシステムパターンを踏襲し、HVAC 機能を拡張
- **選択理由**: 既存の14ノードタイプが安定動作しており、同一パターンで HVAC 7ノードを追加することでコードの一貫性と保守性を保つ

### 設計原則

1. **既存パターン踏襲**: ノードスキーマ、ストア、システム、レンダラー、ツール全てで既存の定型パターンに従う 🔵
2. **Viewer隔離維持**: @pascal-app/viewer は @pascal-app/editor や apps/editor からインポートしない 🔵
3. **計算とレンダリングの分離**: HVAC 計算は packages/core のシステム、3D 表示は packages/viewer のレンダラー＋システム 🔵
4. **Phase型拡張 + 2モード制**: 既存 Phase 型に HVAC フェーズを追加し、editorMode で有効フェーズを切替 🔵

## コンポーネント構成

### モノレポパッケージ構成 🔵

**信頼性**: 🔵 *CLAUDE.md・既存実装より*

```
apps/editor/         → Next.js 16 app（全パッケージを統合）
packages/core/       → @pascal-app/core: スキーマ、状態管理、HVAC計算システム、イベント
packages/viewer/     → @pascal-app/viewer: 3Dキャンバス + HVACレンダラー + ビューアシステム
packages/editor/     → @pascal-app/editor: HVACツール、サイドバー、プロパティパネル
packages/ui/         → @pascal-app/ui: 共有UIプリミティブ
```

**依存方向**: `apps/editor` → `@pascal-app/editor` → `@pascal-app/viewer` → `@pascal-app/core`

### packages/core 拡張 🔵

**信頼性**: 🔵 *CLAUDE.md・既存実装パターン・REQ-007,008より*

| 追加要素 | 配置場所 | 内容 |
|----------|----------|------|
| HVACノードスキーマ（7種） | `packages/core/src/schema/nodes/` | hvac-zone.ts, system.ts, ahu.ts, diffuser.ts, duct-segment.ts, duct-fitting.ts, pipe-segment.ts |
| AnyNode拡張 | `packages/core/src/schema/types.ts` | discriminatedUnion に7ノード追加 |
| HVAC計算システム | `packages/core/src/systems/hvac/` | load-calc, airflow-distribution, duct-sizing, pressure-loss, pipe-sizing, validation |
| サンプルデータ | `packages/core/src/data/` | catalog-ahu.json, catalog-diffuser.json, standard-duct-sizes.json, standard-pipe-sizes.json, load-unit-table.json, sample-architecture.json |
| プリセットデータ | `packages/core/src/data/presets/` | preset-00〜preset-04 |
| グラフユーティリティ | `packages/core/src/utils/hvac-graph.ts` | ポートIDベースの接続グラフ構築・トラバーサル |
| イベント型追加 | `packages/core/src/events/bus.ts` | hvac_zone:click, ahu:click, duct_segment:click 等 |

### packages/viewer 拡張 🔵

**信頼性**: 🔵 *CLAUDE.md Viewer隔離ルール・既存レンダラーパターンより*

| 追加要素 | 配置場所 | 内容 |
|----------|----------|------|
| HVACレンダラー（7種） | `packages/viewer/src/components/renderers/hvac/` | hvac-zone-renderer, ahu-renderer, diffuser-renderer, duct-segment-renderer, duct-fitting-renderer, pipe-segment-renderer, system-renderer |
| HVACビューアシステム | `packages/viewer/src/systems/hvac/` | ダクト/配管の太さ・色・ラベル更新、警告バッジ表示 |
| sceneRegistry.byType 拡張 | `packages/core/src/hooks/scene-registry/` | hvac_zone, system, ahu, diffuser, duct_segment, duct_fitting, pipe_segment 追加 |
| NodeRenderer 分岐追加 | `packages/viewer/src/components/renderers/node-renderer.tsx` | 7ノードタイプの条件分岐追加 |

### packages/editor 拡張 🔵

**信頼性**: 🔵 *CLAUDE.md ツールルール・既存ツールパターン・ヒアリングQ5より*

| 追加要素 | 配置場所 | 内容 |
|----------|----------|------|
| HVACツール | `packages/editor/src/components/tools/hvac/` | zone-draw, perimeter-edit, zone-grouping, ahu-place, diffuser-place, duct-route, pipe-route, load-calc, pressure-loss, validate |
| HVAC右パネル | `packages/editor/src/components/ui/panels/hvac/` | hvac-zone-panel, system-panel, ahu-panel, diffuser-panel, duct-panel, pipe-panel, calc-result-panel |
| HVAC左パネル | `packages/editor/src/components/ui/sidebar/panels/` | system-tree-panel, zone-list-panel, equipment-catalog-panel, warning-list-panel |
| モード切替UI | `packages/editor/src/components/ui/` | mode-switcher（建築/HVAC切替） |
| useEditor拡張 | `packages/editor/src/store/use-editor.tsx` | editorMode追加、Phase型拡張、HVACツール型追加 |

## 3ストアパターン拡張 🔵

**信頼性**: 🔵 *既存実装分析・ヒアリングより*

### useScene（packages/core）— 変更なし

HVACノードは既存の `nodes: Record<AnyNodeId, AnyNode>` にフラットに格納される。createNode/updateNode/deleteNode、dirtyNodes パターン、undo/redo（Zundo 50ステップ）は変更不要。

### useViewer（packages/viewer）— 軽微な拡張

| 変更 | 内容 | 信頼性 |
|------|------|--------|
| sceneRegistry.byType | HVAC 7タイプ追加 | 🔵 |
| SelectionPath | 変更なし（selectedIds でHVACノードも選択可能） | 🔵 |

### useEditor（packages/editor）— 主要拡張 🔵

**信頼性**: 🔵 *ヒアリング「Phase型拡張」選択より*

```typescript
// 新規追加
type EditorMode = 'architecture' | 'hvac'

// Phase型拡張
type Phase = 'site' | 'structure' | 'furnish' | 'zone' | 'equip' | 'route' | 'calc'

// Phase有効範囲
const phasesByEditorMode = {
  architecture: ['site', 'structure', 'furnish'],
  hvac: ['zone', 'equip', 'route', 'calc'],
}

// HVACツール追加
type HvacTool =
  | 'zone_draw' | 'perimeter_edit'
  | 'zone_grouping' | 'ahu_place' | 'diffuser_place'
  | 'duct_route' | 'pipe_route'
  | 'load_calc' | 'pressure_loss' | 'validate'

type Tool = SiteTool | StructureTool | FurnishTool | HvacTool
```

**モード切替ロジック**:
- `setEditorMode('hvac')` → phase を 'zone' に切替、建築要素を参照表示化
- `setEditorMode('architecture')` → phase を 'site' に切替、HVACツール無効化
- 既存の setPhase/setMode ロジックは editorMode によるフィルタリングを追加

## ノード階層構造 🔵

**信頼性**: 🔵 *ヒアリング「Levelのchildren拡張」選択・既存階層パターンより*

```
Site
└─ Building
   └─ Level
      ├─ Wall, Slab, Ceiling, Roof, Zone, Scan, Guide  (既存)
      ├─ HvacZone                                       (新規)
      ├─ SystemNode                                     (新規)
      │  └─ (parentId参照のみ、childrenは持たない)
      ├─ AhuNode                                        (新規)
      ├─ DiffuserNode                                   (新規)
      ├─ DuctSegmentNode                                (新規)
      ├─ DuctFittingNode                                (新規)
      └─ PipeSegmentNode                                (新規)
```

**LevelNode.children 拡張**:
```typescript
children: z.array(
  z.union([
    WallNode.shape.id,
    ZoneNode.shape.id,
    SlabNode.shape.id,
    // ... 既存
    HvacZoneNode.shape.id,    // 追加
    SystemNode.shape.id,       // 追加
    AhuNode.shape.id,          // 追加
    DiffuserNode.shape.id,     // 追加
    DuctSegmentNode.shape.id,  // 追加
    DuctFittingNode.shape.id,  // 追加
    PipeSegmentNode.shape.id,  // 追加
  ])
).default([])
```

**論理的関連**（parentId ではなく ID参照で管理）:
- HvacZoneNode.systemId → SystemNode.id（N:1）
- SystemNode.servedZoneIds → HvacZoneNode.id[]
- SystemNode.ahuId → AhuNode.id
- DiffuserNode.hostDuctId → DuctSegmentNode.id
- DiffuserNode.systemId → SystemNode.id
- DuctSegmentNode.startPortId / endPortId → ポートID（AHU/Diffuser/Fitting のポート）
- PipeSegmentNode.startPortId / endPortId → ポートID

## 接続グラフモデル 🔵

**信頼性**: 🔵 *ヒアリング「ポートIDベース」選択・PRDセクション15.4より*

### ポート定義

各機器ノード（AHU, Diffuser, DuctFitting）はポート配列を持つ:

```typescript
interface Port {
  id: string              // ポートID（ノードIDから派生: 'ahu_xxx_sa' 等）
  label: string           // 表示名（'SA', 'RA', 'OA', 'CWS', 'CWR' 等）
  medium: PortMedium      // 'supply_air' | 'return_air' | 'outside_air' | 'chilled_water_supply' | 'chilled_water_return'
  position: [number, number, number]  // ノードローカル座標
  direction: [number, number, number] // 接続方向ベクトル
  connectedSegmentId: string | null   // 接続中のDuctSegment/PipeSegmentのID
}
```

### グラフ構築アルゴリズム 🟡

**信頼性**: 🟡 *PRDセクション15.4の要件から妥当な推測*

```
1. 系統の全ノードを収集（SystemNode.servedZoneIds → 関連ノード）
2. AHU のポートを起点ノードとする
3. 各ポートの connectedSegmentId をたどって DuctSegment を取得
4. DuctSegment の反対側のポートID から次のノード（Fitting or Diffuser）を特定
5. BFS/DFS でツリーを構築
6. 葉ノード（Diffuser）の airflowRate を取得
7. 葉→根の逆向きトラバーサルで各区間の風量を合算
```

### サイクル検出 🟡

**信頼性**: 🟡 *EDGE-004から妥当な推測*

グラフ構築時に訪問済みセットで循環参照を検出。検出時は風量自動配分を中断し警告を発行。

## HVAC 計算アーキテクチャ 🔵

**信頼性**: 🔵 *ヒアリング「dirty検出+非同期」選択・PRDセクション15-16より*

### 計算パイプライン

```
┌─────────────────────────────────────────────────────────┐
│                    Dirty Node 検出                        │
│  useScene.dirtyNodes → HVAC System が検出                │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              非同期計算キュー                              │
│  requestIdleCallback / setTimeout(0) で UI非ブロッキング   │
└──────────────┬──────────────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼          ▼
 負荷概算   系統集計   風量配分   寸法選定   圧損計算
 (Zone)   (System)  (Duct)    (Duct)    (Duct/Pipe)
    │          │          │          │          │
    └──────────┴──────────┴──────────┴──────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│            結果格納 + Dirty クリア                         │
│  updateNode(id, { calcResult: {...} })                   │
│  clearDirty(id)                                          │
└─────────────────────────────────────────────────────────┘
```

### 計算システム一覧 🔵

**信頼性**: 🔵 *PRDセクション15・REQ-301〜REQ-1104より*

| システム | 配置 | トリガー | 入力 | 出力 |
|----------|------|----------|------|------|
| LoadCalcSystem | core/systems/hvac/ | HvacZone dirty | zone条件 + 原単位テーブル | coolingLoad, heatingLoad, requiredAirflow, perimeterLoadBreakdown |
| SystemAggregationSystem | core/systems/hvac/ | SystemNode dirty or ゾーン負荷変更 | servedZoneIds の各loadResult | totalCoolingLoad, totalHeatingLoad, totalAirflow |
| EquipmentSelectionSystem | core/systems/hvac/ | SystemNode aggregatedLoad 変更 | aggregatedLoad + カタログ | AHU候補リスト（UIで表示用） |
| AirflowDistributionSystem | core/systems/hvac/ | DuctSegment/Fitting dirty | 接続グラフ + 制気口風量 | 各区間 airflowRate |
| DuctSizingSystem | core/systems/hvac/ | DuctSegment airflowRate 変更 | airflowRate + 標準サイズ表 | width, height（矩形） or diameter（丸） |
| PressureLossSystem | core/systems/hvac/ | DuctSegment 寸法確定 | 寸法 + 区間長 + 継手 + 材質 | pressureLoss（Pa）, requiredFanPressure |
| PipeSizingSystem | core/systems/hvac/ | PipeSegment dirty | AHUコイル能力 + 標準口径表 | nominalSize, pressureLoss |
| ValidationSystem | core/systems/hvac/ | 任意ノード dirty | 全HVACノード | warnings[] |

### 再計算カスケード 🔵

**信頼性**: 🔵 *PRDセクション16.2・REQ-1801〜1804より*

```
ゾーン条件変更 → 負荷再計算 → 系統集計 → 機器候補更新 → 風量再配分 → 寸法再選定 → 圧損再計算
グルーピング変更 → 系統集計 → 機器候補更新
ルート変更 → 風量再配分 → 寸法再選定 → 圧損再計算 → 警告更新
機器変更 → 接続風量更新 → ポート整合 → ダクト/配管再計算
```

カスケードは各システムが下流ノードを dirty マークすることで連鎖的に実行される。

## イベントバス拡張 🔵

**信頼性**: 🔵 *既存イベントパターン・REQ-007より*

既存の型付き mitt パターンに HVAC イベントを追加:

```typescript
type EditorEvents = GridEvents &
  NodeEvents<'wall', WallEvent> &
  // ... 既存
  NodeEvents<'hvac_zone', HvacZoneEvent> &
  NodeEvents<'system', SystemEvent> &
  NodeEvents<'ahu', AhuEvent> &
  NodeEvents<'diffuser', DiffuserEvent> &
  NodeEvents<'duct_segment', DuctSegmentEvent> &
  NodeEvents<'duct_fitting', DuctFittingEvent> &
  NodeEvents<'pipe_segment', PipeSegmentEvent>
```

## ディレクトリ構造（HVAC追加分） 🔵

**信頼性**: 🔵 *既存プロジェクト構造・REQ-007〜010より*

```
packages/core/src/
├── schema/nodes/
│   ├── hvac-zone.ts          # HvacZoneNode スキーマ
│   ├── system.ts             # SystemNode スキーマ
│   ├── ahu.ts                # AhuNode スキーマ
│   ├── diffuser.ts           # DiffuserNode スキーマ
│   ├── duct-segment.ts       # DuctSegmentNode スキーマ
│   ├── duct-fitting.ts       # DuctFittingNode スキーマ
│   └── pipe-segment.ts       # PipeSegmentNode スキーマ
├── systems/hvac/
│   ├── load-calc-system.tsx           # 負荷計算
│   ├── system-aggregation-system.tsx  # 系統集計
│   ├── equipment-selection-system.tsx # 機器選定
│   ├── airflow-distribution-system.tsx # 風量配分
│   ├── duct-sizing-system.tsx         # ダクト寸法選定
│   ├── pressure-loss-system.tsx       # 圧損計算
│   ├── pipe-sizing-system.tsx         # 配管寸法選定
│   └── validation-system.tsx          # 警告バリデーション
├── utils/
│   └── hvac-graph.ts          # 接続グラフ構築・トラバーサル
└── data/
    ├── catalog-ahu.json
    ├── catalog-diffuser.json
    ├── standard-duct-sizes.json
    ├── standard-pipe-sizes.json
    ├── load-unit-table.json
    ├── sample-architecture.json
    └── presets/
        ├── preset-00-empty.json
        ├── preset-01-zones.json
        ├── preset-02-equip.json
        ├── preset-03-route.json
        └── preset-04-complete.json

packages/viewer/src/
├── components/renderers/hvac/
│   ├── hvac-zone-renderer.tsx
│   ├── system-renderer.tsx
│   ├── ahu-renderer.tsx
│   ├── diffuser-renderer.tsx
│   ├── duct-segment-renderer.tsx
│   ├── duct-fitting-renderer.tsx
│   └── pipe-segment-renderer.tsx
└── systems/hvac/
    ├── duct-visual-system.tsx    # ダクト太さ・色・ラベル
    ├── pipe-visual-system.tsx    # 配管色・太さ
    └── warning-badge-system.tsx  # 警告バッジ表示

packages/editor/src/
├── components/tools/hvac/
│   ├── zone-draw-tool.tsx
│   ├── perimeter-edit-tool.tsx
│   ├── zone-grouping-tool.tsx
│   ├── ahu-place-tool.tsx
│   ├── diffuser-place-tool.tsx
│   ├── duct-route-tool.tsx
│   ├── pipe-route-tool.tsx
│   ├── load-calc-tool.tsx
│   ├── pressure-loss-tool.tsx
│   └── validate-tool.tsx
├── components/ui/panels/hvac/
│   ├── hvac-zone-panel.tsx
│   ├── system-panel.tsx
│   ├── ahu-panel.tsx
│   ├── diffuser-panel.tsx
│   ├── duct-panel.tsx
│   ├── pipe-panel.tsx
│   └── calc-result-panel.tsx
├── components/ui/sidebar/panels/
│   ├── system-tree-panel.tsx
│   ├── zone-list-panel.tsx
│   ├── equipment-catalog-panel.tsx
│   └── warning-list-panel.tsx
└── components/ui/
    └── mode-switcher.tsx
```

## 非機能要件の実現方法

### パフォーマンス 🔵

**信頼性**: 🔵 *NFR-001,002・ヒアリング「dirty検出+非同期」より*

- **30fps維持**: HVAC計算を useFrame 外で非同期実行し、UIスレッドをブロックしない
- **再計算5秒以内**: 計算パイプラインを段階的に実行、各段階の中間結果をキャッシュ
- **300ノード規模**: フラットノードモデルの O(1) ルックアップ、sceneRegistry による型別インデックス

### 信頼性 🔵

**信頼性**: 🔵 *NFR-101,102より*

- **Zodスキーマ検証**: 保存前に全HVACノードの parse を実行
- **計算失敗ハンドリング**: try-catch で個別ノードのエラーを捕捉、calcResult に error 状態を格納、エディタクラッシュを防止

### 操作性 🔵

**信頼性**: 🔵 *NFR-201〜203・PRDセクション13より*

- **フェーズ切替明快**: 上部バーに建築/HVAC モード切替 + 4フェーズタブ
- **計算結果常時表示**: 右パネルに選択ノードの諸元・計算結果を表示
- **3クリック操作開始**: モード切替(1) → フェーズ選択(2) → ツール選択(3)

### 計算妥当性 🔵

**信頼性**: 🔵 *NFR-301〜303より*

- **負荷計算±20%**: 原単位テーブル＋方位別日射補正テーブルで手計算と整合
- **圧損計算±15%**: ダルシー・ワイスバッハ式ベースの簡易計算
- **機器選定一致**: 同一カタログ・同一余裕率でのフィルタリング

## 技術的制約

### パフォーマンス制約 🔵

**信頼性**: 🔵 *CLAUDE.md・NFR要件より*

- 1フロア・300ノード上限での30fps維持が必須
- HVAC計算は非同期だが、結果反映までの体感レイテンシは1秒以内を目標
- Three.js レイヤ構成（SCENE=0, EDITOR=1, ZONE=2）は変更不可

### アーキテクチャ制約 🔵

**信頼性**: 🔵 *CLAUDE.md・Viewer隔離ルールより*

- @pascal-app/viewer は @pascal-app/editor からインポート不可
- HVAC計算ロジックは packages/core に配置（Three.js インポート不可）
- ツールは Three.js API を直接呼び出し不可

### 互換性制約 🔵

**信頼性**: 🔵 *CLAUDE.md・tech-stack.mdより*

- 既存14ノードタイプとの共存が必須（AnyNode union の後方互換）
- IndexedDB の既存データとの互換性維持（新ノードタイプ追加は非破壊）
- Biome 2.4 コードスタイル準拠（セミコロンなし、シングルクォート、2スペース）

## 関連文書

- **データフロー**: [dataflow.md](dataflow.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **ヒアリング記録**: [design-interview.md](design-interview.md)
- **要件定義**: [requirements.md](../../spec/hvac-bim-mvp/requirements.md)
- **ユーザストーリー**: [user-stories.md](../../spec/hvac-bim-mvp/user-stories.md)
- **受け入れ基準**: [acceptance-criteria.md](../../spec/hvac-bim-mvp/acceptance-criteria.md)

## 信頼性レベルサマリー

- 🔵 青信号: 28件 (93%)
- 🟡 黄信号: 2件 (7%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質 — ほぼ全ての設計がEARS要件定義書・既存実装分析・ユーザヒアリングに裏付けられている
