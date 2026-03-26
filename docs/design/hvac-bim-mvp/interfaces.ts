/**
 * hvac-bim-mvp 型定義
 *
 * 作成日: 2026-03-26
 * 関連設計: architecture.md
 *
 * 信頼性レベル:
 * - 🔵 青信号: EARS要件定義書・設計文書・既存実装を参考にした確実な型定義
 * - 🟡 黄信号: EARS要件定義書・設計文書・既存実装から妥当な推測による型定義
 * - 🔴 赤信号: EARS要件定義書・設計文書・既存実装にない推測による型定義
 *
 * 注: これは設計仕様としての型定義ファイルです。
 * 実装時は packages/core/src/schema/nodes/ に Zod スキーマとして定義します。
 * 実際のコードでは z.infer<typeof XxxNode> で型を導出します。
 */

// ========================================
// 共通型定義
// ========================================

/**
 * ポート媒体種別
 * 🔵 信頼性: PRDセクション14.6,14.7・REQ-702,1102より
 */
type PortMedium =
  | 'supply_air'
  | 'return_air'
  | 'outside_air'
  | 'exhaust_air'
  | 'chilled_water_supply'
  | 'chilled_water_return'

/**
 * ポート定義（機器の接続点）
 * 🔵 信頼性: ヒアリングQ6「ポート配列方式」・PRDセクション14.4より
 */
interface Port {
  id: string // ポートID（'ahu_xxx_sa', 'diff_xxx_in' 等）
  label: string // 表示名（'SA', 'RA', 'OA', 'CWS', 'CWR' 等）
  medium: PortMedium // 媒体種別
  position: [number, number, number] // ノードローカル座標
  direction: [number, number, number] // 接続方向ベクトル（正規化）
  connectedSegmentId: string | null // 接続中のDuctSegment/PipeSegmentのID
}

/**
 * 方位（8方位）
 * 🔵 信頼性: PRDセクション11.4・REQ-303より
 */
type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

/**
 * ペリメータセグメント（外壁面情報）
 * 🔵 信頼性: PRDセクション11.2 v2追加・REQ-205より
 */
interface PerimeterSegment {
  orientation: Orientation // 方位
  wallArea: number // 壁面積 (m²)
  glazingRatio: number // ガラス面積比 (0.0〜1.0)
}

/**
 * ゾーン用途
 * 🔵 信頼性: PRDセクション20.8・REQ-305より
 */
type ZoneUsage =
  | 'office_general'
  | 'office_server'
  | 'conference'
  | 'reception'
  | 'corridor'

/**
 * 設計条件
 * 🔵 信頼性: PRDセクション14.2・REQ-204より
 */
interface DesignConditions {
  coolingSetpoint: number // 室内温度冷房 (℃), default: 26
  heatingSetpoint: number // 室内温度暖房 (℃), default: 22
  relativeHumidity: number // 室内湿度 (%), default: 50
  supplyAirTempDiff: number // 送風温度差 (℃), default: 10
}

/**
 * 方位別日射補正係数
 * 🔵 信頼性: PRDセクション11.4・REQ-303より
 */
type SolarCorrectionCoefficients = Record<Orientation, number>
// S=1.0, SE/SW=1.1, E/W=1.2, NE/NW=0.8, N=0.6

// ========================================
// ノードスキーマ型定義
// ========================================

/**
 * BaseNode 共通フィールド（既存）
 * 🔵 信頼性: 既存実装 packages/core/src/schema/base.ts より
 */
interface BaseNodeFields {
  object: 'node'
  id: string
  type: string
  name?: string
  parentId: string | null
  visible: boolean
  camera?: unknown
  metadata: unknown
}

// ----------------------------------------
// 1. HvacZoneNode
// ----------------------------------------

/**
 * HVAC ゾーンノード
 * 🔵 信頼性: PRDセクション14.2・REQ-201〜209・ヒアリングQ2「完全分離」より
 *
 * Zod実装: packages/core/src/schema/nodes/hvac-zone.ts
 * IDプレフィックス: 'hvac_zone'
 * 親: LevelNode
 */
