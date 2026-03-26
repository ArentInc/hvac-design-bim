import type { AnyNode } from '@pascal-app/core'

type DuctFittingNode = Extract<AnyNode, { type: 'duct_fitting' }>

/** プレースホルダー: 後続タスクで DuctFittingRenderer に置き換える */
export function DuctFittingPlaceholder(_props: { node: DuctFittingNode }) {
  return null
}
