# hvac-bim-mvp データフロー図

**作成日**: 2026-03-26
**関連アーキテクチャ**: [architecture.md](architecture.md)
**関連要件定義**: [requirements.md](../../spec/hvac-bim-mvp/requirements.md)

**【信頼性レベル凡例】**:
- 🔵 **青信号**: EARS要件定義書・設計文書・ユーザヒアリングを参考にした確実なフロー
- 🟡 **黄信号**: EARS要件定義書・設計文書・ユーザヒアリングから妥当な推測によるフロー
- 🔴 **赤信号**: EARS要件定義書・設計文書・ユーザヒアリングにない推測によるフロー

---

## システム全体のデータフロー 🔵

**信頼性**: 🔵 *アーキテクチャ設計・既存実装パターンより*

```mermaid
flowchart TD
    User[ユーザー操作]
    Tools[HVAC ツール<br/>packages/editor]
    Scene[useScene ストア<br/>packages/core]
    Dirty[dirtyNodes Set]
    CalcSys[HVAC 計算システム<br/>packages/core/systems/hvac]
    Renderers[HVAC レンダラー<br/>packages/viewer]
    Registry[sceneRegistry]
    ViewerSys[ビューアシステム<br/>packages/viewer/systems/hvac]
    Canvas[3D Canvas]
    Panels[プロパティパネル<br/>packages/editor]
    IDB[(IndexedDB)]

    User -->|入力| Tools
    Tools -->|createNode/updateNode| Scene
    Scene -->|自動markDirty| Dirty
    Dirty -->|検出| CalcSys
    CalcSys -->|updateNode(calcResult)| Scene
    Scene -->|購読| Renderers
    Renderers -->|useRegistry| Registry
    Registry -->|参照| ViewerSys
    ViewerSys -->|色・太さ・ラベル更新| Canvas
    Renderers -->|描画| Canvas
    Scene -->|購読| Panels
    Scene -->|永続化| IDB
    Canvas -->|ポインタイベント| User
```

## ワンパス全体フロー 🔵

**信頼性**: 🔵 *ストーリー6.3・PRDセクション21.2より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant E as Editor (Tools)
    participant S as useScene
    participant C as HVAC Systems
    participant V as Viewer

    Note over U,V: Phase 1: ゾーニング (zone)
    U->>E: ゾーン境界描画
    E->>S: createNode(HvacZone)
    S->>S: markDirty(hvacZoneId)
    U->>E: 用途・外皮条件入力
    E->>S: updateNode(hvacZoneId, {usage, perimeterSegments})
    S->>S: markDirty(hvacZoneId)
    C->>S: updateNode(hvacZoneId, {calcResult: loadResult})

    Note over U,V: Phase 2: 系統構成 (equip)
    U->>E: ゾーングルーピング
    E->>S: createNode(SystemNode)
    E->>S: updateNode(各zone, {systemId})
    S->>S: markDirty(systemId)
    C->>S: updateNode(systemId, {aggregatedLoad})
    U->>E: AHU候補選択・配置
    E->>S: createNode(AhuNode)
    U->>E: 制気口配置 ×N
    E->>S: createNode(DiffuserNode) ×N

    Note over U,V: Phase 3: ルーティング (route)
    U->>E: ダクト手動ルーティング
    E->>S: createNode(DuctSegment) ×N
    E->>S: createNode(DuctFitting) ×N
    S->>S: markDirty(duct nodes)
    C->>S: 風量自動配分 → 寸法選定
    V->>V: 太さ・ラベル更新
    U->>E: 配管ルーティング
    E->>S: createNode(PipeSegment) ×2

    Note over U,V: Phase 4: 計算確認 (calc)
    C->>S: 圧損計算 → requiredFanPressure
    C->>S: バリデーション → warnings[]
    V->>V: 警告バッジ表示
    U->>E: 保存
    S->>S: IndexedDB 永続化