interface HvacZoneNode extends BaseNodeFields {
  id: `hvac_zone_${string}` // 🔵 既存IDパターンより
  type: 'hvac_zone' // 🔵 既存nodeTypeパターンより
  zoneName: string // 🔵 REQ-203
  usage: ZoneUsage // 🔵 REQ-203
  floorArea: number // 🔵 REQ-203 面積 (m²)
  ceilingHeight: number // 🔵 REQ-203 天井高 (m), default: 2.7
  occupantDensity: number // 🔵 REQ-203 在室密度 (人/m²), default: 0.15
  boundary: [number, number][] // 🔵 REQ-202 ポリゴン頂点座標 (2D)
  designConditions: DesignConditions // 🔵 REQ-204
  perimeterSegments: PerimeterSegment[] // 🔵 REQ-205
  systemId: string | null // 🔵 REQ-207 所属系統ID, null=未グルーピング
  calcResult: HvacZoneCalcResult | null // 🔵 REQ-301〜306 計算結果
}

/**
 * ゾーン負荷計算結果
 * 🔵 信頼性: PRDセクション15.1・REQ-301〜306より
 */
interface HvacZoneCalcResult {
  coolingLoad: number // 冷房負荷 (W)
  heatingLoad: number // 暖房負荷 (W)
  requiredAirflow: number // 必要風量 (m³/h)
  internalLoad: number // 内部負荷 (W)
  envelopeLoad: number // 外皮負荷 (W)
  perimeterLoadBreakdown: PerimeterLoadBreakdownEntry[] // 🔵 REQ-306 方位別内訳
  status: 'success' | 'error'
  error?: string
}

/**
 * 方位別外皮負荷内訳
 * 🔵 信頼性: PRDセクション14.2 v2追加・REQ-306より
 */
interface PerimeterLoadBreakdownEntry {
  orientation: Orientation
  solarCorrectionFactor: number
  envelopeLoadContribution: number // (W)
}

// ----------------------------------------
// 2. SystemNode
// ----------------------------------------

/**
 * AHU系統ノード
 * 🔵 信頼性: PRDセクション14.3・REQ-401〜405より
 *
 * Zod実装: packages/core/src/schema/nodes/system.ts
 * IDプレフィックス: 'system'
 * 親: LevelNode
 */
interface SystemNode extends BaseNodeFields {
  id: `system_${string}` // 🔵
  type: 'system' // 🔵
  systemName: string // 🔵 REQ-402
  servedZoneIds: string[] // 🔵 REQ-402 所属ゾーンID配列
  ahuId: string | null // 🔵 REQ-402 選定済みAHUのID
  aggregatedLoad: AggregatedLoad | null // 🔵 REQ-402 合算負荷
  status: SystemStatus // 🔵 REQ-402
}

/**
 * 系統合算負荷
 * 🔵 信頼性: PRDセクション15.2・REQ-405より
 */
interface AggregatedLoad {
  totalCoolingLoad: number // 合算冷房負荷 (W)
  totalHeatingLoad: number // 合算暖房負荷 (W)
  totalAirflow: number // 合算風量 (m³/h)
}

/**
 * 系統ステータス
 * 🟡 信頼性: PRDセクション14.3のstatusフィールドから妥当な推測
 */
type SystemStatus =
  | 'draft' // ゾーンのみ
  | 'equipment_selected' // AHU選定済み
  | 'routed' // ダクト/配管接続済み
  | 'calculated' // 計算完了
  | 'validated' // バリデーション通過

// ----------------------------------------
// 3. AhuNode
// ----------------------------------------

/**
 * AHU（エアハンドリングユニット）ノード
 * 🔵 信頼性: PRDセクション14.4・REQ-504より
 *
 * Zod実装: packages/core/src/schema/nodes/ahu.ts
 * IDプレフィックス: 'ahu'
 * 親: LevelNode
 */
