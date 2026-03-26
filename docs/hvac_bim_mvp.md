# Kühl — 空調設計 BIM ツール（Pascal Editor ベース）

## PRD 兼基本設計書（MVP / ワンパス版） v2.0

- 作成日: 2026-03-26
- 改訂日: 2026-03-26
- 文書種別: PRD 兼基本設計書
- 開発方針: Pascal Editor をフォーク/カスタマイズして、空調設備の基本設計業務向け BIM ツールとして実装する
- 対象リリース: MVP（最低限のワンパスを通す版）

---

## 改訂履歴

| 版 | 日付 | 概要 |
|---|---|---|
| v1.0 | 2026-03-26 | 初版作成 |
| v2.0 | 2026-03-26 | 空調設計エンジニアレビュー反映。主要変更: ペリメータ外皮条件の入力設計追加、送風温度差の明示化、複数ゾーン→1AHU 系統構成の追加、ダクト風量自動配分ロジックの必須化、フレキダクト圧損対応、配管の必須格上げ、スキーマバージョニングの MVP-0 組込、計算妥当性の受入基準追加 |
| v2.1 | 2026-03-26 | サンプルデータセット仕様を追加（建築参照モデル、機器カタログ、標準サイズ表）。入手方針・自作方針・JSON スキーマ定義・開発スコープへの組込 |
| v2.2 | 2026-03-26 | デモ実施仕様を追加（セクション21）。デモシナリオ・プリセットデータ・画面表示仕様・操作フィードバック・デモ環境・デモゴール定義。対象: 設備設計者向け実務ユーザーテスト |
| v2.3 | 2026-03-26 | デプロイ基盤を Vercel + Supabase に決定。永続化を Supabase（PostgreSQL + Storage）に変更。デモ環境・保存/再読込・技術設計方針・非機能要件を更新 |
| v2.4 | 2026-03-26 | Vercel MCP・Supabase MCP を用いた AI アシストセットアップ手順を追加。Claude Code / claude.ai から MCP 経由でインフラ構築・DB マイグレーション・デプロイを実行する運用を定義 |

---

## 1. 文書の目的

本書は、Pascal Editor をベースに実装する「空調設計 BIM ツール（Kühl）」の MVP（Minimum Viable Product）を定義する。

MVP の狙いは、空調設備設計の全業務を一気に実装することではなく、1 案件・1 系統・1 フロアを対象に、条件入力から負荷算定、機器仮選定、ダクト一次ルーティング、配管一次ルーティング、計算結果確認までを一筆書きで完了できることに置く。

つまり本 MVP は、図面・計算・系統情報が Pascal Editor 上で連続してつながることを検証するための版である。

---

## 2. 背景と前提

元仕様では、対象業務は「空調設備の基本設計フェーズ」に特化し、対象として空調負荷計算、機器選定、ダクト/配管ルーティング、系統構成、数量拾い、IFC 連携を含み、対象外として衛生・電気・防災・施工図レベル詳細などを置いている。さらに想定ワークフローは、建築躯体読込 → ゾーニング → 負荷計算 → 空調方式選定 → 機器選定 → ダクト/配管ルーティング → 圧損確認 → 数量拾い → IFC 出力、の順で定義されている。

また元仕様では、Pascal Editor 系の実装を前提としたノード中心アーキテクチャとして、Plant / Building / Level / HvacZone と、AHU・PAC・Diffuser・DuctSegment・PipeSegment などの設備ノード、さらに `packages/core/src/systems` 配下に zone / equipment / duct / pipe / takeoff / ifc の計算・変換系システムを置く構成が想定されている。

本書ではこの方針を引き継ぎつつ、MVP では対象を絞り込み、まずは空調機器系統 1 本を成立させるワンパスを最小単位として設計する。

---

## 3. MVP の定義

### 3.1 MVP で実現すること

MVP で実現するユーザーストーリーは以下の 1 本に限定する。

1. ユーザーが建築躯体の参照データを読み込む
2. フロア上で空調ゾーンを作成し、用途・面積・条件を設定する
3. ゾーンごとの概算負荷と必要風量を算出する
4. 対象ゾーンに対して空調方式を 1 種選択する
5. 複数ゾーンを 1 つの AHU 系統にグルーピングする
6. グルーピング後の合算負荷に基づき、候補機器を 1 件以上提示し、1 件を採用する
7. 採用機器から制気口までダクトを一次ルーティングする（分岐時の風量は自動配分される）
8. 必要に応じて冷温水配管を一次ルーティングする
9. ダクト寸法・配管口径・圧損の一次計算結果を確認する
10. 系統として未接続や計算不能がないことを確認する
11. 計算結果と主要構成要素を保存する

### 3.2 MVP の完了条件

以下を満たした場合、MVP のワンパスが成立したとみなす。

- 1 フロア上で 1 つ以上の HvacZone が作成できる
- 各ゾーンで冷房負荷・暖房負荷・必要風量が算出される
- 複数ゾーンを 1 つの AHU 系統にグルーピングできる
- 1 系統分の機器（MVP では AHU 系）を配置できる
- 機器ポートから制気口までダクト接続が成立する
- ダクト分岐時に風量が上流から自動配分される
- AHU の冷温水配管接続が成立する
- ダクト寸法選定と圧損計算の最小結果が出る
- 配管口径と概算圧損が出る
- 右パネルで対象ノードの諸元と計算結果が見える
- 未接続・過大風速・計算未実施などの警告が出せる
- プロジェクトを JSON 形式で保存/再読込できる（スキーマバージョン付き）

---

## 4. MVP の対象範囲

### 4.1 対象

MVP では以下を対象とする。

- 基本設計フェーズ
- 単一建物、単一フロア
- 単一ユーザー操作
- ゾーニング（ペリメータ/インテリア区別を含む）
- 負荷概算（外皮条件の方位別入力を含む）
- 系統構成（複数ゾーン → 1 AHU のグルーピング）
- 機器仮選定
- ダクト一次ルーティング（風量自動配分を含む）
- 配管一次ルーティング（冷温水 2 管、最小実装）
- 一次計算結果表示
- 系統警告表示
- 保存/再読込（スキーマバージョニング付き）

### 4.2 MVP での業務絞り込み

元仕様では AHU、PAC、FCU、VRF、ダクト、冷温水/冷媒/ドレン配管、拾い、IFC 出力など広範に定義されているが、MVP ではまず AHU+制気口の一系統に絞る。ノード体系として HvacZone、Ahu、Diffuser、DuctSegment、PipeSegment が中核である点は元仕様と整合する。

MVP-B（AHU 系）を標準ケースとする理由は、ダクト計算の価値が高く Pascal Editor の接続モデルとも相性がよいためである。

- Zone（複数）→ AHU → Duct → Diffuser
- AHU → 冷温水配管（供給/還水の 2 管）

### 4.3 対象外

MVP では以下を実装しない。

- 複数フロア跨ぎ
- 複数建物
- PAC / VRF 系統
- 詳細な施工図作成
- 高度な自動経路探索
- 完全な IFC 出力
- 積算システム連携
- 冷熱源設備の詳細設計
- 冷媒配管、ドレン配管
- 同時編集/権限制御
- 高度な干渉チェック

---

## 5. 解くべき課題

現行の空調基本設計業務では、ゾーニング情報、負荷計算条件、機器仮選定結果、ダクト/配管ルート、計算結果が別々のツールや資料に分散しやすい。そのため、条件変更時の手戻り、系統情報の不整合、根拠の追跡困難が発生する。

MVP はこれに対し、Pascal Editor 上のノード/接続/計算結果を単一モデルとして保持し、設計の流れを一続きの操作にすることで、基本設計時点での検討速度と整合性を上げることを目的とする。

---

## 6. 想定ユーザー

### 6.1 主対象

- 空調設備設計者
- 機械設備設計の BIM オペレータ
- 基本設計段階で方式比較・容量検討を行う担当者

### 6.2 利用シーン

- 建築平面を参照しながら空調ゾーンを切る
- ペリメータとインテリアで負荷の違いを確認する
- 複数ゾーンを 1 つの AHU にまとめて系統構成を決める
- 負荷概算から必要風量を確認する
- AHU/制気口を置いて一次ルートを成立させる
- ダクト寸法と圧損の当たりを付ける
- 設計初期のレビュー資料をつくる

---

## 7. MVP ユースケース（ワンパス）

### 7.1 主ユースケース

UC-01: 1 系統の基本設計を最初から最後まで通す

1. ユーザーは建築参照モデルを読み込む
2. 対象フロアを選択する
3. ゾーン境界を描画し、用途・面積・天井高を設定する
4. ゾーンがペリメータに接する場合、方位別外壁面積・ガラス面積比を設定する（建築参照からの半自動入力を補助とする）
5. ツールが冷暖房負荷と必要風量を算出する（送風温度差はシステム方式に応じたデフォルト値が自動設定され、ユーザーが上書き可能）
6. ユーザーは空調方式を AHU 系に設定する
7. ユーザーは対象ゾーンを選択し、1 つの AHU 系統にグルーピングする
8. ツールがグルーピング後の合算負荷・合算風量から機器候補を提示する
9. ユーザーは AHU を 1 台採用し配置する
10. ユーザーは制気口を配置する
11. ユーザーは AHU から制気口へダクトルートを引く（分岐を含む）
12. ツールが系統グラフをトラバースし、各ダクト区間に風量を自動配分する
13. ツールが各区間の寸法・圧損を計算する
14. ユーザーは AHU の冷温水配管ルートを引く
15. ツールがコイル流量から口径を自動決定し、圧損を概算する
16. ユーザーは右パネルで系統結果を確認する
17. ツールが警告一覧を表示する
18. ユーザーは保存する

### 7.2 成果物

- ゾーン定義（外皮条件を含む）
- 系統構成（ゾーン-AHU 対応）
- 機器ノード
- 制気口ノード
- ダクト/配管ノード
- 系統接続情報
- 概算計算結果（負荷・風量・寸法・圧損）
- 警告一覧
- 保存ファイル（JSON、スキーマバージョン付き）

---

## 8. 業務フローと MVP 対応範囲

業務フロー全体は、大きく「機器」「ダクト」「配管」にまたがり、上流で熱負荷要素整理・熱負荷算定・システム構成検討・必要風量算定・空気線図/コイル能力検討・機器選定、下流でダクトルーティング/サイズ計算/器具選定、さらに配管流量選定・配管ルーティング・サイズ計算・系統図作成へと流れる。

MVP ではこの全体のうち、以下を一筆書きで通す。

- A/B/C/D 相当: ゾーン条件整理（外皮条件を含む）、熱負荷算定、システム構成決定（ゾーングルーピング）、必要風量算定
- G/H/I/J 相当: 機器仮選定、制気口配置、ダクト一次図作成、ダクトルーティング（風量自動配分を含む）
- M/N/O/P 相当: 配管一次ルーティング、口径自動決定、簡易圧損計算

一方で、コイル能力詳細検討、機器容量精緻化、器具詳細選定、配管系統図の完成、系統図帳票の整形は後続とする。

---

## 9. プロダクト要求（PRD）

### 9.1 価値仮説

