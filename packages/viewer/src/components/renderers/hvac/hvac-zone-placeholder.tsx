import type { AnyNode } from '@pascal-app/core'

type HvacZoneNode = Extract<AnyNode, { type: 'hvac_zone' }>

/** プレースホルダー: TASK-0012 で HvacZoneRenderer に置き換える */
export function HvacZonePlaceholder(_props: { node: HvacZoneNode }) {
  return null
}