```

## 主要機能のデータフロー

### 機能1: ゾーン作成と負荷計算 🔵

**信頼性**: 🔵 *ストーリー2.1,2.2,2.3・REQ-201〜306より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant ZD as ZoneDrawTool
    participant PE as PerimeterEditTool
    participant S as useScene
    participant LC as LoadCalcSystem
    participant V as HvacZoneRenderer

    U->>ZD: ポリゴン頂点クリック
    ZD->>ZD: リアルタイム面積表示
    U->>ZD: ポリゴン確定
    ZD->>S: createNode(HvacZoneNode.parse({boundary, floorArea, usage}), levelId)
    S->>S: markDirty(hvacZoneId)
    V->>V: useRegistry → グレー半透明表示

    U->>PE: 外皮条件入力
    PE->>S: updateNode(hvacZoneId, {perimeterSegments})
    S->>S: markDirty(hvacZoneId)

    LC->>S: dirtyNodes検出 → 非同期計算開始
    LC->>LC: internalLoad = area × unitLoad[usage]
    LC->>LC: envelopeLoad = Σ(wallArea × glazingRatio × solarCoeff[orientation])
    LC->>LC: coolingLoad = internalLoad + envelopeLoad
    LC->>LC: airflow = coolingLoad / (1.2 × 1005 × ΔT)
    LC->>S: updateNode(hvacZoneId, {calcResult: {coolingLoad, heatingLoad, requiredAirflow, perimeterLoadBreakdown}})
    S->>S: clearDirty(hvacZoneId)
    V->>V: グレー → 用途別カラーにフェードイン
```

**詳細ステップ**:
1. ZoneDrawTool がグリッドイベントを購読し、ポリゴン頂点を収集
2. 面積はリアルタイムで Shoelace formula で算出（REQ-1601）
3. HvacZoneNode.parse() で Zod バリデーション、createNode() で Level の children に追加
4. PerimeterEditTool で方位別外壁面データを入力（半自動 or 手動）
5. LoadCalcSystem が dirty 検出、requestIdleCallback で非同期計算
6. 結果を calcResult に格納し dirty クリア
7. レンダラーが calcResult の変更を購読してカラー更新

### 機能2: 系統グルーピングと機器選定 🔵

**信頼性**: 🔵 *ストーリー3.1,3.2・REQ-401〜505より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant ZG as ZoneGroupingTool
    participant AP as AhuPlaceTool
    participant S as useScene
    participant SA as SystemAggregationSystem
    participant ES as EquipmentSelectionSystem
    participant V as Viewer

    U->>ZG: ゾーン選択（チェックボックス）
    U->>ZG: 「系統に追加」実行
    ZG->>S: createNode(SystemNode.parse({servedZoneIds, systemName}), levelId)
    ZG->>S: updateNode(各zoneId, {systemId: systemNodeId})
    S->>S: markDirty(systemNodeId)

    SA->>S: dirtyNodes検出
    SA->>SA: totalCooling = Σ zone.calcResult.coolingLoad
    SA->>SA: totalAirflow = Σ zone.calcResult.requiredAirflow
    SA->>S: updateNode(systemNodeId, {aggregatedLoad: {totalCoolingLoad, totalHeatingLoad, totalAirflow}})

    ES->>ES: catalog.filter(ahu => ahu.capacity >= total × margin && ahu.airflow >= totalAirflow × margin)
    ES->>ES: sort by capacity closeness
    Note over ES: 候補リストをUIに表示

    U->>AP: AHU候補を選択・配置位置クリック
    AP->>S: createNode(AhuNode.parse({equipmentName, position, ports, ...}), levelId)
    AP->>S: updateNode(systemNodeId, {ahuId: ahuNodeId})
    V->>V: AHU 直方体+ポート円筒を3D表示