- 負荷計算からルーティングまでを 1 画面でつなげると、基本設計初期の試行回数が増える
- ノードベースで系統情報を保持すると、条件変更時の再計算が容易になる
- Pascal Editor の既存編集基盤を活かすことで、3D 表示・選択・プロパティ編集・ツール切替を短期間で流用できる
- ゾーングルーピングにより実案件と同じ N:1（複数ゾーン対 1 AHU）構成を扱えることで、実務への適用障壁を下げる

### 9.2 成功指標

MVP の評価指標は以下とする。

- 1 フロア 1 系統を 30 分以内に初期入力できる
- 条件変更後、再計算が 5 秒以内に完了する
- 保存→再読込でノード欠損がない
- 主要エラー（未接続、風量未定義、寸法未確定）を検知できる
- 社内レビューで「設計の流れが切れない」と評価される
- サンプル案件の手計算結果と、ツールの負荷計算結果が ±20% 以内で一致する
- ダクト圧損計算結果が、同条件での手計算と ±15% 以内で一致する
- 機器選定結果が、手動でカタログから選んだ場合と同一機種になる（同一マスターを使う前提）

### 9.3 必須要求

- 建築参照モデルの表示
- ゾーン作成/編集（ペリメータ外皮条件の入力を含む）
- 負荷概算（方位別外皮補正を含む）
- 系統構成（複数ゾーン → 1 AHU グルーピング）
- 機器配置
- 制気口配置
- ダクト接続（分岐時の風量自動配分を含む）
- ダクト寸法選定
- ダクト圧損計算（フレキダクト区間対応を含む）
- 冷温水配管接続（口径自動決定、概算圧損）
- 右パネルでの諸元表示
- 警告表示
- 保存/再読込（スキーマバージョニング付き）

### 9.4 あればよいが MVP では任意

- 自動経路提案
- メーカーカタログ連携
- 拾い数量集計
- IFC エクスポート
- 帳票生成
- 建築参照からの外壁面自動検出（MVP では手動入力を基本とし、半自動を補助とする）

---

## 10. 基本設計方針

### 10.1 アーキテクチャ方針

元仕様にあるノードベース構成を踏襲する。HvacZone、Ahu、Diffuser、DuctSegment、PipeSegment などを `AnyNode` 配下の設備ノードとして扱い、計算は `packages/core/src/systems` 配下の zone / equipment / duct / pipe 系システムとして分離する。

MVP では Pascal Editor の以下を流用する。

- シーン/ビューポート基盤
- ノード選択・配置・移動
- プロパティパネル
- 状態管理
- Undo/Redo の基本仕組み
- 保存/読込の基本枠組み

新規実装するのは以下である。

- HVAC ノードスキーマ（系統構成ノードを含む）
- HVAC 専用ツール（ゾーングルーピング操作を含む）
- 負荷計算システム（外皮補正を含む）
- ダクト計算システム（風量自動配分、フレキ圧損対応を含む）
- 配管計算システム（コイル流量→口径→圧損の最小パイプライン）
- HVAC プロパティ UI
- 系統警告ロジック
- スキーマバージョニングと migration runner

### 10.2 レイヤ構成

- `apps/editor`: HVAC 用 UI、ツール、パネル
- `packages/core`: ノード schema、計算 systems、validators、migration
- `packages/viewer`: ダクト/配管/機器 renderer

---

## 11. MVP の機能要件

### 11.1 建築参照読込

**要件**

- 建築参照データを読み込めること
- フロア、壁、床、柱、梁、天井を参照表示できること
- 設備編集対象とは分離された参照モデルとして扱うこと
- 外壁面の方位情報を保持すること（ゾーニング時の外皮条件入力の補助に使う）

**MVP 方針**

- 初版では IFC 全読込にこだわらず、Pascal Editor に載せられる参照メッシュ/簡易 IFC 読込のどちらかでよい
- 編集禁止の `ArchitectureRefNode` 扱いにする
- 外壁面の方位・面積情報は、読込時にメタデータとして抽出を試みる。抽出できない場合はユーザー手動入力にフォールバックする

### 11.2 ゾーニング

**要件**

- フロア平面上でゾーン境界を描ける
- ゾーン用途、面積、天井高、人数などを設定できる
- ゾーンごとに方式種別を持てる
- ペリメータゾーンの外皮条件（方位別外壁面積、ガラス面積比）を入力できる

**データ: HvacZoneNode**

- id
- type = `hvac_zone`
- zoneName
- usage
- floorArea
- ceilingHeight
- occupantDensity
- designConditions
  - indoorTempCooling
  - indoorTempHeating
  - indoorHumidity
  - supplyAirTempDiff（デフォルト: AHU 系 10℃。方式選択時に自動設定、ユーザー上書き可）
- perimeterSegments（v2 追加）
  - orientation（N / NE / E / SE / S / SW / W / NW）
  - wallArea（m²）
  - glazingRatio（0.0〜1.0）
- loadResult
- hvacType
- boundary
- systemId（所属する AHU 系統の ID。未グルーピング時は null）

**ペリメータ外皮条件の入力導線（v2 追加）**

ゾーン作成時に、建築参照モデルの外壁面とゾーン辺の交差を検出し、該当する方位・壁面積・推定ガラス面積比を perimeterSegments に半自動入力する。自動検出できない場合はユーザーが手動で方位別に入力する。この情報は負荷概算の外皮補正に直接使用される。

**設計根拠**: 同じ事務室でもペリメータ（外壁面あり・ガラス面大）とインテリア（内部発熱主体）で負荷が倍近く異なる。外皮条件を「補正係数 1 つ」で済ませるとペリメータゾーンの負荷が実態から大きく外れ、後続の機器選定が当たりにならない。

### 11.3 系統構成（v2 追加）

**要件**

- 複数の HvacZone を 1 つの AHU 系統にグルーピングできる
- グルーピング後の合算負荷・合算風量で機器選定を行える
- 1 つのゾーンが複数系統に属することはできない（1:N ではなく N:1）

**データ: SystemNode**

- id
- type = `system`
- systemName
- servedZoneIds: string[]（対象ゾーン ID のリスト）
- ahuId: string | null（採用 AHU ノード ID）
- aggregatedLoad
  - totalCoolingLoad（対象ゾーン合算）
  - totalHeatingLoad（対象ゾーン合算）
  - totalAirflow（対象ゾーン合算）
- status（draft / configured / calculated）

**UI 操作**

- Equip フェーズで、ゾーン一覧からドラッグまたはチェックボックスで系統にゾーンを追加する
- グルーピング後、合算値が即時更新される
- 系統に含まれていないゾーンは警告表示の対象とする

**設計根拠**: 実務では 1 台の AHU が複数ゾーンを受け持つケースが普通であり、ゾーン 1 つに AHU 1 台の 1:1 対応では実案件に使えない。

### 11.4 負荷概算

**要件**

- 冷房負荷、暖房負荷、必要風量を算出できる
- 用途別原単位と外皮条件による方位別補正で算出する
- 詳細熱負荷計算ではなく基本設計向け概算法を採用する
- 送風温度差（ΔT）を明示的にパラメータとして持つ

**計算方針**

- 基本負荷 = 面積 × 用途別原単位（W/m²）
- 外皮補正 = Σ（方位別外壁面積 × ガラス面積比 × 方位別日射補正係数 + 外壁面積 × 貫流補正係数）
- 冷房負荷 = 基本負荷 + 外皮補正（冷房側）
- 暖房負荷 = 基本負荷の暖房原単位 + 外皮補正（暖房側）
- 必要風量 = 冷房負荷 ÷ (空気密度 × 比熱 × ΔT)
  - AHU 系デフォルト ΔT = 10℃
  - ユーザーが designConditions.supplyAirTempDiff で上書き可能

**方位別日射補正係数（MVP 簡易テーブル）**

| 方位 | 冷房補正係数 |
|---|---|
| S | 1.0（基準） |
| SE / SW | 1.1 |
| E / W | 1.2 |
| NE / NW | 0.8 |
| N | 0.6 |

**設計根拠**: ΔT が未定義だと、AHU 系の ΔT=10℃ と PAC 系の ΔT=15℃ で同じ負荷でも必要風量が 1.5 倍変わる。明示的にパラメータ化し、方式選択時にデフォルト値を自動セットする。

### 11.5 機器仮選定

**要件**

- 系統の合算負荷と合算風量から、AHU 候補を提示できる
- ユーザーが候補から採用機器を選べる
- 採用後、ノードとして配置できる

**MVP 方針**

- 初版は固定マスターまたはローカル JSON でよい
- メーカー正式連携は後続
- 候補提示ロジックは「容量 >= 合算負荷 × 余裕率」「風量 >= 合算風量 × 余裕率」の条件
- 余裕率のデフォルトは 1.1（10%）。ユーザーが変更可能

### 11.6 制気口配置

**要件**

- 制気口ノードを配置できる
- ゾーンに紐づけできる
- 必要風量を複数口へ配分できる

**MVP 方針**

- 初版は均等配分
- 詳細な到達距離・騒音・吹出条件は表示のみまたは未対応

### 11.7 ダクト一次ルーティング

**要件**

- 機器ポートから制気口までダクトを作成できる
- 折点を打ちながら手動ルーティングできる
- 接続時にポートへスナップする
- 区間ごとに風量・寸法・圧損を持てる

**MVP 方針**

- 手動ルーティング主体
- 分岐数は少数ケースに限定
- 1 系統 1 幹線 + 数分岐までを対象とする

### 11.8 ダクト風量自動配分（v2 追加）

**要件**

- ダクト系統グラフを上流（AHU 給気ポート）からトラバースし、各 DuctSegmentNode の airflowRate を下流ノードの合算で自動セットする
- ユーザーによる手動上書きも可能とする（上書き時は dirty フラグを立て、上流区間を再計算する）

**アルゴリズム**

1. AHU の給気ポートを起点とし、接続グラフを末端（制気口）まで探索する
2. 各制気口の airflowRate を葉ノードの値とする
3. 分岐点から上流に向かって、下流の合算風量を各区間に設定する
4. AHU 直近の幹線区間の風量が、系統の合算風量と一致することを検証する

**設計根拠**: ダクト寸法選定も圧損計算も、各区間の風量が確定していないと動かない。手入力に依存すると間違いの元であり、接続トポロジーから自動計算するのが必須である。

### 11.9 ダクト寸法選定

**要件**

- 風量からダクトサイズを決定できる
- MVP では等速法を基本とする
- 矩形/円形の少なくともどちらかを扱える

**MVP 方針**

- 標準は矩形ダクト
- 円形は対応できれば追加
- 標準サイズ表へのスナップを行う
- 幹線（推奨風速 6〜8 m/s）と枝線（推奨風速 3〜5 m/s）で既定風速を切り替える

### 11.10 ダクト圧損計算

**要件**

- 区間長、風量、断面から直管圧損を計算できる
- 継手損失を簡易加算できる
- フレキシブルダクト区間に対して別の摩擦係数を適用できる（v2 追加）
- 最遠経路の総圧損を算出できる

**MVP 方針**

- 直管 + エルボ + 分岐の簡易係数テーブル
- フレキダクト区間は鋼板ダクトの 3〜5 倍の摩擦係数を適用する
- DuctSegmentNode に ductMaterial 属性を持たせ、`galvanized`（デフォルト）と `flexible` を区別する
- リアルタイム再計算または明示実行のいずれか