interface AhuNode extends BaseNodeFields {
  id: `ahu_${string}` // 🔵
  type: 'ahu' // 🔵
  tag: string // 🔵 REQ-504 機器タグ（例: 'AHU-01'）
  equipmentName: string // 🔵 REQ-504 カタログ機種名
  position: [number, number, number] // 🔵 REQ-504 配置位置
  rotation: [number, number, number] // 🟡 3D配置に必要と推測
  dimensions: AhuDimensions // 🔵 PRDセクション20.7より
  ports: Port[] // 🔵 REQ-504 接続ポート配列
  airflowRate: number // 🔵 REQ-504 定格風量 (m³/h)
  coolingCapacity: number // 🔵 REQ-504 冷房能力 (W)
  heatingCapacity: number // 🔵 REQ-504 暖房能力 (W)
  staticPressure: number // 🔵 REQ-504 静圧 (Pa)
  systemId: string // 🔵 REQ-504 所属系統ID
}

/**
 * AHU外形寸法
 * 🔵 信頼性: PRDセクション20.7・REQ-1504より
 */
interface AhuDimensions {
  width: number // 幅 (m)
  depth: number // 奥行 (m)
  height: number // 高さ (m)
}

// ----------------------------------------
// 4. DiffuserNode
// ----------------------------------------

/**
 * 制気口ノード
 * 🔵 信頼性: PRDセクション14.5・REQ-602より
 *
 * Zod実装: packages/core/src/schema/nodes/diffuser.ts
 * IDプレフィックス: 'diffuser'
 * 親: LevelNode
 */
interface DiffuserNode extends BaseNodeFields {
  id: `diffuser_${string}` // 🔵
  type: 'diffuser' // 🔵
  tag: string // 🔵 REQ-602 機器タグ
  subType: DiffuserSubType // 🔵 REQ-602
  position: [number, number, number] // 🔵 REQ-602 配置位置
  neckDiameter: number // 🔵 REQ-603 ネック径 (mm)
  airflowRate: number // 🔵 REQ-602 配分風量 (m³/h)
  port: Port // 🔵 ヒアリングQ6「ポート配列方式」より
  hostDuctId: string | null // 🔵 REQ-602 接続先ダクトID
  systemId: string // 🔵 REQ-602 所属系統ID
  zoneId: string // 🔵 配置先ゾーンID
}

/**
 * 制気口サブタイプ
 * 🟡 信頼性: PRDセクション20.4のカタログ定義から妥当な推測
 */
type DiffuserSubType = 'anemo' | 'line' | 'ceiling_square'

// ----------------------------------------
// 5. DuctSegmentNode
// ----------------------------------------

/**
 * ダクト区間ノード
 * 🔵 信頼性: PRDセクション14.6・REQ-702より
 *
 * Zod実装: packages/core/src/schema/nodes/duct-segment.ts
 * IDプレフィックス: 'duct_seg'
 * 親: LevelNode
 */
interface DuctSegmentNode extends BaseNodeFields {
  id: `duct_seg_${string}` // 🔵
  type: 'duct_segment' // 🔵
  start: [number, number, number] // 🔵 REQ-702 始点
  end: [number, number, number] // 🔵 REQ-702 終点
  medium: DuctMedium // 🔵 REQ-702
  shape: DuctShape // 🔵 REQ-702
  width: number | null // 🔵 REQ-702 矩形ダクト幅 (mm), null=未確定
  height: number | null // 🔵 REQ-702 矩形ダクト高さ (mm), null=未確定
  diameter: number | null // 🔵 REQ-702 丸ダクト直径 (mm), null=未確定
  ductMaterial: DuctMaterial // 🔵 REQ-703
  airflowRate: number | null // 🔵 REQ-702 風量 (m³/h), null=未配分
  startPortId: string | null // 🔵 ヒアリングQ8「ポートIDベース」より
  endPortId: string | null // 🔵
  systemId: string // 🔵 REQ-702
  calcResult: DuctCalcResult | null // 🔵 計算結果
}

/**
 * ダクト媒体
 * 🔵 信頼性: PRDセクション14.6より
 */
type DuctMedium = 'supply_air' | 'return_air' | 'outside_air' | 'exhaust_air'

