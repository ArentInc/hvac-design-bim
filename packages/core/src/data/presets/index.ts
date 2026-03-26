/**
 * TASK-0042: プリセットデータエクスポート
 * 5段階のHVAC設計プリセットをパッケージ外部に提供する
 */

import preset00 from './preset-00-empty.json'
import preset01 from './preset-01-zones.json'
import preset02 from './preset-02-equip.json'
import preset03 from './preset-03-route.json'
import preset04 from './preset-04-complete.json'

export type PresetData = {
  nodes: Record<string, unknown>
  rootNodeIds: string[]
}

export const HVAC_PRESETS: Array<{
  stage: number
  label: string
  description: string
  data: PresetData
}> = [
  {
    stage: 0,
    label: 'Stage 0',
    description: '建築モデルのみ（空の状態）',
    data: preset00 as unknown as PresetData,
  },
  {
    stage: 1,
    label: 'Stage 1',
    description: 'ゾーン作成・負荷計算済み',
    data: preset01 as unknown as PresetData,
  },
  {
    stage: 2,
    label: 'Stage 2',
    description: '系統構成・機器配置済み',
    data: preset02 as unknown as PresetData,
  },
  {
    stage: 3,
    label: 'Stage 3',
    description: 'ダクト・配管接続済み（計算前）',
    data: preset03 as unknown as PresetData,
  },
  {
    stage: 4,
    label: 'Stage 4',
    description: '全計算完了（完成状態）',
    data: preset04 as unknown as PresetData,
  },
]