**設計根拠**: AHU 系で制気口手前のフレキ接続は実務上ほぼ 100% 使われる。フレキの単位長さ当たり圧損は鋼板ダクトの 3〜5 倍であり、無視すると系統圧損が実態の半分以下に出る場合がある。

### 11.11 配管一次ルーティング（v2: 必須に格上げ）

**要件**

- AHU の冷温水入出口から配管を引ける
- 口径を自動決定できる
- 圧損を概算できる

**MVP 方針（最小実装）**

AHU 系のワンパスを謳う以上、冷温水配管がないと系統として成立しないため、必須とする。ただし以下の通り最小実装に留める。

- 冷温水 2 管のみ（冷水供給 + 冷水還水）
- ドレン・冷媒は後続
- 配管ルーティングは折点付き手動接続（ダクトと同等の操作感）
- 口径は AHU コイル能力から自動算出:
  - コイル流量 = コイル能力 ÷ (水の比熱 × 密度 × ΔT_water)
  - ΔT_water デフォルト = 5℃
  - 口径は流速 1.0〜2.0 m/s の範囲で標準口径表にスナップ
- 圧損は等価長さ法で概算表示

**設計根拠**: 配管なしでは AHU 系統のワンパスが完結しない。ただし MVP での割り切りとして、配管の自動ルーティングや詳細損失計算は行わず、「接続が成立し、口径と概算圧損が出る」ことをゴールとする。

### 11.12 警告表示

**要件**

以下を検出して一覧表示できること。

- 未接続ポート
- 風量未設定
- 寸法未確定
- 推奨風速超過
- 圧損計算未実施
- ゾーンが系統未割当（v2 追加）
- 制気口風量合計と系統風量の乖離（v2 追加）
- 配管未接続（v2 追加）

### 11.13 保存/再読込

**要件**

- ノード、接続、計算結果、UI 最小状態を保存できる
- 再読込後に同じワンパス結果が復元できる
- スキーマバージョンを保持し、バージョン不一致時に migration を実行する（v2 追加）

**MVP 方針**

- プロジェクトデータは Supabase（PostgreSQL）に保存する（v2.3 変更）
- 大容量の建築参照データ・プリセットデータは Supabase Storage に保存する（v2.3 追加）
- JSON エクスポート/インポートも併用可能とする（ローカルバックアップ用）
- ファイルルートに `schemaVersion: string` を持つ
- migration runner を MVP-0 の基盤整備で導入する（中身は空でよいが枠を初日から入れる）
- DB スキーマの migration は Supabase Migration で管理する（v2.3 追加）

**設計根拠**: MVP フェーズ中にスキーマが頻繁に変わるのは確実であり、migration の枠がないと過去の保存データが全滅する。

---

## 12. 非機能要件

### 12.1 性能

- 1 フロア、100〜300 ノード規模で操作できること
- 通常操作で 30fps 以上を目標とする
- 単発再計算は 5 秒以内

### 12.2 信頼性

- 保存データがスキーマ検証を通ること
- 計算失敗時もエディタは落ちないこと
- 失敗ノードにエラー状態を付与できること

### 12.3 操作性

- フェーズ切替が明快であること
- 選択中ノードの諸元・計算結果が常に右パネルで見えること
- 主要操作は 3 クリック程度で開始できること

MVP では zone / equip / route / calc の 4 フェーズを基本とする。

### 12.4 デプロイ・可用性（v2.3 追加）

- Vercel へのデプロイが CI/CD（GitHub Actions または Vercel Git Integration）で自動化されていること
- PR ごとにプレビュー環境が自動生成されること
- Supabase との通信遅延が保存/読込操作で 2 秒以内であること
- オフライン時もエディタの操作（描画・配置・ルーティング）は継続できること（保存はオンライン復帰後）
- Supabase の無料枠（500MB DB、1GB Storage）で MVP 期間のデータ量を十分カバーできること

---

## 13. 画面設計（MVP）

### 13.1 画面構成

**上部バー**

- プロジェクト名
- フェーズ切替（Zone / Equip / Route / Calc）
- 保存 / 再計算

**左パネル**

- 系統ツリー（系統 → ゾーン → 機器の階層表示）
- ゾーン一覧
- 機器カタログ（簡易）
- 警告一覧

**中央**

- 3D/平面ビューポート
- 建築参照モデル
- 設備ノード描画
- 接続ルートプレビュー

**右パネル**

- 選択ノードのプロパティ
- ペリメータ外皮条件（ゾーン選択時）（v2 追加）
- 系統グルーピング情報（系統ノード選択時）（v2 追加）
- 計算結果
- 接続先情報

**下部（任意）**

- 計算ログ
- 簡易結果テーブル

### 13.2 フェーズごとの有効ツール

**Zone**

- select
- zone_draw
- zone_edit
- perimeter_edit（v2 追加: 外皮条件入力）
- load_calc

**Equip**

- select
- zone_grouping（v2 追加: ゾーングルーピング）
- ahu_place
- diffuser_place

**Route**

- select
- duct_route
- pipe_route

**Calc**

- select
- pressure_loss
- validate

---

## 14. データモデル基本設計

### 14.1 MVP で使う主要ノード

**空間系**

- PlantNode
- BuildingNode
- LevelNode
- ArchitectureRefNode
- HvacZoneNode

**系統系（v2 追加）**

- SystemNode

**機器系**

- AhuNode
- DiffuserNode

**ルート系**

- DuctSegmentNode
- DuctFittingNode
- PipeSegmentNode

### 14.2 HvacZoneNode 必須項目

- id
- type = `hvac_zone`
- zoneName
- usage
- floorArea
- ceilingHeight
- occupantDensity
- designConditions
  - indoorTempCooling
  - indoorTempHeating
  - indoorHumidity
  - supplyAirTempDiff（v2 追加。デフォルト: AHU 系 10℃）
- perimeterSegments（v2 追加）
  - orientation
  - wallArea
  - glazingRatio
- loadResult
  - coolingLoad
  - heatingLoad
  - requiredAirflow
  - perimeterLoadBreakdown（v2 追加: 方位別補正内訳）
- hvacType
- boundary
- systemId（v2 追加）

### 14.3 SystemNode 必須項目（v2 追加）

- id
- type = `system`
- systemName
- servedZoneIds: string[]
- ahuId: string | null
- aggregatedLoad
  - totalCoolingLoad
  - totalHeatingLoad
  - totalAirflow
- status

### 14.4 AhuNode 必須項目

- id
- type = `ahu`
- tag
- equipmentName
- position
- ports
- airflowRate
- coolingCapacity
- heatingCapacity
- staticPressure
- systemId

### 14.5 DiffuserNode 必須項目

- id
- type = `diffuser`
- tag
- subType
- position
- airflowRate
- hostDuctId
- systemId

### 14.6 DuctSegmentNode 必須項目

- id
- type = `duct_segment`
- start
- end
- medium
- shape
- width/height または diameter
- ductMaterial（v2 追加: `galvanized` | `flexible`。デフォルト: `galvanized`）
- airflowRate（v2 変更: 自動配分で設定される。手動上書き可）
- startPortId
- endPortId
- systemId
- calcResult

### 14.7 PipeSegmentNode 必須項目

- id
- type = `pipe_segment`
- start
- end
- medium（`chilled_water_supply` | `chilled_water_return`）
- nominalSize
- startPortId
- endPortId
- systemId
- calcResult

### 14.8 保存ファイルルート構造（v2 追加）

- schemaVersion: string
- projectName
- createdAt
- updatedAt
- nodes: AnyNode[]
- edges: Edge[]
- uiState: { phase, selectedNodeId, ... }

---

## 15. 計算ロジック基本設計

### 15.1 負荷計算

**入力**

- ゾーン用途
- 面積
- 天井高
- perimeterSegments（方位別外壁面積、ガラス面積比）（v2 追加）
- 設計条件（送風温度差を含む）

**出力**

- coolingLoad
- heatingLoad
- requiredAirflow
- perimeterLoadBreakdown（v2 追加）

**MVP アルゴリズム**

1. 内部負荷 = floorArea × usageUnitLoad（W/m²）
2. 外皮負荷（冷房）= Σ perimeterSegments について:
   - ガラス日射負荷 = wallArea × glazingRatio × orientationCoolingFactor × 日射基準値
   - 壁体貫流負荷 = wallArea × (1 - glazingRatio) × 壁体貫流係数 + wallArea × glazingRatio × ガラス貫流係数
3. coolingLoad = 内部負荷 + 外皮負荷（冷房）
4. heatingLoad = floorArea × heatingUnitLoad + 外皮負荷（暖房）
5. requiredAirflow = coolingLoad ÷ (1.2 × 1005 × supplyAirTempDiff)（m³/h 換算）

### 15.2 系統集計（v2 追加）

**入力**

- SystemNode.servedZoneIds
- 各ゾーンの loadResult

**出力**

- aggregatedLoad（合算冷房負荷、合算暖房負荷、合算風量）

**アルゴリズム**

- 単純合算。同時使用率等の補正は後続で追加可能な拡張ポイントとする。

### 15.3 機器選定

**入力**

- 系統の合算負荷
- 系統の合算風量
- カタログ候補一覧
- 余裕率（デフォルト 1.1）

**出力**

- 採用候補リスト
- 推奨 1 件

**MVP アルゴリズム**

- 条件を満たす候補を絞る（容量 >= 合算負荷 × 余裕率、風量 >= 合算風量 × 余裕率）
- 容量過不足の少ない順に並べる

### 15.4 ダクト風量自動配分（v2 追加）

**入力**

- 系統グラフ（AHU → DuctSegment → DuctFitting → DuctSegment → ... → Diffuser）
- 各 Diffuser の airflowRate

**出力**

- 各 DuctSegmentNode の airflowRate

**アルゴリズム**

1. 系統グラフを末端（Diffuser）から AHU 方向へ逆トラバースする
2. 各分岐点で、下流全 Diffuser の airflowRate を合算する
3. 分岐点から上流の DuctSegmentNode に合算値を設定する
4. AHU 直近の幹線区間が SystemNode.aggregatedLoad.totalAirflow と一致することを検証する

### 15.5 ダクト寸法選定

**入力**

- airflowRate（自動配分済み）
- shape
- targetVelocity（幹線: 7 m/s、枝線: 4 m/s をデフォルト）
- standardSizes

**出力**

- width/height or diameter
- velocity
- frictionRate

**MVP アルゴリズム**

- 等速法のみ
- 標準サイズへ丸める

### 15.6 ダクト圧損

**入力**

- 区間長
- 風量
- 寸法
- 継手種別
- ductMaterial（v2 追加）

**出力**

- 区間圧損
- 系統総圧損
- requiredFanPressure

**MVP アルゴリズム**

- 直管摩擦 + 局部損失
- ductMaterial = `flexible` の場合、直管摩擦係数を galvanized の 4 倍とする（v2 追加）
- 最遠経路探索は簡易グラフで実施

### 15.7 配管口径/圧損

**入力**

- AHU のコイル冷房能力（W）
- 冷水温度差 ΔT_water（デフォルト 5℃）
- 配管長
- 管種

**出力**

- コイル流量（L/min）
- nominalSize
- pressureLoss
- requiredPumpHead

**MVP アルゴリズム**

