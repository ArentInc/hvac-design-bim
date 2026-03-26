/**
 * TASK-0038: ValidationSystem — 警告バリデーションエンジン
 *
 * 【機能概要】: dirtyノード検出をトリガーとして全HVACノードを走査し、
 *             8種の警告を生成してuseValidationストアに格納する
 * 【設計方針】: Coreシステムパターン: useFrame内でdirtyノードを検出し処理。
 *             @pascal-app/viewer や Three.js への依存禁止
 * 【対応要件】: REQ-1201（8種警告検出）
 * 🔵 信頼性レベル: TASK-0038 architecture.md Systemsパターンに準拠
 */

import { useFrame } from '@react-three/fiber'
import type { Warning } from '../../schema/hvac/warning'
import type { AnyNode, AnyNodeId } from '../../schema/types'
import useScene from '../../store/use-scene'
import useValidation from '../../store/use-validation'

// ============================================================================
// 定数
// ============================================================================

/** 主ダクト風速上限 (m/s) — REQ-1201 velocity_exceeded */
export const DUCT_MAX_VELOCITY_MS = 15

/** 風量乖離許容しきい値 (5%) — REQ-1201 airflow_mismatch */
export const AIRFLOW_MISMATCH_THRESHOLD = 0.05

/** 警告IDプレフィックス生成ヘルパー */
function warningId(code: string, nodeId: string): string {
  return `warning_${code}_${nodeId}`
}

// ============================================================================
// 純粋チェック関数（テスト可能）
// ============================================================================

/**
 * unconnected_port: AHUポートに接続先未設定があれば警告を生成 (REQ-1201)
 * severity: 'error'
 */
export function checkUnconnectedPorts(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'ahu') continue
    for (const port of node.ports) {
      if (port.connectedSegmentId === null) {
        warnings.push({
          id: warningId('unconnected_port', `${node.id}_${port.id}`),
          nodeId: node.id,
          nodeType: node.type,
          severity: 'error',
          code: 'unconnected_port',
          message: `AHU "${node.tag}" のポート "${port.label}" (${port.id}) に接続されたダクトセグメントがありません`,
        })
      }
    }
  }
  return warnings
}

/**
 * airflow_not_set: DuctSegmentのairflowRateが未設定(null/0)なら警告を生成 (REQ-1201)
 * severity: 'warning'
 */
export function checkAirflowNotSet(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'duct_segment') continue
    if (node.airflowRate === null || node.airflowRate === 0) {
      warnings.push({
        id: warningId('airflow_not_set', node.id),
        nodeId: node.id,
        nodeType: node.type,
        severity: 'warning',
        code: 'airflow_not_set',
        message: `ダクト区間 "${node.id}" の風量が設定されていません`,
      })
    }
  }
  return warnings
}

/**
 * size_not_determined: DuctSegment/PipeSegmentのサイズが未確定なら警告を生成 (REQ-1201)
 * severity: 'warning'
 */
export function checkSizeNotDetermined(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type === 'duct_segment') {
      if (node.width === null || node.width === 0) {
        warnings.push({
          id: warningId('size_not_determined', node.id),
          nodeId: node.id,
          nodeType: node.type,
          severity: 'warning',
          code: 'size_not_determined',
          message: `ダクト区間 "${node.id}" の断面寸法が確定していません`,
        })
      }
    } else if (node.type === 'pipe_segment') {
      if (node.nominalSize === null || node.nominalSize === 0) {
        warnings.push({
          id: warningId('size_not_determined', node.id),
          nodeId: node.id,
          nodeType: node.type,
          severity: 'warning',
          code: 'size_not_determined',
          message: `配管区間 "${node.id}" の口径が確定していません`,
        })
      }
    }
  }
  return warnings
}

/**
 * velocity_exceeded: DuctSegmentのcalcResult.velocityが上限を超えたら警告を生成 (REQ-1201)
 * threshold: DUCT_MAX_VELOCITY_MS (15 m/s)
 * severity: 'warning'
 */
export function checkVelocityExceeded(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'duct_segment') continue
    if (node.calcResult !== null && node.calcResult.velocity > DUCT_MAX_VELOCITY_MS) {
      warnings.push({
        id: warningId('velocity_exceeded', node.id),
        nodeId: node.id,
        nodeType: node.type,
        severity: 'warning',
        code: 'velocity_exceeded',
        message: `ダクト区間 "${node.id}" の風速 ${node.calcResult.velocity.toFixed(1)} m/s が上限 ${DUCT_MAX_VELOCITY_MS} m/s を超過しています`,
      })
    }
  }
  return warnings
}

/**
 * pressure_not_calculated: DuctSegmentのcalcResultがnullなら情報警告を生成 (REQ-1201)
 * severity: 'info'
 */
