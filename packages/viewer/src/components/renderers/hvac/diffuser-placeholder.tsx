import type { AnyNode } from '@pascal-app/core'

type DiffuserNode = Extract<AnyNode, { type: 'diffuser' }>

/** プレースホルダー: 後続タスクで DiffuserRenderer に置き換える */
export function DiffuserPlaceholder(_props: { node: DiffuserNode }) {
  return null
}