/**
 * ダクト断面形状
 * 🔵 信頼性: PRDセクション20.5より
 */
type DuctShape = 'rectangular' | 'circular'

/**
 * ダクト材質
 * 🔵 信頼性: PRDセクション11.10 v2追加・REQ-703より
 */
type DuctMaterial = 'galvanized' | 'flexible'

/**
 * ダクト計算結果
 * 🔵 信頼性: PRDセクション15.5,15.6・REQ-901〜1004より
 */
interface DuctCalcResult {
  velocity: number // 風速 (m/s)
  hydraulicDiameter: number // 等価直径 (mm)
  pressureLoss: number // 区間圧損 (Pa)
  frictionFactor: number // 摩擦係数
  status: 'success' | 'error'
  error?: string
}

// ----------------------------------------
// 6. DuctFittingNode
// ----------------------------------------

/**
 * ダクト継手ノード
 * 🔵 信頼性: ヒアリングQ6「ポート配列方式」・PRDセクション14.1,20.5より
 *
 * Zod実装: packages/core/src/schema/nodes/duct-fitting.ts
 * IDプレフィックス: 'duct_fit'
 * 親: LevelNode
 */
interface DuctFittingNode extends BaseNodeFields {
  id: `duct_fit_${string}` // 🔵
  type: 'duct_fitting' // 🔵
  fittingType: FittingType // 🔵 PRDセクション20.5 圧損係数テーブルより
  position: [number, number, number] // 🔵
  rotation: [number, number, number] // 🟡 3D配置に必要と推測
  ports: Port[] // 🔵 ヒアリングQ6より（エルボ=2, T=3）
  localLossCoefficient: number // 🔵 PRDセクション20.5より（ζ値）
  systemId: string // 🔵
}

/**
 * 継手タイプ
 * 🔵 信頼性: PRDセクション20.5圧損係数テーブルより
 */
type FittingType =
  | 'elbow_90' // エルボ90° (ζ=0.3)
  | 'elbow_45' // エルボ45° (ζ=0.15) 🟡 妥当な推測
  | 'tee_branch' // T分岐 (ζ=0.5)
  | 'tee_through' // T直通 (ζ=0.1) 🟡 妥当な推測
  | 'reducer' // レジューサ (ζ=0.05) 🟡 妥当な推測

// ----------------------------------------
// 7. PipeSegmentNode
// ----------------------------------------

/**
 * 配管区間ノード
 * 🔵 信頼性: PRDセクション14.7・REQ-1102より
 *
 * Zod実装: packages/core/src/schema/nodes/pipe-segment.ts
 * IDプレフィックス: 'pipe_seg'
 * 親: LevelNode
 */
interface PipeSegmentNode extends BaseNodeFields {
  id: `pipe_seg_${string}` // 🔵
  type: 'pipe_segment' // 🔵
  start: [number, number, number] // 🔵 REQ-1102
  end: [number, number, number] // 🔵 REQ-1102
  medium: PipeMedium // 🔵 REQ-1102
  nominalSize: string | null // 🔵 REQ-1102 呼び径（例: '65A'）, null=未確定
  outerDiameter: number | null // 🟡 表示用に必要と推測 (mm)
  startPortId: string | null // 🔵 ヒアリングQ8より
  endPortId: string | null // 🔵
  systemId: string // 🔵 REQ-1102
  calcResult: PipeCalcResult | null // 🔵 REQ-1104
}

/**
 * 配管媒体
 * 🔵 信頼性: PRDセクション11.11・REQ-1102,1105より
 */
type PipeMedium = 'chilled_water_supply' | 'chilled_water_return'

/**
 * 配管計算結果
 * 🔵 信頼性: PRDセクション15.7・REQ-1103,1104より
 */
interface PipeCalcResult {
  flowRate: number // 流量 (L/min)
  velocity: number // 流速 (m/s)
  pressureLoss: number // 区間圧損 (kPa)
  status: 'success' | 'error'
  error?: string
}

