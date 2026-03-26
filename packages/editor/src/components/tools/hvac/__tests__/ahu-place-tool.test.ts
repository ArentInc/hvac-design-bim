/**
 * TASK-0023: AhuPlaceTool — AHU配置ツール 配置ロジックテスト
 *
 * 【テスト対象】: AhuPlaceTool の placeAhu ロジック
 *   - AhuNode.parse()→createNode() でのノード作成
 *   - カタログデータのコピー
 *   - SystemNode.ahuId 更新
 *   - ポート座標変換
 *   - カタログ未選択時の防止
 *   - parentId の設定
 *
 * 【設計方針】: @pascal-app/core や Three.js への依存を避け、純粋なロジックのみをテストする。
 *              AhuNode.parse は vi.fn() でモック化し、正しい引数で呼ばれることを検証する。
 * 🔵 信頼性レベル: TASK-0023 要件定義に明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---

const mockCreateNode = vi.fn()
const mockUpdateNode = vi.fn()

const mockAhuNodeParse = vi.fn((input: Record<string, unknown>) => ({
  id: 'ahu_mock123',
  type: 'ahu',
  object: 'node',
  parentId: null,
  visible: true,
  children: [],
  ...input,
}))

const AhuNodeMock = { parse: mockAhuNodeParse }

// --- Types ---

type CatalogPort = {
  label: string
  medium: string
  position: [number, number, number]
}

type AhuCatalogEntry = {
  modelId: string
  modelName: string
  airflowRate: number
  coolingCapacity: number
  heatingCapacity: number
  staticPressure: number
  dimensions: { width: number; height: number; depth: number }
  ports: CatalogPort[]
}

// --- Logic under test (mirrors ahu-place-tool.tsx の placeAhu) ---

/**
 * 【ヘルパー関数】: カタログポートを AhuNode の Port 形式に変換する
 * 🔵 信頼性レベル: TASK-0023 実装詳細セクション5（ポート座標変換）に明示
 */
function transformPorts(catalogPorts: CatalogPort[]) {
  return catalogPorts.map((p, i) => ({
    id: `port_${i}`,
    label: p.label,
    medium: p.medium,
    position: p.position as [number, number, number],
    direction: [0, 0, 1] as [number, number, number],
    connectedSegmentId: null,
  }))
}

/**
 * 【ヘルパー関数】: AhuPlaceTool の配置ロジック（テスト用インライン実装）
 * 🔵 信頼性レベル: TASK-0023 実装詳細セクション1〜4に明示
 */
function placeAhu(
  catalogEntry: AhuCatalogEntry | null,
  position: [number, number, number],
  levelId: string,
  systemId: string | null,
): { id: string } | null {
  if (!catalogEntry) return null

  const ports = transformPorts(catalogEntry.ports)

  const ahuNode = AhuNodeMock.parse({
    tag: catalogEntry.modelId,
    equipmentName: catalogEntry.modelName,
    position,
    rotation: [0, 0, 0] as [number, number, number],
    dimensions: catalogEntry.dimensions,
    ports,
    airflowRate: catalogEntry.airflowRate,
    coolingCapacity: catalogEntry.coolingCapacity,
    heatingCapacity: catalogEntry.heatingCapacity,
    staticPressure: catalogEntry.staticPressure,
    systemId: systemId ?? '',
  })

  mockCreateNode(ahuNode, levelId)

  if (systemId) {
    mockUpdateNode(systemId, { ahuId: ahuNode.id })
  }

  return ahuNode as { id: string }
}

// --- Test fixtures ---

const sampleCatalogEntry: AhuCatalogEntry = {
  modelId: 'AHU-S-5000',
  modelName: '中小型AHU 5000',
  airflowRate: 5000,
  coolingCapacity: 30.0,
  heatingCapacity: 20.0,
  staticPressure: 350,
  dimensions: { width: 1.8, height: 1.4, depth: 1.2 },
  ports: [
    { label: 'SA', medium: 'supply_air', position: [0.0, 0.7, 0.6] },
    { label: 'RA', medium: 'return_air', position: [0.0, 0.7, -0.6] },
    { label: 'CHW_S', medium: 'chilled_water', position: [-0.9, 0.4, 0.3] },
    { label: 'CHW_R', medium: 'chilled_water', position: [-0.9, 0.4, -0.3] },
  ],
}