1. コイル流量 = coolingCapacity ÷ (4186 × ΔT_water × 1000) × 60（L/min 換算）
2. 必要断面積 = コイル流量 ÷ 目標流速（デフォルト 1.5 m/s）
3. 標準口径表にスナップ
4. 等価長さ法で圧損概算

---

## 16. アプリケーション処理フロー

### 16.1 ワンパス処理順

1. Project 作成
2. ArchitectureRef 読込
3. Level 選択
4. Zone 作成（外皮条件入力を含む）
5. Zone 負荷計算
6. ゾーングルーピング（系統構成）（v2 追加）
7. 系統集計（v2 追加）
8. AHU 候補選定
9. AHU 配置
10. Diffuser 配置
11. ダクトルーティング
12. ダクト風量自動配分（v2 追加）
13. ダクト寸法選定
14. ダクト圧損計算
15. 配管ルーティング
16. 配管口径自動決定/圧損計算
17. Validate 実行
18. 保存

### 16.2 再計算トリガー

以下の変更で dirty を立てる。

- Zone 条件変更（外皮条件変更を含む）
- ゾーングルーピング変更（v2 追加）
- 機器変更
- ルート変更（ダクト接続トポロジー変更時は風量再配分を含む）
- 断面変更
- 配管変更

再計算対象は依存グラフで限定する。

- Zone 変更 → 負荷、系統集計、機器候補、風量、関連ダクト
- グルーピング変更 → 系統集計、機器候補（v2 追加）
- ルート変更 → 風量再配分、寸法、圧損、警告（v2 変更）
- 機器変更 → 接続風量、ポート整合、ダクト/配管

---

## 17. バリデーション設計

### 17.1 入力バリデーション

- ゾーン面積 > 0
- 機器風量 > 0
- ダクト start/end 定義済み
- ポート接続先の medium 整合
- perimeterSegments の glazingRatio が 0.0〜1.0 の範囲（v2 追加）

### 17.2 業務バリデーション

- ゾーンに方式未設定
- ゾーン負荷未計算
- ゾーンが系統未割当（v2 追加）
- 必要風量に対し機器風量不足
- 制気口風量合計と系統風量の乖離（許容 ±5%）（v2 追加）
- ダクト未接続
- ダクト区間の風量未設定（自動配分失敗時）（v2 追加）
- 圧損超過
- 配管未接続（v2 追加）

### 17.3 表示方針

- ノード上バッジ
- 左パネル警告一覧
- 右パネル詳細

---

## 18. 技術設計方針

### 18.1 実装モジュール

**`packages/core/src/schema/nodes/`**

- hvac-zone.ts
- system.ts（v2 追加）
- ahu.ts
- diffuser.ts
- duct-segment.ts（ductMaterial 属性を含む）
- pipe-segment.ts

**`packages/core/src/systems/`**

- zone/load-calc-system.ts（外皮補正ロジックを含む）
- zone/system-aggregation.ts（v2 追加: 系統集計）
- zone/airflow-distribution.ts（v2 追加: ダクト風量自動配分）
- equipment/ahu-selection.ts
- duct/duct-sizing.ts
- duct/duct-pressure-loss.ts（フレキ圧損対応を含む）
- pipe/pipe-sizing.ts
- pipe/pipe-pressure-loss.ts
- validate/hvac-validator.ts
- migration/migration-runner.ts（v2 追加）
- migration/migrations/（v2 追加: バージョン別 migration スクリプト格納先）

**`apps/editor/src/tools/`**

- zone-draw-tool.ts
- perimeter-edit-tool.ts（v2 追加）
- zone-grouping-tool.ts（v2 追加）
- ahu-place-tool.ts
- diffuser-place-tool.ts
- duct-route-tool.ts
- pipe-route-tool.ts

**`packages/viewer/src/renderers/`**

- hvac-zone-renderer.ts
- ahu-renderer.ts
- diffuser-renderer.ts
- duct-renderer.ts
- pipe-renderer.ts

### 18.2 状態管理

- project.nodes
- project.systems（v2 追加）
- project.edges または port 接続情報
- project.schemaVersion（v2 追加）
- ui.phase
- ui.selectedNodeId
- calc.dirtyFlags
- calc.validationResults

### 18.3 永続化（v2.3 更新）

- プロジェクトデータは Supabase（PostgreSQL）に保存する
- 大容量ファイル（建築参照、プリセット）は Supabase Storage に保存する
- JSON export/import も併用可能（ローカルバックアップ）
- schemaVersion を持つ
- アプリケーション内の migration runner と Supabase Migration の 2 層で管理する
- migration runner は MVP-0 で枠を導入し、以後のスキーマ変更ごとに migration スクリプトを追加する

### 18.4 デプロイ基盤（v2.3 追加）

**フロントエンド: Vercel**

- フレームワーク: React（Pascal Editor ベース）
- ビルド: pnpm build → Vercel にデプロイ
- 環境変数: Supabase URL / anon key を Vercel の Environment Variables で管理
- プレビューデプロイ: PR ごとに自動生成（レビュー・テスト用）
- 本番 URL: `https://kuhl.vercel.app`（仮）

**バックエンド: Supabase**

| サービス | 用途 |
|---|---|
| PostgreSQL | プロジェクトデータ、ノード、接続、計算結果の永続化 |
| Storage | 建築参照モデル、プリセット JSON、将来的なアップロードファイル |
| Auth | MVP では匿名認証（anonymous sign-in）。将来的にメール/SSO 追加 |
| Realtime | MVP では不使用。将来的な同時編集で活用 |
| Edge Functions | MVP では不使用。将来的な重い計算のサーバーサイド実行で活用 |

**Supabase テーブル設計（MVP 最小）**

```sql
-- プロジェクト
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schema_version text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  owner_id uuid references auth.users(id)
);

-- プロジェクトデータ（ノード・接続・計算結果を JSON として保持）
create table project_data (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz default now()
);

-- RLS ポリシー
alter table projects enable row level security;
alter table project_data enable row level security;

create policy "Users can manage own projects"
  on projects for all
  using (auth.uid() = owner_id);

create policy "Users can manage own project data"
  on project_data for all
  using (
    project_id in (
      select id from projects where owner_id = auth.uid()
    )
  );
```

**Supabase Storage バケット**

| バケット名 | 用途 | アクセス |
|---|---|---|
| `architecture-refs` | 建築参照モデル JSON | プロジェクト単位で読み書き |
| `presets` | プリセットデータ | 全ユーザー読み取り可 |

**環境構成**

| 環境 | Vercel | Supabase | 用途 |
|---|---|---|---|
| development | localhost:5173 | ローカル Supabase（supabase start） | 開発 |
| preview | PR プレビュー URL | Staging プロジェクト | レビュー・デモ |
| production | kuhl.vercel.app | Production プロジェクト | 本番・ユーザーテスト |

### 18.5 MCP によるインフラセットアップ（v2.4 追加）

Vercel と Supabase のセットアップ・運用は、それぞれの MCP（Model Context Protocol）サーバーを通じて Claude Code / claude.ai から直接実行する。これにより、ダッシュボード手動操作を最小化し、インフラ構築の再現性と速度を確保する。

**使用する MCP サーバー**

| MCP サーバー | 用途 | 接続先 |
|---|---|---|
| Vercel MCP | プロジェクト作成、デプロイ、環境変数設定、ドメイン管理 | claude.ai コネクタまたは Claude Code MCP 設定 |
| Supabase MCP | プロジェクト作成、DB スキーマ管理、Storage バケット作成、RLS 設定、Auth 設定 | claude.ai コネクタまたは Claude Code MCP 設定 |

**Vercel MCP で実行するタスク**

| # | タスク | MCP 操作 | 実行タイミング |
|---|---|---|---|
| V-01 | Vercel プロジェクト作成 | プロジェクト新規作成（フレームワーク: React / Vite） | MVP-0 初日 |
| V-02 | GitHub リポジトリ連携 | Git Integration 設定 | MVP-0 初日 |
| V-03 | 環境変数設定 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` を各環境（Production / Preview / Development）に設定 | MVP-0 Supabase 作成後 |
| V-04 | ビルド設定 | ビルドコマンド: `pnpm build`、出力ディレクトリ: `dist`、インストールコマンド: `pnpm install` | MVP-0 初日 |
| V-05 | プレビューデプロイ確認 | PR 作成時の自動プレビューが動作することを確認 | MVP-0 完了時 |
| V-06 | 本番デプロイ | main ブランチへのマージで自動デプロイされることを確認 | MVP-0 完了時 |
| V-07 | デプロイ状態確認 | デプロイログ・エラーの確認 | 各フェーズ |

**Supabase MCP で実行するタスク**

| # | タスク | MCP 操作 | 実行タイミング |
|---|---|---|---|
| S-01 | Supabase プロジェクト作成 | 新規プロジェクト作成（リージョン: ap-northeast-1） | MVP-0 初日 |
| S-02 | テーブル作成 | `projects` テーブル作成（セクション 18.4 の DDL） | MVP-0 初日 |
| S-03 | テーブル作成 | `project_data` テーブル作成（セクション 18.4 の DDL） | MVP-0 初日 |
| S-04 | RLS ポリシー設定 | `projects`, `project_data` の RLS 有効化とポリシー作成 | MVP-0 初日 |
| S-05 | Storage バケット作成 | `architecture-refs` バケット（private）、`presets` バケット（public read） | MVP-0 初日 |
| S-06 | Auth 設定 | 匿名認証（anonymous sign-in）を有効化 | MVP-0 初日 |
| S-07 | サンプルデータシード | プリセット JSON を Storage にアップロード | MVP-0 データ準備時 |
| S-08 | DB マイグレーション | スキーマ変更時に SQL マイグレーションを実行 | 各フェーズ |
| S-09 | 接続情報取得 | Project URL / anon key を取得し Vercel 環境変数に設定 | MVP-0 S-01 直後 |

**MVP-0 セットアップの実行順序**

```
1. [Supabase MCP] S-01: プロジェクト作成
2. [Supabase MCP] S-09: 接続情報取得（URL / anon key）
3. [Vercel MCP]   V-01: プロジェクト作成
4. [Vercel MCP]   V-02: GitHub リポジトリ連携
5. [Vercel MCP]   V-03: 環境変数設定（S-09 の値を使用）
6. [Vercel MCP]   V-04: ビルド設定
7. [Supabase MCP] S-02〜S-04: テーブル・RLS 作成
8. [Supabase MCP] S-05: Storage バケット作成
9. [Supabase MCP] S-06: Auth 設定
10. [Vercel MCP]   V-06: 初回デプロイ確認
11. [Supabase MCP] S-07: サンプルデータシード
12. [Vercel MCP]   V-05: プレビューデプロイ確認
```

**継続的な運用での MCP 活用**

| シーン | 使用 MCP | 操作 |
|---|---|---|
| DB スキーマ変更 | Supabase MCP | SQL マイグレーション実行 → アプリ側 migration runner 更新 |
| 新しい環境変数の追加 | Vercel MCP | 全環境に環境変数追加 |
| デプロイ障害の調査 | Vercel MCP | デプロイログ確認、ロールバック |
| Storage のデータ確認 | Supabase MCP | バケット内ファイル一覧・内容確認 |
| RLS ポリシーの変更 | Supabase MCP | ポリシー更新 |
| ユーザーテスト前のデータリセット | Supabase MCP | テストデータの削除・プリセットの再シード |

**Claude Code での MCP 設定例**

```json
// .mcp.json（プロジェクトルート）
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "supabase-mcp-server", "--read-only=false"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

