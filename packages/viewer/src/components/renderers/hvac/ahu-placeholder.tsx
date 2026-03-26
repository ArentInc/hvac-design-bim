import type { AnyNode } from '@pascal-app/core'

type AhuNode = Extract<AnyNode, { type: 'ahu' }>

/** プレースホルダー: 後続タスクで AhuRenderer に置き換える */
export function AhuPlaceholder(_props: { node: AhuNode }) {
  return null
}
