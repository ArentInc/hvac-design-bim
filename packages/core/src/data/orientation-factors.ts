export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export const ORIENTATION_FACTORS: Record<Orientation, number> = {
  S: 1.0,
  SE: 1.1,
  SW: 1.1,
  E: 1.2,
  W: 1.2,
  NE: 0.8,
  NW: 0.8,
  N: 0.6,
} as const