Vercel MCP は claude.ai のコネクタとして接続する。Claude Code からは Vercel CLI（`vercel` コマンド）を併用する。

---

## 19. リスクと対応

| # | リスク | 対応 |
|---|---|---|
| 1 | IFC 読込が重い | MVP では参照メッシュ読込を許容し、IFC は後追いで差し替え可能にする |
| 2 | 機器選定マスターが未整備 | ローカル JSON ベースの暫定マスターを使う |
| 3 | 圧損計算の正確性で議論が長引く | MVP は概算用途と明記し、係数テーブル・前提条件を画面上に表示する。受入基準で手計算との ±15% 一致を検証する |
| 4 | ワンパスが長くなり UI が複雑化する | フェーズ UI で段階的に操作させ、各フェーズで必要ツールだけ出す |
| 5 | 外皮条件の自動検出が建築参照データの品質に依存する（v2 追加） | 自動検出は補助とし、手動入力を常にフォールバックとして残す。自動検出精度は MVP では任意扱い |
| 6 | ゾーングルーピング UI の操作感が複雑になる（v2 追加） | 最初は「ゾーン選択 → 系統に追加」の単純操作に限定し、ドラッグ&ドロップは後続で検討 |
| 7 | MVP フェーズ中のスキーマ頻繁変更で保存データが壊れる（v2 追加） | migration runner を MVP-0 で導入し、スキーマ変更ごとに migration を追加する運用とする |
| 8 | Supabase の通信遅延やダウンタイムで操作が中断する（v2.3 追加） | エディタ操作はローカルステートで継続可能にし、保存のみオンライン必須とする。Supabase のステータスページを監視する |
| 9 | Supabase 無料枠の容量上限に達する（v2.3 追加） | MVP 期間のデータ量を事前見積もりする（100 プロジェクト × 1MB = 100MB 程度で余裕あり）。超過時は Pro プランへ移行 |

---

## 20. サンプルデータセット仕様（v2.1 追加）

MVP のワンパスを実際に動かすには「建築参照モデル」と「空調機器カタログデータ」の 2 つが必要である。本章ではこれらの入手方針、自作方針、JSON スキーマを定義する。

### 20.1 方針

MVP では外部データへの依存を排除し、全サンプルデータを自作 JSON として管理する。理由は以下の通り。

- IFC フル読込は MVP 対象外であり、建築参照は簡易 JSON で十分成立する
- メーカーカタログ正式連携は後続フェーズであり、暫定マスターで十分成立する
- 外部依存がないことで、開発環境の立ち上げとテスト実行が即座に可能になる
- 全データが Git リポジトリ内で管理でき、再現性が担保される

### 20.2 建築参照モデル

#### 入手可能な外部ソース（参考）

- buildingSMART International の IFC テストファイル群（GitHub 上の IFC4x3 / IFC4 サンプル）
- Open IFC Model Repository の公開モデル

ただし、これらは海外建築が主であり、日本の典型的な事務所ビル平面（整形グリッド、ペリメータ/インテリアが明確、天井高 2.7m 前後）とは異なる場合が多い。

#### MVP 方針: 自作 JSON モデル

建築参照モデルを JSON で自作し、`ArchitectureRefNode` に直接マッピングする。

**サンプル建築の想定仕様**

| 項目 | 値 |
|---|---|
| 用途 | 事務所ビル基準階 |
| 平面寸法 | 30m × 20m |
| 階高 | 4.0m |
| 天井高 | 2.7m |
| 柱スパン | 6m × 7m（柱 8 本） |
| 外壁 | 4 面（N / E / S / W） |
| 南面 | ガラスカーテンウォール（ガラス面積比 0.7） |
| 東・西面 | 窓付き壁（ガラス面積比 0.3） |
| 北面 | 窓付き壁（ガラス面積比 0.2） |
| コア | 建物中央に EV・階段・トイレ（10m × 6m） |

**JSON スキーマ: `sample-architecture.json`**

```json
{
  "schemaVersion": "1.0.0",
  "buildingName": "サンプル事務所ビル",
  "levels": [
    {
      "levelId": "level-3f",
      "levelName": "3F（基準階）",
      "elevation": 8.0,
      "floorToFloor": 4.0,
      "ceilingHeight": 2.7,
      "outline": {
        "type": "rectangle",
        "origin": [0, 0],
        "width": 30.0,
        "depth": 20.0
      },
      "columns": [
        { "id": "col-1", "position": [0, 0], "section": [0.6, 0.6] },
        { "id": "col-2", "position": [6, 0], "section": [0.6, 0.6] }
      ],
      "walls": [
        {
          "id": "wall-s",
          "orientation": "S",
          "start": [0, 0],
          "end": [30, 0],
          "height": 4.0,
          "thickness": 0.15,
          "wallType": "curtain_wall",
          "glazingRatio": 0.7
        },
        {
          "id": "wall-n",
          "orientation": "N",
          "start": [0, 20],
          "end": [30, 20],
          "height": 4.0,
          "thickness": 0.2,
          "wallType": "exterior",
          "glazingRatio": 0.2
        }
      ],
      "core": {
        "origin": [10, 7],
        "width": 10.0,
        "depth": 6.0,
        "usage": "core"
      }
    }
  ]
}
```

外壁の `orientation` と `glazingRatio` を保持することで、ゾーニング時の `perimeterSegments` 半自動入力の検証データとしても機能する。

### 20.3 AHU カタログデータ

#### 入手可能な外部ソース（参考）

- ダイキン、日立、三菱電機などの技術資料・カタログ PDF
- 各社 BIM ライブラリ（Revit ファミリ、IFC パーツ）

ただし、メーカー正式連携は後続フェーズであり、MVP では暫定マスターで十分である。

#### MVP 方針: 自作 JSON カタログ

実務でよく使う風量レンジ（2,000〜30,000 m³/h）をカバーする 5 機種を定義する。

**JSON スキーマ: `catalog-ahu.json`**

```json
{
  "schemaVersion": "1.0.0",
  "catalogType": "ahu",
  "entries": [
    {
      "modelId": "AHU-S-2000",
      "modelName": "小型 AHU 2000",
      "manufacturer": "サンプルメーカー",
      "airflowRate": 2000,
      "airflowRateUnit": "m3/h",
      "coolingCapacity": 14.0,
      "coolingCapacityUnit": "kW",
      "heatingCapacity": 10.0,
      "heatingCapacityUnit": "kW",
      "maxStaticPressure": 400,
      "maxStaticPressureUnit": "Pa",
      "coilWaterFlowRate": 40,
      "coilWaterFlowRateUnit": "L/min",
      "coilWaterTempIn": 7,
      "coilWaterTempOut": 12,
      "dimensions": {
        "width": 1.2,
        "depth": 0.8,
        "height": 1.0
      },
      "dimensionsUnit": "m",
      "weight": 250,
      "weightUnit": "kg",
      "ports": [
        { "portId": "sa", "portType": "supply_air", "position": [1.2, 0.4, 0.7], "direction": [1, 0, 0], "neckSize": 400 },
        { "portId": "ra", "portType": "return_air", "position": [0, 0.4, 0.7], "direction": [-1, 0, 0], "neckSize": 400 },
        { "portId": "oa", "portType": "outdoor_air", "position": [0.6, 0.8, 0.7], "direction": [0, 1, 0], "neckSize": 300 },
        { "portId": "cws", "portType": "chilled_water_supply", "position": [0.3, 0, 0.3], "direction": [0, -1, 0], "nominalSize": "40A" },
        { "portId": "cwr", "portType": "chilled_water_return", "position": [0.9, 0, 0.3], "direction": [0, -1, 0], "nominalSize": "40A" }
      ]
    }
  ]
}
```

**MVP で必要な機種ラインナップ**

| モデル ID | 風量 (m³/h) | 冷房能力 (kW) | 暖房能力 (kW) | 機外静圧 (Pa) | 用途想定 |
|---|---|---|---|---|---|
| AHU-S-2000 | 2,000 | 14 | 10 | 400 | 小会議室・受付 |
| AHU-M-5000 | 5,000 | 35 | 25 | 500 | 中規模事務室 |
| AHU-M-10000 | 10,000 | 70 | 50 | 600 | 大規模事務室 |
| AHU-L-20000 | 20,000 | 140 | 100 | 700 | フロア一括 |
| AHU-L-30000 | 30,000 | 210 | 150 | 800 | 大空間・ホール |

### 20.4 制気口カタログデータ

天井吹出アネモスタット型の代表サイズを 6 種定義する。

**JSON スキーマ: `catalog-diffuser.json`**

```json
{
  "schemaVersion": "1.0.0",
  "catalogType": "diffuser",
  "entries": [
    {
      "modelId": "ANEMO-250",
      "modelName": "天井アネモ φ250",
      "subType": "anemostat",
      "neckDiameter": 250,
      "neckDiameterUnit": "mm",
      "ratedAirflow": 300,
      "ratedAirflowUnit": "m3/h",
      "airflowRange": { "min": 150, "max": 450 },
      "throwDistance": 2.5,
      "throwDistanceUnit": "m",
      "noiseLevel": 30,
      "noiseLevelUnit": "dB(A)",
      "pressureDrop": 15,
      "pressureDropUnit": "Pa",
      "faceSize": { "width": 360, "height": 360 },
      "faceSizeUnit": "mm"
    }
  ]
}
```

**MVP で必要なサイズラインナップ**

| モデル ID | ネック径 (mm) | 定格風量 (m³/h) | 風量範囲 (m³/h) | 到達距離 (m) |
|---|---|---|---|---|
| ANEMO-250 | 250 | 300 | 150〜450 | 2.5 |
| ANEMO-300 | 300 | 500 | 250〜700 | 3.0 |
| ANEMO-350 | 350 | 700 | 400〜1,000 | 3.5 |
| ANEMO-400 | 400 | 1,000 | 600〜1,400 | 4.0 |
| ANEMO-500 | 500 | 1,500 | 900〜2,100 | 5.0 |
| ANEMO-600 | 600 | 2,000 | 1,200〜2,800 | 6.0 |

### 20.5 ダクト標準サイズ表

JIS 規格に準じた矩形ダクトの標準寸法一覧を JSON で保持する。

**JSON スキーマ: `standard-duct-sizes.json`**

```json
{
  "schemaVersion": "1.0.0",
  "shape": "rectangular",
  "unit": "mm",
  "standardWidths": [200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1500, 1600, 1800, 2000],
  "standardHeights": [200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200],
  "aspectRatioLimit": 4.0,
  "frictionCoefficients": {
    "galvanized": {
      "roughness": 0.15,
      "roughnessUnit": "mm",
      "description": "亜鉛鉄板製ダクト"
    },
    "flexible": {
      "roughness": 3.0,
      "roughnessUnit": "mm",
      "description": "フレキシブルダクト（鋼板比約 4 倍の摩擦）"
    }
  },
  "recommendedVelocity": {
    "main": { "min": 6.0, "max": 8.0, "unit": "m/s", "description": "幹線ダクト" },
    "branch": { "min": 3.0, "max": 5.0, "unit": "m/s", "description": "枝ダクト" }
  },
  "fittingLossCoefficients": {
    "elbow_90": 0.3,
    "elbow_45": 0.15,
    "tee_branch": 0.5,
    "tee_main": 0.1,
    "reducer": 0.05,
    "damper": 0.2,
    "description": "局部損失係数（動圧ベース）"
  }
}
```

