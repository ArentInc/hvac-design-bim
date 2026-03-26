import { describe, expect, it } from 'vitest'
import { parseArchitecture } from '../loaders/architecture-loader'

const validArchitectureJson = {
  buildingName: 'テストビル',
  levels: [
    {
      levelId: 'level_01',
      floorHeight: 0,
      ceilingHeight: 2.7,
      floorOutline: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      externalWalls: [
        {
          id: 'wall_south',
          orientation: 'S' as const,
          vertices: [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
            { x: 10, y: 0, z: 2.7 },
            { x: 0, y: 0, z: 2.7 },
          ],
          wallArea: 27.0,
          glazingRatio: 0.4,
        },
        {
          id: 'wall_east',
          orientation: 'E' as const,
          vertices: [
            { x: 10, y: 0, z: 0 },
            { x: 10, y: 8, z: 0 },
            { x: 10, y: 8, z: 2.7 },
            { x: 10, y: 0, z: 2.7 },
          ],
          wallArea: 21.6,
          glazingRatio: 0.3,
        },
      ],
    },
  ],
}

describe('architecture-loader', () => {
  it('テスト1: 有効なJSONを正常にパース', () => {
    const result = parseArchitecture(validArchitectureJson)
    expect(result.buildingName).toBe('テストビル')
    expect(result.levels).toHaveLength(1)
    expect(result.levels[0]?.levelId).toBe('level_01')
    expect(result.levels[0]?.externalWalls).toHaveLength(2)
  })

  it('テスト2: 必須フィールド欠落でZodErrorをthrow', () => {
    const invalidJson = { buildingName: 'テスト', levels: 'invalid' }
    expect(() => parseArchitecture(invalidJson)).toThrow()
  })

  it('テスト3: glazingRatio > 1.0 でZodErrorをthrow', () => {
    const invalidJson = {
      ...validArchitectureJson,
      levels: [
        {
          ...validArchitectureJson.levels[0],
          externalWalls: [
            {
              id: 'wall_x',
              orientation: 'S' as const,
              vertices: [],
              wallArea: 10,
              glazingRatio: 1.5,
            },
          ],
        },
      ],
    }
    expect(() => parseArchitecture(invalidJson)).toThrow()
  })

  it('テスト4: 全8方位がパース成功', () => {
    const orientations = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
    for (const orientation of orientations) {
      const json = {
        ...validArchitectureJson,
        levels: [
          {
            ...validArchitectureJson.levels[0],
            externalWalls: [
              {
                id: `wall_${orientation}`,
                orientation,
                vertices: [],
                wallArea: 10,
                glazingRatio: 0.3,
              },
            ],
          },
        ],
      }
      expect(() => parseArchitecture(json)).not.toThrow()
    }
  })
})