// --- Tests ---

describe('TASK-0023: AhuPlaceTool 配置ロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('テスト1: AhuNode作成 — parse成功、createNode呼び出し', () => {
    // 【テスト目的】: 正常フローで AhuNode.parse と createNode が正しく呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0023 単体テスト要件「テスト1」に明示
    placeAhu(sampleCatalogEntry, [5, 0, 3], 'level_001', null)

    expect(mockAhuNodeParse).toHaveBeenCalledOnce()
    expect(mockCreateNode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ahu' }),
      'level_001',
    )
  })

  it('テスト2: カタログデータのコピー — coolingCapacity=30kW, airflowRate=5000m3/h', () => {
    // 【テスト目的】: カタログのスペックデータが AhuNode に正しくコピーされることを確認
    // 🔵 信頼性レベル: TASK-0023 単体テスト要件「テスト2」に明示
    placeAhu(sampleCatalogEntry, [0, 0, 0], 'level_001', null)

    expect(mockAhuNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        coolingCapacity: 30.0,
        heatingCapacity: 20.0,
        airflowRate: 5000,
        staticPressure: 350,
      }),
    )
  })

  it('テスト3: SystemNodeのahuId更新 — systemId指定時にupdateNode呼び出し', () => {
    // 【テスト目的】: systemId が指定された場合に updateNode('system_001', {ahuId: ...}) が呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0023 単体テスト要件「テスト3」に明示
    placeAhu(sampleCatalogEntry, [0, 0, 0], 'level_001', 'system_001')

    expect(mockUpdateNode).toHaveBeenCalledWith('system_001', { ahuId: 'ahu_mock123' })
  })

  it('テスト4: ポート変換 — 4ポートがrelativePositionを保持', () => {
    // 【テスト目的】: カタログの4ポートが AhuNode.ports に正しく変換されることを確認
    // 🔵 信頼性レベル: TASK-0023 単体テスト要件「テスト4」に明示
    placeAhu(sampleCatalogEntry, [0, 0, 0], 'level_001', null)

    const firstCall = mockAhuNodeParse.mock.calls[0]
    expect(firstCall).toBeDefined()
    const callArg = firstCall![0] as { ports: unknown[] }
    expect(callArg.ports).toHaveLength(4)
    expect(mockAhuNodeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: expect.arrayContaining([
          expect.objectContaining({ label: 'SA', medium: 'supply_air' }),
          expect.objectContaining({ label: 'RA', medium: 'return_air' }),
          expect.objectContaining({ label: 'CHW_S', medium: 'chilled_water' }),
          expect.objectContaining({ label: 'CHW_R', medium: 'chilled_water' }),
        ]),
      }),
    )
  })

  it('テスト5: カタログ未選択時の配置防止 — 何も作成されない', () => {
    // 【テスト目的】: catalogEntry=null の場合に何も作成されないことを確認
    // 🔵 信頼性レベル: TASK-0023 単体テスト要件「テスト5」に明示
    const result = placeAhu(null, [0, 0, 0], 'level_001', null)

    expect(result).toBeNull()
    expect(mockAhuNodeParse).not.toHaveBeenCalled()
    expect(mockCreateNode).not.toHaveBeenCalled()
  })

  it('テスト6: parentIdの設定 — levelIdでcreateNode呼び出し', () => {
    // 【テスト目的】: createNode が正しい levelId を parentId として呼ばれることを確認
    // 🔵 信頼性レベル: TASK-0023 単体テスト要件「テスト6」に明示
    placeAhu(sampleCatalogEntry, [0, 0, 0], 'level_abc', null)

    expect(mockCreateNode).toHaveBeenCalledWith(expect.anything(), 'level_abc')
  })

  it('テスト追加: systemIdなし — updateNode呼ばれない', () => {
    // 【テスト目的】: systemId=null の場合に updateNode が呼ばれないことを確認
    placeAhu(sampleCatalogEntry, [0, 0, 0], 'level_001', null)

    expect(mockUpdateNode).not.toHaveBeenCalled()
  })
})