### 20.6 配管標準口径表

SGP / STPG の標準口径と流速制限を JSON で保持する。

**JSON スキーマ: `standard-pipe-sizes.json`**

```json
{
  "schemaVersion": "1.0.0",
  "pipeType": "SGP",
  "unit": "mm",
  "sizes": [
    { "nominal": "25A", "outerDiameter": 34.0, "innerDiameter": 27.6, "wallThickness": 3.2 },
    { "nominal": "32A", "outerDiameter": 42.7, "innerDiameter": 35.7, "wallThickness": 3.5 },
    { "nominal": "40A", "outerDiameter": 48.6, "innerDiameter": 41.6, "wallThickness": 3.5 },
    { "nominal": "50A", "outerDiameter": 60.5, "innerDiameter": 52.9, "wallThickness": 3.8 },
    { "nominal": "65A", "outerDiameter": 76.3, "innerDiameter": 67.9, "wallThickness": 4.2 },
    { "nominal": "80A", "outerDiameter": 89.1, "innerDiameter": 80.1, "wallThickness": 4.5 },
    { "nominal": "100A", "outerDiameter": 114.3, "innerDiameter": 105.3, "wallThickness": 4.5 },
    { "nominal": "125A", "outerDiameter": 139.8, "innerDiameter": 130.8, "wallThickness": 4.5 },
    { "nominal": "150A", "outerDiameter": 165.2, "innerDiameter": 155.2, "wallThickness": 5.0 }
  ],
  "recommendedVelocity": {
    "chilledWater": { "min": 0.5, "max": 2.0, "unit": "m/s" }
  },
  "frictionCalculation": {
    "method": "equivalent_length",
    "fittingFactors": {
      "elbow_90": 30,
      "tee": 60,
      "valve_gate": 5,
      "valve_globe": 300,
      "description": "等価長さ（口径倍数）"
    }
  }
}
```

### 20.7 3D 表示用機器形状

MVP では機器の 3D モデルとして外部 BIM ライブラリ（Revit ファミリ、IFC パーツ）は使用せず、パラメトリックな簡易形状を自作する。

| ノード | 形状 | パラメータ |
|---|---|---|
| AHU | 直方体 + ポート円筒 | カタログの dimensions + ports から生成 |
| 制気口 | 薄い正方形 + ネック円筒 | faceSize + neckDiameter から生成 |
| ダクト | 矩形断面の押出し | width × height × 区間長 |
| 配管 | 円筒の押出し | innerDiameter × 区間長 |

形状生成は `packages/viewer/src/renderers/` の各レンダラーがカタログデータのパラメータから動的に行う。外部 3D ファイルの読込は不要である。

メーカーの実機 3D モデル（Revit ファミリ、IFC パーツ）はダイキン・日立・三菱電機等が BIM ライブラリとして公開しているが、形式変換コストが高く MVP の検証には過剰であるため、後続フェーズでの対応とする。

### 20.8 負荷計算用原単位テーブル

ゾーン用途別の負荷原単位を JSON で保持する。

**JSON スキーマ: `load-unit-table.json`**

```json
{
  "schemaVersion": "1.0.0",
  "entries": [
    {
      "usage": "office_general",
      "usageNameJa": "一般事務室",
      "coolingLoadPerArea": 150,
      "heatingLoadPerArea": 80,
      "unit": "W/m2",
      "occupantDensity": 0.15,
      "occupantDensityUnit": "人/m2",
      "description": "内部発熱（照明・OA・人体）込み"
    },
    {
      "usage": "office_server",
      "usageNameJa": "サーバー室",
      "coolingLoadPerArea": 500,
      "heatingLoadPerArea": 0,
      "unit": "W/m2",
      "occupantDensity": 0.02,
      "occupantDensityUnit": "人/m2",
      "description": "IT 機器発熱主体"
    },
    {
      "usage": "conference",
      "usageNameJa": "会議室",
      "coolingLoadPerArea": 200,
      "heatingLoadPerArea": 100,
      "unit": "W/m2",
      "occupantDensity": 0.5,
      "occupantDensityUnit": "人/m2",
      "description": "在室密度高"
    },
    {
      "usage": "reception",
      "usageNameJa": "受付・ロビー",
      "coolingLoadPerArea": 120,
      "heatingLoadPerArea": 90,
      "unit": "W/m2",
      "occupantDensity": 0.1,
      "occupantDensityUnit": "人/m2",
      "description": "外気流入考慮"
    },
    {
      "usage": "corridor",
      "usageNameJa": "廊下・通路",
      "coolingLoadPerArea": 60,
      "heatingLoadPerArea": 40,
      "unit": "W/m2",
      "occupantDensity": 0.0,
      "occupantDensityUnit": "人/m2",
      "description": "非空調またはスポット"
    }
  ]
}
```

### 20.9 サンプルデータセットのファイル構成

全サンプルデータは `packages/core/src/data/` 配下に配置する。

```
packages/core/src/data/
├── sample-architecture.json       # 建築参照モデル
├── catalog-ahu.json               # AHU カタログ
├── catalog-diffuser.json          # 制気口カタログ
├── standard-duct-sizes.json       # ダクト標準サイズ表
├── standard-pipe-sizes.json       # 配管標準口径表
├── load-unit-table.json           # 負荷原単位テーブル
└── README.md                      # データ仕様と出典の説明
```

---

## 21. デモ実施仕様（v2.2 追加）

本章は、MVP のワンパスを設備設計者に実演し、実務ユーザーテストを行うための具体仕様を定義する。

### 21.1 デモの目的とゴール

**対象者**: 空調設備設計者（実務経験 3 年以上を想定）

**デモの目的**: 設備設計者が本ツールで「負荷→系統構成→機器→ルート→計算確認」の一連の流れを途切れずに実行できるか、また計算結果が実務感覚と合うかを検証する。

**ゴール判定基準**

| # | 判定項目 | 合格条件 |
|---|---|---|
| G-01 | 操作完走 | 設計者がワンパス全工程を 30 分以内に完走できる（初見、操作説明あり） |
| G-02 | 計算妥当性 | 設計者が計算結果を見て「概算としてこの数字は使える」と判断する |
| G-03 | 流れの連続性 | 設計者が「途中で別ツールに切り替えたいと思わなかった」と評価する |
| G-04 | 再利用意思 | 設計者が「次の案件の初期検討でも使いたい」と回答する |
| G-05 | 致命的操作障害なし | ワンパス中にエディタがクラッシュしない、データが消えない |

**収集するフィードバック**

- 各フェーズでの操作迷い・手戻りの箇所と回数
- 計算結果に対する信頼度（5 段階評価）
- 既存ワークフロー（Excel + CAD）との比較感想
- 追加で欲しい機能のリクエスト（優先順位付き）

### 21.2 デモシナリオ

デモはサンプル建築（セクション 20.2）上で、以下の具体ケースを実行する。

**案件概要: 事務所ビル 3 階基準階の空調基本設計**

- 建物: 30m × 20m、柱スパン 6m × 7m、天井高 2.7m
- 南面: ガラスカーテンウォール（ガラス面積比 0.7）
- 北面: 窓付き壁（ガラス面積比 0.2）
- 東・西面: 窓付き壁（ガラス面積比 0.3）
- コア: 中央 10m × 6m（EV・階段・トイレ）

**ゾーン構成（3 ゾーン）**

| ゾーン ID | 名称 | 用途 | 面積 | ペリメータ | 主な外壁方位 |
|---|---|---|---|---|---|
| Z-01 | 南側事務室 | office_general | 120 m² | あり | S（ガラス 0.7）、E（ガラス 0.3） |
| Z-02 | 北側事務室 | office_general | 180 m² | あり | N（ガラス 0.2）、W（ガラス 0.3） |
| Z-03 | 会議室 | conference | 40 m² | あり | E（ガラス 0.3） |

**期待される負荷計算結果（概算）**

| ゾーン | 冷房負荷 | 暖房負荷 | 必要風量（ΔT=10℃） |
|---|---|---|---|
| Z-01 | 約 25 kW（内部 18 + 外皮 7） | 約 12 kW | 約 7,500 m³/h |
| Z-02 | 約 30 kW（内部 27 + 外皮 3） | 約 18 kW | 約 9,000 m³/h |
| Z-03 | 約 10 kW（内部 8 + 外皮 2） | 約 5 kW | 約 3,000 m³/h |
| 合計 | 約 65 kW | 約 35 kW | 約 19,500 m³/h |

**系統構成**

- Z-01 + Z-02 + Z-03 → 1 系統にグルーピング → AHU-L-20000（風量 20,000 m³/h、冷房能力 140 kW）を採用

**制気口配置**

| ゾーン | 制気口 | 型式 | 個数 | 個別風量 |
|---|---|---|---|---|
| Z-01 | SA-01〜SA-03 | ANEMO-400 | 3 | 2,500 m³/h |
| Z-02 | SA-04〜SA-07 | ANEMO-400 | 4 | 2,250 m³/h |
| Z-03 | SA-08〜SA-09 | ANEMO-350 | 2 | 1,500 m³/h |

**ダクトルーティング**

- AHU → 幹線（W600×H400、19,500 m³/h）→ T 分岐
- 分岐 1 → Z-01 枝線（W450×H300）→ SA-01、SA-02、SA-03
- 分岐 2 → Z-02 枝線（W500×H350）→ SA-04〜SA-07
- 分岐 3 → Z-03 枝線（W350×H250）→ SA-08、SA-09
- SA 手前にフレキダクト 1m

**配管ルーティング**

- AHU 冷水コイル → 冷水供給配管（65A）→ ヘッダーまたは直線接続
- AHU 冷水コイル → 冷水還水配管（65A）

### 21.3 デモ操作ステップ

デモは以下の 18 ステップで実施する。各ステップに想定所要時間を付記する。

