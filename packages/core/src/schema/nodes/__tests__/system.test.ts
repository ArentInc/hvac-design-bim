import { describe, expect, it } from 'vitest'
import { SystemNode } from '../system'

const baseSystem = {
  systemName: '系統A',
  servedZoneIds: ['hvac_zone_aaa', 'hvac_zone_bbb'],
  ahuId: null,
  aggregatedLoad: null,
  status: 'draft' as const,
}

describe('SystemNode', () => {
  it('テスト7: 正常データパース', () => {
    const result = SystemNode.parse(baseSystem)

    expect(result.type).toBe('system')
    expect(result.systemName).toBe('系統A')
    expect(result.servedZoneIds).toHaveLength(2)
    expect(result.ahuId).toBeNull()
    expect(result.aggregatedLoad).toBeNull()
    expect(result.status).toBe('draft')
  })

  it('テスト8: SystemStatus enum 全値バリデーション', () => {
    const statuses = ['draft', 'equipment_selected', 'routed', 'calculated', 'validated'] as const
    for (const status of statuses) {
      const result = SystemNode.parse({ ...baseSystem, status })
      expect(result.status).toBe(status)
    }
  })

  it('テスト9: 不正ステータスバリデーション', () => {
    expect(() => SystemNode.parse({ ...baseSystem, status: 'unknown_status' })).toThrow()
  })

  it('テスト10: servedZoneIds 空配列許容', () => {
    const result = SystemNode.parse({ ...baseSystem, servedZoneIds: [] })
    expect(result.servedZoneIds).toHaveLength(0)
  })
})