export function checkPressureNotCalculated(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'duct_segment') continue
    if (node.calcResult === null) {
      warnings.push({
        id: warningId('pressure_not_calculated', node.id),
        nodeId: node.id,
        nodeType: node.type,
        severity: 'info',
        code: 'pressure_not_calculated',
        message: `ダクト区間 "${node.id}" の圧損が未計算です`,
      })
    }
  }
  return warnings
}

/**
 * zone_no_system: HvacZoneNodeのsystemIdが未設定なら警告を生成 (REQ-1201)
 * severity: 'warning'
 */
export function checkZoneNoSystem(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'hvac_zone') continue
    if (node.systemId === null || node.systemId === '') {
      warnings.push({
        id: warningId('zone_no_system', node.id),
        nodeId: node.id,
        nodeType: node.type,
        severity: 'warning',
        code: 'zone_no_system',
        message: `ゾーン "${node.zoneName}" (${node.id}) がいずれの空調系統にも割り当てられていません`,
      })
    }
  }
  return warnings
}

/**
 * airflow_mismatch: 系統の設計風量と接続制気口の風量合計の乖離が5%超なら警告を生成 (REQ-1201)
 * threshold: AIRFLOW_MISMATCH_THRESHOLD (5%)
 * severity: 'warning'
 */
export function checkAirflowMismatch(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'system') continue
    if (node.aggregatedLoad === null || node.ahuId === null) continue

    const targetAirflow = node.aggregatedLoad.totalAirflow
    if (targetAirflow === 0) continue

    // 同じsystemIdを持つDiffuserNodeの風量を合計
    const systemId = node.id
    let sumAirflow = 0
    for (const n of Object.values(nodes)) {
      if (n.type !== 'diffuser') continue
      if (n.systemId !== systemId) continue
      sumAirflow += n.airflowRate ?? 0
    }

    const deviation = Math.abs(sumAirflow - targetAirflow) / targetAirflow
    if (deviation > AIRFLOW_MISMATCH_THRESHOLD) {
      warnings.push({
        id: warningId('airflow_mismatch', node.id),
        nodeId: node.id,
        nodeType: node.type,
        severity: 'warning',
        code: 'airflow_mismatch',
        message:
          `系統 "${node.systemName}" (${node.id}) の設計風量 ${targetAirflow} m³/h と ` +
          `制気口合計風量 ${sumAirflow} m³/h の乖離が ${(deviation * 100).toFixed(1)}% です（許容 ${AIRFLOW_MISMATCH_THRESHOLD * 100}%）`,
      })
    }
  }
  return warnings
}

/**
 * pipe_not_connected: PipeSegmentのstartPortId/endPortIdが空文字なら警告を生成 (REQ-1201)
 * severity: 'error'
 */
export function checkPipeNotConnected(nodes: Record<string, AnyNode>): Warning[] {
  const warnings: Warning[] = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'pipe_segment') continue
    if (node.startPortId === '' || node.endPortId === '') {
      warnings.push({
        id: warningId('pipe_not_connected', node.id),
        nodeId: node.id,
        nodeType: node.type,
        severity: 'error',
        code: 'pipe_not_connected',
        message: `配管区間 "${node.id}" の接続先ポートが未設定です`,
      })
    }
  }
  return warnings
}

// ============================================================================
// システムコンポーネント
// ============================================================================

/** HVACノードタイプの集合 */
const HVAC_TYPES = new Set([
  'ahu',
  'diffuser',
  'duct_segment',
  'pipe_segment',
  'hvac_zone',
  'system',
  'duct_fitting',
])

/**
 * ValidationSystem — dirtyノード検出をトリガーに全HVACノードを走査して警告を生成する
 * Coreシステムパターン: renderはnull, Three.js依存なし
 */
export function ValidationSystem() {
  useFrame(() => {
    const { nodes, dirtyNodes } = useScene.getState()
    if (dirtyNodes.size === 0) return

    // HVACノードがdirtyかチェック
    const hasHvacDirty = Array.from(dirtyNodes).some((id) => {
      const n = nodes[id as AnyNodeId]
      return n && HVAC_TYPES.has(n.type)
    })
    if (!hasHvacDirty) return

    // 全8チェック実行
    const warnings: Warning[] = [
      ...checkUnconnectedPorts(nodes),
      ...checkAirflowNotSet(nodes),
      ...checkSizeNotDetermined(nodes),
      ...checkVelocityExceeded(nodes),
      ...checkPressureNotCalculated(nodes),
      ...checkZoneNoSystem(nodes),
      ...checkAirflowMismatch(nodes),
      ...checkPipeNotConnected(nodes),
    ]

    // 差分チェック（変化なしなら更新スキップ）
    const current = useValidation.getState().warnings
    const same =
      current.length === warnings.length &&
      warnings.every((w) => current.some((c) => c.id === w.id))
    if (!same) {
      useValidation.getState().setWarnings(warnings)
    }
  })

  return null
}