| # | フェーズ | 操作 | 期待結果 | 時間 |
|---|---|---|---|---|
| 1 | — | プロジェクト新規作成 | 空のプロジェクトが開く | 0:30 |
| 2 | — | サンプル建築参照 JSON を読込 | フロア平面が表示される | 0:30 |
| 3 | Zone | Z-01 南側事務室のゾーン境界を描画 | ゾーンが青色で表示、面積 120 m² が自動算出 | 1:00 |
| 4 | Zone | Z-01 の外皮条件を入力（S 面ガラス 0.7、E 面ガラス 0.3） | perimeterSegments が右パネルに表示 | 1:00 |
| 5 | Zone | Z-02、Z-03 も同様に作成 | 3 ゾーンが色分け表示される | 3:00 |
| 6 | Zone | 負荷計算を実行 | 各ゾーンに冷房/暖房負荷と風量が表示される | 0:30 |
| 7 | Zone | Z-01 の負荷内訳を確認 | 右パネルに内部負荷・外皮負荷（方位別）の内訳が見える | 0:30 |
| 8 | Equip | Z-01 + Z-02 + Z-03 を 1 系統にグルーピング | 合算負荷 65 kW、合算風量 19,500 m³/h が表示 | 1:00 |
| 9 | Equip | 機器選定パネルを開く | AHU-L-20000 が推奨候補として表示 | 0:30 |
| 10 | Equip | AHU-L-20000 を採用し配置 | AHU がビューポートに表示、ポートが見える | 1:00 |
| 11 | Equip | 制気口 SA-01〜SA-09 を各ゾーンに配置 | 9 個の制気口が配置され、各風量が表示 | 3:00 |
| 12 | Route | AHU 給気ポートから幹線ダクトを引く | ダクトが描画される | 1:00 |
| 13 | Route | T 分岐を打ち、各ゾーンへ枝線を引く | 分岐ダクトが描画される | 3:00 |
| 14 | Route | SA 手前にフレキダクト区間を設定 | ductMaterial が flexible に変わる | 1:00 |
| 15 | Route | 冷水配管を AHU から引く | 配管 2 本が描画される | 2:00 |
| 16 | Calc | 再計算を実行 | 各ダクト区間に風量・寸法・圧損が出る。配管に口径・圧損が出る | 0:30 |
| 17 | Calc | バリデーション実行 | 警告一覧が表示される（理想的には警告ゼロ） | 0:30 |
| 18 | — | プロジェクトを保存 | JSON ファイルが保存される | 0:30 |
| | | **合計** | | **約 21 分** |

残り 9 分は操作の手戻り・確認・質疑のバッファとする。30 分以内に完走が目標。

### 21.4 デモ用プリセットデータ

デモ時間の短縮と、フェーズ別の部分デモを可能にするため、以下のプリセット JSON を用意する。

| プリセット ID | 名称 | 状態 | 用途 |
|---|---|---|---|
| preset-00-empty | 空プロジェクト | 建築参照のみ読込済み | フルデモ開始点 |
| preset-01-zones | ゾーン完了 | 3 ゾーン作成済み、負荷計算済み | Equip フェーズからのデモ |
| preset-02-equip | 機器配置完了 | 系統グルーピング済み、AHU + 制気口配置済み | Route フェーズからのデモ |
| preset-03-route | ルーティング完了 | ダクト・配管接続済み、計算未実施 | Calc フェーズからのデモ |
| preset-04-complete | ワンパス完了 | 全計算・バリデーション済み | 結果確認・保存/再読込のデモ |

各プリセットは `packages/core/src/data/presets/` に配置する。

```
packages/core/src/data/presets/
├── preset-00-empty.json
├── preset-01-zones.json
├── preset-02-equip.json
├── preset-03-route.json
├── preset-04-complete.json
└── README.md
```

プリセットの読込は、上部バーの「プロジェクトを開く」から選択できるようにする。

### 21.5 画面表示仕様

デモで「何が見えるべきか」を定義する。

**ゾーン表示**

| 状態 | 塗りつぶし色 | 枠線 | ラベル |
|---|---|---|---|
| 作成直後（負荷未計算） | グレー半透明（#9E9E9E、opacity 0.2） | 白 1px | ゾーン名 |
| 負荷計算済み | 用途別色の半透明（下記参照、opacity 0.3） | 白 1px | ゾーン名 + 冷房負荷 (kW) |
| 系統グルーピング済み | 用途別色の半透明 + 系統カラー枠 | 系統カラー 2px | ゾーン名 + 冷房負荷 + 風量 |
| 警告あり | 用途別色 + 赤バッジ | 赤 2px | ゾーン名 + 警告アイコン |

**用途別ゾーンカラー**

| 用途 | カラーコード |
|---|---|
| office_general | #42A5F5（青） |
| conference | #FFA726（オレンジ） |
| reception | #66BB6A（緑） |
| office_server | #EF5350（赤） |
| corridor | #BDBDBD（グレー） |

**ダクト表示**

| 状態 | 線の太さ | 色 | ラベル |
|---|---|---|---|
| 接続済み・寸法未確定 | 2px | #78909C（グレー青） | 風量 (m³/h) |
| 接続済み・寸法確定 | 断面比例（幹線太、枝線細） | #1565C0（濃青） | 風量 + 寸法 (W×H) |
| フレキダクト | 断面比例 + 波線 | #1565C0 | 風量 + 寸法 + 「フレキ」 |
| 風速超過 | 断面比例 | #E53935（赤） | 風量 + 寸法 + 風速 |
| 未接続 | 2px + 点線 | #E53935（赤） | 「未接続」 |

**配管表示**

| 状態 | 線の太さ | 色 |
|---|---|---|
| 冷水供給 | 口径比例 | #0288D1（水色） |
| 冷水還水 | 口径比例 | #01579B（紺） |
| 未接続 | 2px + 点線 | #E53935（赤） |

**機器表示**

| ノード | 3D 形状 | 色 | ラベル |
|---|---|---|---|
| AHU | 直方体 + ポート円筒 | #37474F（ダークグレー）、ポート: 系統カラー | 機種名 + 風量 |
| 制気口 | 正方形 + ネック | #78909C（グレー） | 型式 + 風量 |

**右パネル表示フォーマット**

ノード選択時に右パネルに表示する情報の構成:

```
── 基本情報 ──
ノード名:     Z-01 南側事務室
種別:         HvacZone
用途:         一般事務室
面積:         120.0 m²
天井高:       2.7 m

── 外皮条件 ──
S面:  壁面積 10.8 m², ガラス率 70%
E面:  壁面積 8.1 m², ガラス率 30%

── 負荷計算結果 ──
冷房負荷:     25.2 kW
  内部負荷:   18.0 kW (150 W/m² × 120 m²)
  外皮負荷:   7.2 kW (S面: 5.4 + E面: 1.8)
暖房負荷:     12.1 kW
必要風量:     7,560 m³/h (ΔT=10℃)

── 所属系統 ──
系統:         AHU-SYS-01
AHU:          AHU-L-20000
```

**警告バッジ**

- ノード右上に赤丸 + 白文字で警告数を表示
- ホバーで警告内容をツールチップ表示
- 左パネル警告一覧では、警告をクリックすると該当ノードを選択・ズームする

### 21.6 操作フィードバック仕様

デモで「動いている感」を確保するために必要な即時フィードバック:

| 操作 | フィードバック | タイミング |
|---|---|---|
| ゾーン境界の描画中 | 面積をリアルタイム表示（描画中のポリゴン内に薄文字） | 描画中即時 |
| ゾーン作成確定 | ゾーンがアニメーションで塗りつぶされる + 面積が確定表示 | 確定時 0.3 秒 |
| 負荷計算実行 | ゾーンカラーがグレー → 用途別色にフェードイン + 負荷値がゾーン上に表示 | 計算完了時 0.5 秒 |
| ゾーングルーピング | ゾーン枠線が系統カラーに変化 + 合算値が左パネルの系統ツリーに表示 | 操作時即時 |
| 機器候補提示 | カタログパネルに候補リストがハイライト表示 + 推奨機種に「推奨」バッジ | 操作時即時 |
| 機器配置 | 機器がビューポートに表示 + ポート位置が丸で示される | 配置時即時 |
| 制気口配置 | 制気口がゾーン上に表示 + 風量ラベル | 配置時即時 |
| ダクト接続成立 | ダクトの色がグレー → 青に変化 + 接続音（任意） | 接続時 0.3 秒 |
| ダクト分岐作成 | 分岐点に丸ノード表示 + 下流への風量が自動分配されラベル更新 | 接続時即時 |
| 風量自動配分完了 | 全ダクト区間の風量ラベルが一斉更新 | 配分計算後 0.5 秒 |
| 寸法選定完了 | ダクトの太さが断面に比例して変化 + 寸法ラベル追加 | 計算後 0.5 秒 |
| 圧損計算完了 | 最遠経路がハイライト + 右パネルに圧損サマリ表示 | 計算後 0.5 秒 |
| 配管接続成立 | 配管が水色/紺で表示 | 接続時 0.3 秒 |
| 警告検出 | 該当ノードに赤バッジ出現 + 左パネル警告一覧に追加 | バリデーション後即時 |
| 警告解消 | 赤バッジ消滅 + 左パネルから警告が消える | 再計算後即時 |
| 保存完了 | 上部バーに「保存しました」トースト通知 | 保存後 0.3 秒 |

### 21.7 デモ環境仕様

**実行環境**

| 項目 | 仕様 |
|---|---|
| 実行形態 | ブラウザアプリケーション（SPA） |
| 対象ブラウザ | Chrome 最新版（WebGPU 対応必須） |
| デモ URL | `https://kuhl.vercel.app`（本番）または PR プレビュー URL |
| ローカル URL | `http://localhost:5173`（開発時） |
| フロントエンド | Vercel にデプロイ |
| バックエンド | Supabase（PostgreSQL + Storage + Auth） |
| データ保存 | Supabase PostgreSQL（プロジェクトデータ）+ Storage（建築参照・プリセット） |

**セットアップ手順（ローカル開発）**

```bash
# 1. リポジトリのクローン
git clone https://github.com/<org>/kuhl.git
cd kuhl

# 2. 依存関係のインストール
pnpm install

# 3. Supabase ローカル環境の起動
npx supabase start

# 4. 環境変数の設定
cp .env.example .env.local
# .env.local に Supabase URL / anon key を設定

# 5. 開発サーバーの起動
pnpm dev

# 6. ブラウザで開く
open http://localhost:5173
```

**セットアップ手順（デモ用 Vercel 環境）**

```bash
# Vercel にデプロイ済みの場合、URL を共有するだけでデモ可能
# プレビュー環境: PR を作成すると自動でプレビュー URL が生成される
# 本番環境: main ブランチへのマージで自動デプロイ
```

**必要な依存関係**

- Node.js >= 20
- pnpm >= 9
- Supabase CLI（ローカル開発時）
- Chrome（WebGPU 対応版）
- Pascal Editor のフォーク元リポジトリへのアクセス権

**デモ実施時のチェックリスト**

- [ ] Vercel デプロイが正常に完了している（またはローカルサーバーが起動している）
- [ ] Supabase プロジェクトが稼働している（ダッシュボードで確認）
- [ ] Chrome で WebGPU が有効（`chrome://flags` → WebGPU → Enabled）
- [ ] サンプルデータセット（セクション 20.9）が Supabase Storage にアップロード済み
- [ ] プリセットデータ（セクション 21.4）が Supabase Storage / DB にシード済み
- [ ] 画面解像度 1920×1080 以上（デモ表示用）
- [ ] ビューポートが 3D 表示で正常にレンダリングされている
- [ ] ネットワーク接続が安定している（Supabase との通信に必要）

### 21.8 デモ実施プロトコル

設備設計者向けユーザーテストの実施手順。

**事前準備（デモ前日まで）**

1. テスト参加者を 3〜5 名アサインする（空調設計経験 3 年以上）
2. 各参加者に「事務所ビル 3 階基準階の空調基本設計を初期検討する」というタスク概要のみ伝える
3. デモ環境の動作確認を完了する

**デモ当日の流れ（1 名あたり 60 分）**

| 時間 | 内容 |
|---|---|
| 0:00〜0:05 | ツール概要説明（目的、画面構成、フェーズの考え方） |
| 0:05〜0:10 | 操作説明（ゾーン描画、機器配置、ダクト接続の基本操作） |
| 0:10〜0:40 | ワンパス実施（参加者が操作。進行者は操作補助のみ、誘導はしない） |
| 0:40〜0:50 | 結果確認・質疑（計算結果の妥当性、操作感の感想） |
| 0:50〜0:60 | フィードバック収集（構造化アンケート + 自由記述） |