```

### 機能3: ダクトルーティングと風量配分 🔵

**信頼性**: 🔵 *ストーリー4.1,4.2・REQ-701〜903より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant DR as DuctRouteTool
    participant S as useScene
    participant AD as AirflowDistributionSystem
    participant DS as DuctSizingSystem
    participant V as DuctSegmentRenderer

    U->>DR: AHU給気ポートクリック（起点）
    DR->>DR: ポートスナップ検出
    U->>DR: 折点クリック（中間点）
    U->>DR: 制気口ポート付近（スナップ → 接続確定）
    DR->>S: createNode(DuctSegmentNode.parse({start, end, startPortId, endPortId, medium: 'supply_air'}), levelId)
    DR->>S: updateNode(ahuPort, {connectedSegmentId: ductId})
    DR->>S: updateNode(diffuserPort, {connectedSegmentId: ductId})

    Note over U,DR: T分岐の場合
    U->>DR: 幹線上で分岐操作
    DR->>S: createNode(DuctFittingNode.parse({fittingType: 'tee', ports: [3ports]}), levelId)

    S->>S: markDirty(duct nodes)

    AD->>S: dirtyNodes検出 → グラフ構築
    AD->>AD: BFS: AHU → Fitting → DuctSegment → Diffuser
    AD->>AD: 逆トラバース: 葉(Diffuser.airflow) → 各区間合算
    AD->>S: updateNode(各ductId, {airflowRate: calculated})
    V->>V: 風量ラベル一斉更新

    DS->>S: dirtyNodes検出（airflowRate変更）
    DS->>DS: 等速法: area = airflow / targetVelocity
    DS->>DS: 標準サイズ表スナップ（アスペクト比≤4.0）
    DS->>S: updateNode(各ductId, {width, height})
    V->>V: 断面比例太さ更新 + 寸法ラベル表示
```

### 機能4: 圧損計算と配管 🔵

**信頼性**: 🔵 *ストーリー4.3,5.1・REQ-1001〜1105より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant S as useScene
    participant PL as PressureLossSystem
    participant PS as PipeSizingSystem
    participant PR as PipeRouteTool
    participant V as Viewer

    Note over U,V: ダクト圧損計算
    PL->>S: dirtyNodes検出（寸法確定済み区間）
    PL->>PL: 直管圧損 = f(Re, ε/D) × L/D × ρv²/2
    PL->>PL: if ductMaterial=flexible: friction ×= 4
    PL->>PL: 継手損失 = ζ × ρv²/2 (エルボ=0.3, T=0.5)
    PL->>PL: 最遠経路探索 → 総圧損合算
    PL->>S: updateNode(各ductId, {calcResult: {pressureLoss}})
    PL->>S: updateNode(systemId, {requiredFanPressure})

    Note over U,V: 配管ルーティング
    U->>PR: AHU冷水ポートから配管描画
    PR->>S: createNode(PipeSegmentNode.parse({medium: 'chilled_water_supply', ...}), levelId)
    S->>S: markDirty(pipeId)

    PS->>S: dirtyNodes検出
    PS->>PS: 冷水流量 = coolingCapacity / (4186 × ΔT_water)
    PS->>PS: 口径 = √(4 × flow / (π × targetVelocity))
    PS->>PS: 標準口径表スナップ（1.0〜2.0 m/s範囲）
    PS->>S: updateNode(pipeId, {nominalSize, calcResult: {pressureLoss}})
    V->>V: 口径比例太さ + 色分け表示
```

### 機能5: 警告バリデーション 🔵

**信頼性**: 🔵 *REQ-1201〜1203・PRDセクション17より*

```mermaid
flowchart TD
    VS[ValidationSystem] --> |全HVACノード走査| Checks

    subgraph Checks[バリデーションチェック]
        C1[未接続ポート検出]
        C2[風量未設定検出]
        C3[寸法未確定検出]
        C4[推奨風速超過検出]
        C5[圧損計算未実施検出]
        C6[系統未割当ゾーン検出]
        C7[風量乖離検出 ±5%]
        C8[配管未接続検出]
    end

    Checks --> Warnings[warnings: Warning[]]

    Warnings --> Badge[ノード上バッジ<br/>赤丸 + 警告数]
    Warnings --> List[左パネル警告一覧]
    Warnings --> Detail[右パネル詳細]

    List --> |クリック| Select[該当ノード選択 + ズーム]
