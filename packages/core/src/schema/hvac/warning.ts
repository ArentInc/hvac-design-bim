/**
 * TASK-0038: Warning型定義 — 警告バリデーション型
 *
 * 【機能概要】: ValidationSystemが生成する8種の警告コード・重大度・警告インターフェースを定義
 * 【設計方針】: TypeScript型のみ（Zodスキーマ不要）。CoreパッケージのThree.js依存禁止に準拠
 * 【対応要件】: REQ-1201（8種警告検出）
 */

export type WarningCode =
  | 'unconnected_port'
  | 'airflow_not_set'
  | 'size_not_determined'
  | 'velocity_exceeded'
  | 'pressure_not_calculated'
  | 'zone_no_system'
  | 'airflow_mismatch'
  | 'pipe_not_connected'

export type WarningSeverity = 'error' | 'warning' | 'info'

export interface Warning {
  id: string
  nodeId: string
  nodeType: string
  severity: WarningSeverity
  code: WarningCode
  message: string
}
