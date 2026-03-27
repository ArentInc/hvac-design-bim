/**
 * UI統合テスト用ヘルパー — プリセットデータ読込 + モックセットアップ
 *
 * 【設計方針】:
 *   - プリセットJSONを直接importしてモック干渉を回避
 *   - Stage 2〜4はビルダー関数から生成（計算済みデータ含む）
 *   - useScene/useViewerの標準モックパターンを共通化
 */

import type { Mock } from 'vitest'
import { vi } from 'vitest'
import {
  buildPresetStage02,
  buildPresetStage03,
  buildPresetStage04,
} from '../../../../../core/src/data/presets/generated-hvac-presets'
// プリセットデータ直接import（@pascal-app/coreのモック干渉回避）
import preset00 from '../../../../../core/src/data/presets/preset-00-empty.json'
import preset01 from '../../../../../core/src/data/presets/preset-01-zones.json'

type NodesDict = Record<string, any>

const presetCache: Partial<Record<number, NodesDict>> = {}

/**
 * ステージ別プリセットノード辞書を取得する
 * Stage 2〜4はビルダー関数の結果をキャッシュして再利用
 */
export function getPresetNodes(stage: 0 | 1 | 2 | 3 | 4): NodesDict {
  if (presetCache[stage]) return presetCache[stage]!

  let data: { nodes: NodesDict }
  switch (stage) {
    case 0:
      data = preset00 as unknown as { nodes: NodesDict }
      break
    case 1:
      data = preset01 as unknown as { nodes: NodesDict }
      break
    case 2:
      data = buildPresetStage02() as unknown as { nodes: NodesDict }
      break
    case 3:
      data = buildPresetStage03() as unknown as { nodes: NodesDict }
      break
    case 4:
      data = buildPresetStage04() as unknown as { nodes: NodesDict }
      break
  }

  presetCache[stage] = data.nodes
  return data.nodes
}

/**
 * ノードをタイプ別にフィルタする
 */
export function filterNodesByType(nodes: NodesDict, type: string): any[] {
  return Object.values(nodes).filter((n: any) => n.type === type)
}

/**
 * useSceneモックを標準パターンでセットアップする
 */
export function setupSceneMock(useScene: Mock, nodes: NodesDict, updateNode = vi.fn()) {
  useScene.mockImplementation((selector?: (state: any) => any) => {
    const state = { nodes, updateNode }
    return selector ? selector(state) : state
  })
  return updateNode
}

/**
 * useViewerモックを標準パターンでセットアップする
 */
export function setupViewerMock(
  useViewer: Mock,
  selectedIds: string[] = [],
  setSelection = vi.fn(),
) {
  useViewer.mockImplementation((selector?: (state: any) => any) => {
    const state = { selectedIds, setSelection, selection: { selectedIds } }
    return selector ? selector(state) : state
  })
  return setSelection
}
