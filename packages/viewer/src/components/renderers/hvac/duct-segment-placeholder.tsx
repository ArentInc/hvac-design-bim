import type { AnyNode } from '@pascal-app/core'

type DuctSegmentNode = Extract<AnyNode, { type: 'duct_segment' }>

/** プレースホルダー: 後続タスクで DuctSegmentRenderer に置き換える */
export function DuctSegmentPlaceholder(_props: { node: DuctSegmentNode }) {
  return null
}