```

## データ処理パターン

### 同期処理 🔵

**信頼性**: 🔵 *既存実装パターンより*

- **ノード CRUD**: createNode/updateNode/deleteNode は同期的に useScene を更新
- **dirty マーク**: 即座に dirtyNodes Set に追加
- **レンダラー更新**: React の再レンダリングサイクルで自動反映

### 非同期処理 🔵

**信頼性**: 🔵 *ヒアリング「dirty検出+非同期」選択より*

- **HVAC 計算**: requestIdleCallback / setTimeout(0) で UI スレッド非ブロッキング
- **カスケード計算**: 各システムの計算完了 → 下流ノード dirty マーク → 次システムが検出
- **計算進捗**: 計算中フラグを useScene に持ち、UI でインジケータ表示

### バッチ処理 🟡

**信頼性**: 🟡 *NFR-001パフォーマンス要件から妥当な推測*

- **風量一括配分**: 1系統の全ダクト区間を1回のトラバーサルで更新
- **寸法一括選定**: 風量確定後に全区間の寸法を一括計算
- **警告一括評価**: 全ノード走査を1パスで実行

## 状態管理フロー

### フロントエンド状態管理 🔵

**信頼性**: 🔵 *既存3ストアパターンより*

```mermaid
stateDiagram-v2
    [*] --> Architecture: 初期状態
    Architecture --> HVAC: setEditorMode('hvac')
    HVAC --> Architecture: setEditorMode('architecture')

    state HVAC {
        [*] --> Zone: 初期フェーズ
        Zone --> Equip: setPhase('equip')
        Equip --> Route: setPhase('route')
        Route --> Calc: setPhase('calc')
        Calc --> Zone: setPhase('zone')

        state Zone {
            [*] --> ZoneSelect
            ZoneSelect --> ZoneBuild: setMode('build')
            ZoneBuild --> ZoneSelect: setMode('select')
        }
    }
```

### HVAC 計算状態管理 🔵

**信頼性**: 🔵 *アーキテクチャ設計・PRDセクション16より*

```mermaid
stateDiagram-v2
    [*] --> Idle: 初期状態
    Idle --> Calculating: dirtyNodes検出
    Calculating --> Cascading: 計算完了 → 下流dirty
    Cascading --> Calculating: 次段階の計算開始
    Cascading --> Idle: 全カスケード完了
    Calculating --> Error: 計算エラー
    Error --> Idle: エラー格納 → dirtyクリア
```

## 保存/復元フロー 🔵

**信頼性**: 🔵 *REQ-1301,1302・ヒアリングQ9より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant S as useScene
    participant IDB as IndexedDB

    Note over U,IDB: 保存
    U->>S: 保存操作
    S->>S: Zod parse で全ノード検証
    S->>IDB: set('scene', {nodes, rootNodeIds, collections})
    IDB-->>S: 保存完了
    S->>U: トースト通知「保存完了」

    Note over U,IDB: 復元
    U->>S: ページリロード
    S->>IDB: get('scene')
    IDB-->>S: {nodes, rootNodeIds, collections}
    S->>S: loadScene(data)
    S->>S: 全ノードmarkDirty
    Note over S: 計算システムが再計算 → 結果復元
```

## 関連文書

- **アーキテクチャ**: [architecture.md](architecture.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **ヒアリング記録**: [design-interview.md](design-interview.md)
- **要件定義**: [requirements.md](../../spec/hvac-bim-mvp/requirements.md)

## 信頼性レベルサマリー

- 🔵 青信号: 14件 (93%)
- 🟡 黄信号: 1件 (7%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質