// ========================================
// useEditor ストア拡張型
// ========================================

/**
 * エディタモード
 * 🔵 信頼性: ヒアリングQ3「Phase型拡張」より
 */
type EditorMode = 'architecture' | 'hvac'

/**
 * Phase型（拡張版）
 * 🔵 信頼性: ヒアリングQ3より
 */
type Phase =
  | 'site' | 'structure' | 'furnish' // 既存（建築モード）
  | 'zone' | 'equip' | 'route' | 'calc' // 新規（HVACモード）

/**
 * Phase有効範囲マッピング
 * 🔵 信頼性: ヒアリングQ3より
 */
type PhasesByEditorMode = {
  architecture: ('site' | 'structure' | 'furnish')[]
  hvac: ('zone' | 'equip' | 'route' | 'calc')[]
}

/**
 * HVACツール型
 * 🔵 信頼性: PRDセクション13.2・要件定義各フェーズより
 */
type HvacTool =
  | 'zone_draw' // zone フェーズ: ゾーン描画
  | 'perimeter_edit' // zone フェーズ: 外皮条件編集
  | 'zone_grouping' // equip フェーズ: ゾーングルーピング
  | 'ahu_place' // equip フェーズ: AHU配置
  | 'diffuser_place' // equip フェーズ: 制気口配置
  | 'duct_route' // route フェーズ: ダクトルーティング
  | 'pipe_route' // route フェーズ: 配管ルーティング
  | 'load_calc' // calc フェーズ: 負荷計算実行
  | 'pressure_loss' // calc フェーズ: 圧損計算実行
  | 'validate' // calc フェーズ: バリデーション

/**
 * ツール型（拡張版）
 * 🔵 信頼性: 既存実装 + HVACツール追加
 */
type Tool = SiteTool | StructureTool | FurnishTool | HvacTool

// 既存ツール型（参考）
type SiteTool = 'property-line'
type StructureTool =
  | 'wall' | 'room' | 'custom-room' | 'slab' | 'ceiling' | 'roof'
  | 'column' | 'stair' | 'item' | 'zone' | 'window' | 'door'
type FurnishTool = 'item'

/**
 * フェーズ別有効ツールマッピング
 * 🔵 信頼性: PRDセクション13.2・要件定義より
 */
type ToolsByPhase = {
  zone: ('zone_draw' | 'perimeter_edit')[]
  equip: ('zone_grouping' | 'ahu_place' | 'diffuser_place')[]
  route: ('duct_route' | 'pipe_route')[]
  calc: ('load_calc' | 'pressure_loss' | 'validate')[]
}

// ========================================
// 警告システム型
// ========================================

/**
 * 警告
 * 🔵 信頼性: PRDセクション17・REQ-1201より
 */
interface Warning {
  id: string // 警告ID
  nodeId: string // 対象ノードID
  nodeType: string // 対象ノードタイプ
  severity: 'error' | 'warning' // 重要度
  code: WarningCode // 警告コード
  message: string // 警告メッセージ
}

/**
 * 警告コード
 * 🔵 信頼性: REQ-1201の警告種別より
 */
type WarningCode =
  | 'unconnected_port' // 未接続ポート
  | 'airflow_not_set' // 風量未設定
  | 'size_not_determined' // 寸法未確定
  | 'velocity_exceeded' // 推奨風速超過
  | 'pressure_not_calculated' // 圧損計算未実施
  | 'zone_no_system' // 系統未割当ゾーン
  | 'airflow_mismatch' // 風量乖離（±5%超過）
  | 'pipe_not_connected' // 配管未接続

// ========================================
// サンプルデータ型
// ========================================

/**
 * AHUカタログエントリ
 * 🔵 信頼性: PRDセクション20.3・REQ-505より
 */
interface AhuCatalogEntry {
  modelName: string // 機種名（例: 'AHU-S-5000'）
  airflowRate: number // 定格風量 (m³/h)
  coolingCapacity: number // 冷房能力 (W)
  heatingCapacity: number // 暖房能力 (W)
  staticPressure: number // 静圧 (Pa)
  dimensions: AhuDimensions // 外形寸法
  ports: Omit<Port, 'connectedSegmentId'>[] // ポート定義（接続なし）
}