**フィードバックアンケート項目**

| # | 質問 | 回答形式 |
|---|---|---|
| F-01 | ワンパスを完走できたか | はい / いいえ（中断箇所を記録） |
| F-02 | 負荷計算結果は概算として信頼できるか | 5 段階（1: 全く使えない 〜 5: 実務で使える） |
| F-03 | ダクト寸法・圧損は概算として信頼できるか | 5 段階 |
| F-04 | 操作の流れは直感的だったか | 5 段階 |
| F-05 | 既存ワークフロー（Excel + CAD）と比べて効率的か | 5 段階 |
| F-06 | 次の案件の初期検討でも使いたいか | 5 段階 |
| F-07 | 最も改善すべき点は何か | 自由記述 |
| F-08 | 追加で欲しい機能は何か（優先順位付き） | 自由記述 |

---

## 22. 開発スコープ分解（MVP）

### Phase MVP-0: 基盤整備

- Pascal Editor フォーク
- Supabase MCP でプロジェクト作成・テーブル・RLS・Storage・Auth セットアップ（v2.4 更新: セクション 18.5 の S-01〜S-06 を実行）
- Vercel MCP でプロジェクト作成・GitHub 連携・環境変数・ビルド設定（v2.4 更新: セクション 18.5 の V-01〜V-04 を実行）
- 初回デプロイ確認（v2.4 更新: V-05, V-06）
- HVAC ノードスキーマ導入（SystemNode を含む）
- HVAC 用 phase 定義
- スキーマバージョニングと migration runner 導入（v2 追加）
- Supabase Migration の初期設定（v2.3 追加）
- サンプルデータセット作成（v2.1 追加: 建築参照 JSON、AHU カタログ、制気口カタログ、ダクトサイズ表、配管口径表、原単位テーブル）
- Supabase MCP でサンプルデータを Storage にシード（v2.4 更新: S-07）
- 保存/読込確認（Supabase 経由）

### Phase MVP-1: Zone + Load

- ArchitectureRef 表示（外壁メタデータ抽出を含む）
- ZoneDrawTool
- PerimeterEditTool（v2 追加）
- HvacZoneNode 編集（perimeterSegments、supplyAirTempDiff を含む）
- LoadCalcSystem（方位別外皮補正、原単位テーブル参照を含む）
- ゾーン一覧

### Phase MVP-2: Equip

- ZoneGroupingTool（v2 追加）
- SystemAggregation（v2 追加）
- AhuRenderer（カタログ dimensions からのパラメトリック形状生成）
- DiffuserRenderer（カタログ faceSize / neckDiameter からのパラメトリック形状生成）
- AhuPlaceTool
- DiffuserPlaceTool
- 簡易機器選定パネル（catalog-ahu.json / catalog-diffuser.json 参照）

### Phase MVP-3: Route + Calc

- DuctRouteTool
- AirflowDistribution（v2 追加: 風量自動配分）
- DuctSizing（standard-duct-sizes.json 参照）
- DuctPressureLoss（フレキ対応を含む。frictionCoefficients / fittingLossCoefficients 参照）
- PipeRouteTool
- PipeSizing / PipePressureLoss（standard-pipe-sizes.json 参照）

### Phase MVP-4: Validate + Review + Demo

- 警告一覧（v2 拡張: 系統未割当、風量乖離、配管未接続）
- 右パネル計算結果（表示フォーマットはセクション 21.5 に準拠）
- 操作フィードバック実装（セクション 21.6 に準拠）（v2.2 追加）
- 画面表示仕様の実装（ゾーンカラー、ダクト表示、警告バッジ）（v2.2 追加）
- 保存/再読込（migration 動作確認を含む）
- プリセットデータ 5 種の作成（セクション 21.4）（v2.2 追加）
- サンプル案件でワンパス実証（サンプルデータセットを使用）
- 手計算との妥当性検証（v2 追加）
- ユーザーテスト実施（セクション 21.8 に準拠）（v2.2 追加）

---

## 23. 受入基準

### 23.1 機能受入

- サンプル建築参照上でゾーンが 3 つ以上作れる
- サンプル建築参照の外壁メタデータからペリメータ条件が半自動入力される（v2.1 追加）
- ペリメータゾーンに方位別外壁面積・ガラス面積比を設定できる（v2 追加）
- 各ゾーンの負荷計算結果が表示される（外皮補正内訳を含む）
- 複数ゾーンを 1 つの AHU 系統にグルーピングできる（v2 追加）
- AHU カタログから候補が提示され、1 台配置できる（v2.1 追加: catalog-ahu.json 参照動作確認）
- 制気口を 3 つ以上配置できる
- AHU から全制気口へダクト接続できる
- ダクト分岐時に風量が自動配分される（v2 追加）
- 各ダクト区間に寸法・風量・圧損が出る
- フレキダクト区間を含む圧損計算が正しく動作する（v2 追加）
- AHU の冷温水配管接続ができ、口径と概算圧損が出る（v2 追加）
- 未接続ポートがあると警告される
- 系統未割当ゾーンがあると警告される（v2 追加）
- 保存/再読込後に同一結果が再現する
- スキーマバージョン不一致時に migration が実行される（v2 追加）

### 23.2 サンプルデータセット受入（v2.1 追加）

- 全サンプル JSON ファイルがスキーマバリデーションを通ること
- サンプル建築参照が ArchitectureRefNode として正常に読み込まれ表示されること
- AHU カタログから機器選定ロジックが候補を返すこと
- 制気口カタログからサイズ選択が動作すること
- ダクト標準サイズ表からスナップが動作すること
- 配管標準口径表から口径自動決定が動作すること
- 負荷原単位テーブルから用途別負荷計算が動作すること

### 23.3 計算妥当性受入（v2 追加）

- サンプル案件の手計算結果と、ツールの負荷計算結果が ±20% 以内で一致する
- ダクト圧損計算結果が、同条件での手計算と ±15% 以内で一致する
- 機器選定結果が、手動でカタログから選んだ場合と同一機種になる（同一マスターを使う前提）

### 23.4 業務受入

- 設備設計者が「負荷→系統構成→機器→ルート→計算確認」の流れを途中で別ツールに移らず実施できる
- レビュー時にゾーン・系統・結果の関係が追える

---

## 24. 将来拡張

MVP 後は以下の順で拡張する。

1. PAC / VRF 系追加
2. 分岐・複数系統強化
3. 配管詳細化（ドレン、冷媒、ヘッダー）
4. 同時使用率・ゾーン多様性係数の導入
5. 数量拾い
6. IFC 出力
7. カタログ連携
8. 帳票生成

---

## 25. 実装優先順位まとめ

### 今すぐ作るもの

- サンプルデータセット（建築参照、AHU カタログ、制気口カタログ、ダクトサイズ表、配管口径表、原単位テーブル）
- スキーマバージョニング / migration runner
- Zone（perimeterSegments、supplyAirTempDiff を含む）
- LoadCalc（方位別外皮補正を含む）
- SystemNode / ZoneGrouping / SystemAggregation
- Ahu / Diffuser 配置
- DuctRoute
- AirflowDistribution（風量自動配分）
- DuctSizing
- DuctPressureLoss（フレキ対応を含む）
- PipeRoute / PipeSizing / PipePressureLoss
- Validate（拡張警告を含む）
- Save / Load
- 画面表示仕様（ゾーンカラー、ダクト/配管表示、警告バッジ）
- 操作フィードバック（リアルタイム面積表示、風量自動配分ラベル更新、計算結果アニメーション）
- プリセットデータ 5 種
- デモシナリオ検証

### 後でよいもの

- IFC 出力
- 拾い
- 高度自動化
- 建築参照からの外壁面自動検出の精度向上

---

## 26. 結論

この MVP は、Pascal Editor を空調設計 BIM ツールへ転用する際の最小成立単位として、「1 フロア・1 系統・1 ワンパス」を成立させるための PRD 兼基本設計である。

v2 では空調設計エンジニアレビューを反映し、以下の実務上不可欠な要素を追加した。

- ペリメータ外皮条件の方位別入力と負荷補正
- 送風温度差の明示的パラメータ化
- 複数ゾーン → 1 AHU の系統構成（N:1 グルーピング）
- ダクト分岐時の風量自動配分
- フレキダクト区間の圧損対応
- 冷温水配管の必須化（最小実装）
- スキーマバージョニングと migration runner の初日導入
- 計算結果の妥当性検証を受入基準に追加

v2.1 では以下を追加した。

- サンプルデータセット仕様の定義（建築参照 JSON、AHU カタログ、制気口カタログ、ダクト標準サイズ表、配管標準口径表、負荷原単位テーブル）
- 全データを自作 JSON として Git 管理し、外部依存を排除する方針の明確化
- 3D 表示用機器形状のパラメトリック生成方針の定義
- サンプルデータセットの受入基準の追加

v2.2 では以下を追加した。

- 設備設計者向け実務ユーザーテストとしてのデモ実施仕様一式
- 具体的なデモシナリオ（3 ゾーン事務所ビル、AHU-L-20000、9 制気口、ダクト 3 分岐）
- フェーズ別プリセットデータ（5 段階の途中状態 JSON）
- 画面表示仕様（ゾーンカラー、ダクト/配管表示スタイル、警告バッジ、右パネルフォーマット）
- 操作フィードバック仕様（リアルタイム面積表示、風量自動配分ラベル更新、アニメーション）
- デモ環境仕様（ブラウザ SPA、セットアップ手順、チェックリスト）
- デモ実施プロトコル（60 分構成、フィードバックアンケート 8 項目）

v2.3 では以下を追加した。

- デプロイ基盤を Vercel（フロントエンド）+ Supabase（バックエンド）に決定
- 永続化を Supabase PostgreSQL + Storage に変更（JSON エクスポートも併用可）
- Supabase テーブル設計（projects / project_data）と RLS ポリシーの定義
- Supabase Auth（匿名認証）の導入
- 環境構成（development / preview / production）の定義
- デモ環境を Vercel プレビュー URL で実施可能に変更
- MVP-0 に Vercel / Supabase のセットアップタスクを追加

v2.4 では以下を追加した。

- Vercel MCP・Supabase MCP を用いた AI アシストインフラセットアップ手順の定義
- MCP 経由で実行するタスク一覧（Vercel 7 タスク、Supabase 9 タスク）
- MVP-0 セットアップの実行順序（12 ステップ）
- 継続的な運用での MCP 活用シーン（DB マイグレーション、環境変数追加、デプロイ障害調査、データリセット等）
- Claude Code での MCP 設定例（.mcp.json）

これにより、Pascal Editor 上で条件入力 → 負荷算定 → 系統構成 → 機器仮選定 → ルーティング → 計算確認までを、実務者が「使える」レベルで切れ目なく実行でき、Vercel の URL を共有するだけでデモ・ユーザーテストが実施可能になる。インフラ構築・運用も Claude Code / claude.ai から MCP 経由で直接実行でき、ダッシュボード手動操作を最小化する。

まずはこのワンパスを確実に成立させ、その後に拾い、IFC、外部連携、詳細設計支援を段階拡張する。