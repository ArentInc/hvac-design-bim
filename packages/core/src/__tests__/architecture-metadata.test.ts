import { describe, expect, it } from 'vitest'
import type { ArchitectureLevel } from '../loaders/architecture-loader'
import { extractWallMetadata } from '../loaders/architecture-metadata'

const sampleLevel: ArchitectureLevel = {
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
      orientation: 'S',
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
      orientation: 'E',
      vertices: [
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 8, z: 0 },
        { x: 10, y: 8, z: 2.7 },
        { x: 10, y: 0, z: 2.7 },
      ],
      wallArea: 21.6,
      glazingRatio: 0.3,
    },
    {
      id: 'wall_north',
      orientation: 'N',
      vertices: [
        { x: 0, y: 8, z: 0 },
        { x: 10, y: 8, z: 0 },
        { x: 10, y: 8, z: 2.7 },
        { x: 0, y: 8, z: 2.7 },
      ],
      wallArea: 27.0,
      glazingRatio: 0.1,
    },
    {
      id: 'wall_west',
      orientation: 'W',
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 8, z: 0 },
        { x: 0, y: 8, z: 2.7 },
        { x: 0, y: 0, z: 2.7 },
      ],
      wallArea: 21.6,
      glazingRatio: 0.2,
    },
  ],
}

describe('architecture-metadata', () => {
  it('テスト3: 4面の外壁を持つレベルから4件のWallMetadataを抽出', () => {
    const result = extractWallMetadata(sampleLevel)
    expect(result).toHaveLength(4)
  })

  it('テスト3b: 各WallMetadataが正しい方位・面積・ガラス面積比を保持', () => {
    const result = extractWallMetadata(sampleLevel)
    const southWall = result.find((w) => w.wallId === 'wall_south')
    expect(southWall?.orientation).toBe('S')
    expect(southWall?.wallArea).toBe(27.0)
    expect(southWall?.glazingRatio).toBe(0.4)
  })

  it('テスト3c: WallMetadataに頂点情報が含まれる', () => {
    const result = extractWallMetadata(sampleLevel)
    const eastWall = result.find((w) => w.wallId === 'wall_east')
    expect(eastWall?.vertices).toHaveLength(4)
    expect(eastWall?.vertices[0]).toHaveProperty('x')
    expect(eastWall?.vertices[0]).toHaveProperty('y')
    expect(eastWall?.vertices[0]).toHaveProperty('z')
  })

  it('テスト3d: 外壁なしのレベルは空配列を返す', () => {
    const emptyLevel: ArchitectureLevel = {
      ...sampleLevel,
      externalWalls: [],
    }
    const result = extractWallMetadata(emptyLevel)
    expect(result).toHaveLength(0)
  })
})