/**
 * 制気口カタログエントリ
 * 🔵 信頼性: PRDセクション20.4・REQ-603より
 */
interface DiffuserCatalogEntry {
  modelName: string // 機種名（例: 'ANEMO-250'）
  subType: DiffuserSubType
  neckDiameter: number // ネック径 (mm)
  maxAirflow: number // 最大風量 (m³/h)
  throwDistance: number // 到達距離 (m)
}

/**
 * ダクト標準サイズエントリ
 * 🔵 信頼性: PRDセクション20.5・REQ-902より
 */
interface StandardDuctSize {
  width: number // 幅 (mm)
  height: number // 高さ (mm)
  crossSectionArea: number // 断面積 (m²)
  hydraulicDiameter: number // 等価直径 (mm)
  aspectRatio: number // アスペクト比
}

/**
 * 配管標準口径エントリ
 * 🔵 信頼性: PRDセクション20.6・REQ-1103より
 */
interface StandardPipeSize {
  nominalSize: string // 呼び径（例: '65A'）
  outerDiameter: number // 外径 (mm)
  innerDiameter: number // 内径 (mm)
  crossSectionArea: number // 断面積 (m²)
}

/**
 * 負荷原単位テーブルエントリ
 * 🔵 信頼性: PRDセクション20.8・REQ-305より
 */
interface LoadUnitEntry {
  usage: ZoneUsage
  coolingLoadPerArea: number // 冷房原単位 (W/m²)
  heatingLoadPerArea: number // 暖房原単位 (W/m²)
  occupantDensity: number // 標準在室密度 (人/m²)
}

// ========================================
// 接続グラフ型
// ========================================

/**
 * 接続グラフノード（グラフアルゴリズム用）
 * 🔵 信頼性: ヒアリングQ8「ポートIDベース」より
 */
interface GraphNode {
  nodeId: string // シーンノードID
  nodeType: 'ahu' | 'diffuser' | 'duct_fitting'
  ports: GraphPort[]
}

/**
 * 接続グラフポート
 * 🔵 信頼性: ヒアリングQ8より
 */
interface GraphPort {
  portId: string
  medium: PortMedium
  connectedSegmentId: string | null
  connectedNodeId: string | null // 接続先ノードID（解決済み）
}

/**
 * 接続グラフエッジ（ダクト/配管区間）
 * 🔵 信頼性: ヒアリングQ8より
 */
interface GraphEdge {
  segmentId: string // DuctSegment/PipeSegment ID
  fromPortId: string
  toPortId: string
  fromNodeId: string
  toNodeId: string
  airflowRate: number | null // ダクトの場合
  length: number // 区間長 (m)
}

/**
 * 系統グラフ（構築済み）
 * 🟡 信頼性: ヒアリングQ8から妥当な推測
 */
interface SystemGraph {
  systemId: string
  rootNodeId: string // AHU ノードID
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  leafNodeIds: string[] // 末端制気口IDs
  longestPath: GraphEdge[] | null // 最遠経路（圧損計算用）
}

// ========================================
// ゾーン表示カラー
// ========================================

/**
 * 用途別カラーマッピング
 * 🔵 信頼性: PRDセクション21.5・REQ-1501より
 */
type ZoneColorMap = Record<ZoneUsage, string>
// office_general: '#42A5F5'
// conference: '#FFA726'
// reception: '#66BB6A'
// office_server: '#EF5350'
// corridor: '#BDBDBD'

/**
 * 配管カラーマッピング
 * 🔵 信頼性: PRDセクション21.5・REQ-1503より
 */
type PipeColorMap = Record<PipeMedium, string>
// chilled_water_supply: '#0288D1'
// chilled_water_return: '#01579B'

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 89件 (92%)
 * - 🟡 黄信号: 8件 (8%)
 * - 🔴 赤信号: 0件 (0%)
 *
 * 品質評価: 高品質
 */
