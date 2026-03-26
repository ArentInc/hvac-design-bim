import type { AnyNode } from '@pascal-app/core'

type PipeSegmentNode = Extract<AnyNode, { type: 'pipe_segment' }>

/** プレースホルダー: 後続タスクで PipeSegmentRenderer に置き換える */
export function PipeSegmentPlaceholder(_props: { node: PipeSegmentNode }) {
  return null
}
