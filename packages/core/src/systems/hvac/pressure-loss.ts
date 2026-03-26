/**
 * TASK-0034: PressureLossSystem — ダクト圧損計算 純粋計算関数群
 *
 * 【機能概要】: ダクト区間の直管圧損計算、継手損失加算、最遠経路総圧損算出、
 *             requiredFanPressure 算出を行う純粋関数群
 * 【設計方針】: React/Three.js 非依存の純粋関数として実装（テスタビリティ重視）
 * 【対応要件】:
 *   REQ-1001（直管圧損: ダルシー・ワイスバッハ式）
 *   REQ-1002（継手損失係数テーブル）
 *   REQ-1003（flexible材質: 摩擦係数×4）
 *   REQ-1004（最遠経路総圧損 → requiredFanPressure）
 * 🔵 信頼性レベル: TASK-0034 実装詳細に基づく
 */

import type { AnyNode } from '../../schema/types'
import { buildSystemGraph, detectCycles, traverseDFS } from '../../utils/hvac-graph'

// ============================================================================
// 物理定数
// ============================================================================

/** 標準空気密度 (kg/m³) — 標準状態近似値 */
export const AIR_DENSITY_KG_M3 = 1.2

/** galvanized 鋼板ダクトのダルシー摩擦係数 — 一般的概算値 (REQ-1001) */
export const LAMBDA_GALVANIZED = 0.02

/** flexible 材質の摩擦係数倍率 (REQ-1003) */
export const LAMBDA_FLEXIBLE_MULTIPLIER = 4

/** requiredFanPressure 計算の安全率 (REQ-1004) */
export const FAN_PRESSURE_SAFETY_FACTOR = 1.1

// ============================================================================
// 継手損失係数テーブル (REQ-1002)
// ============================================================================

/** 継手タイプ → 局所損失係数 ζ */
export const FITTING_LOSS_COEFFICIENTS: Record<string, number> = {
  elbow: 0.3, // エルボ 90°
  tee: 0.5, // T分岐（直進側）
  wye: 0.5, // Y分岐
  cross: 1.0, // 十字継手
  reducer: 0.2, // レデューサー
  cap: 1.0, // キャップ
}

/** T分岐の分岐側の局所損失係数 */
export const TEE_BRANCH_LOSS_COEFFICIENT = 1.0

// ============================================================================
// 純粋計算関数
// ============================================================================

/**
 * 矩形ダクトの等価直径（水力直径）を算出する (REQ-1001)
 * Dh = 2 × width × height / (width + height)
 * @param widthM - ダクト幅 (m)
 * @param heightM - ダクト高さ (m)
 * @returns 等価直径 (m)
 */
export function calcEquivalentDiameter(widthM: number, heightM: number): number {
  return (2 * widthM * heightM) / (widthM + heightM)
}

/**
 * ダルシー・ワイスバッハ式で直管圧損を算出する (REQ-1001, REQ-1003)
 * ΔP = λ × (L / Dh) × (ρ × v² / 2)
 * @param length - ダクト長さ (m)
 * @param widthM - ダクト幅 (m)
 * @param heightM - ダクト高さ (m)
 * @param airflowRateM3h - 風量 (m³/h)
 * @param material - ダクト材質 ('galvanized_steel' | 'flexible' | ...)
 * @returns 直管圧損 (Pa)
 */
export function calcStraightDuctLoss(
  length: number,
  widthM: number,
  heightM: number,
  airflowRateM3h: number,
  material: string,
): number {
  if (length <= 0 || widthM <= 0 || heightM <= 0 || airflowRateM3h <= 0) return 0

  const q = airflowRateM3h / 3600 // m³/s
  const area = widthM * heightM // m²
  const v = q / area // m/s（風速）
  const dh = calcEquivalentDiameter(widthM, heightM) // m

  // flexible 材質: 摩擦係数を4倍 (REQ-1003)
  const lambda =
    material === 'flexible' ? LAMBDA_GALVANIZED * LAMBDA_FLEXIBLE_MULTIPLIER : LAMBDA_GALVANIZED

  // ΔP = λ × (L / Dh) × (ρ × v² / 2)
  return lambda * (length / dh) * ((AIR_DENSITY_KG_M3 * v * v) / 2)
}

/**
 * 継手の局所損失を算出する (REQ-1002)
 * ΔP_local = ζ × (ρ × v² / 2)
 * @param fittingType - 継手タイプ ('elbow' | 'tee' | etc.)
 * @param localLossCoefficient - ノードに設定された局所損失係数（未知の fittingType に使用）
 * @param velocityMs - 通過風速 (m/s)
 * @returns 局所損失 (Pa)
 */
export function calcFittingLoss(
  fittingType: string,
  localLossCoefficient: number,
  velocityMs: number,
): number {
  const zeta = FITTING_LOSS_COEFFICIENTS[fittingType] ?? localLossCoefficient
  return zeta * ((AIR_DENSITY_KG_M3 * velocityMs * velocityMs) / 2)
}

/**
 * システムグラフの全経路を DFS で探索し、各 Diffuser への圧損累積値を返す (REQ-1004)
 * @param systemId - 対象 System ID
 * @param nodes - シーン全ノード辞書
 * @returns 各 Diffuser への経路圧損 (Pa) の Map（diffuserId → 累積圧損）
 */
export function calcAllPathPressureLosses(
  systemId: string,
  nodes: Record<string, AnyNode>,
): Map<string, number> {
  const result = new Map<string, number>()
  const graph = buildSystemGraph(systemId, nodes)

  if (!graph.root) return result

  // サイクル検出（サイクルがあれば計算スキップ）
  const cycleResult = detectCycles(graph)
  if (cycleResult.hasCycle) return result

  // DFS で AHU から各 Diffuser への累積圧損を計算
  const cumulativeLoss = new Map<string, number>()
  cumulativeLoss.set(graph.root, 0)

  traverseDFS(graph, graph.root, (nodeId, _depth): boolean | undefined => {
    const currentLoss = cumulativeLoss.get(nodeId) ?? 0
    const graphNode = graph.nodes.get(nodeId)
    if (!graphNode) return undefined

    for (const neighborId of graphNode.neighbors) {
      if (cumulativeLoss.has(neighborId)) continue // 訪問済み（上流方向）

      const neighborNode = nodes[neighborId]
      if (!neighborNode) continue

      let addedLoss = 0

      if (neighborNode.type === 'duct_segment') {
        // 直管圧損
        const seg = neighborNode
        if (seg.width && seg.height && seg.airflowRate) {
          const length = calcSegmentLength(seg.start, seg.end)
          addedLoss = calcStraightDuctLoss(
            length,
            seg.width / 1000,
            seg.height / 1000,
            seg.airflowRate,
            seg.ductMaterial,
          )
        }
      } else if (neighborNode.type === 'duct_fitting') {
        // 継手損失 — 通過風速は隣接セグメントから取得
        const fitting = neighborNode
        const v = getFittingVelocity(neighborId, graph.root!, nodes, graph)
        addedLoss = calcFittingLoss(fitting.fittingType, fitting.localLossCoefficient, v)
      }

      cumulativeLoss.set(neighborId, currentLoss + addedLoss)

      // Diffuser に到達したら記録
      if (neighborNode.type === 'diffuser') {
        result.set(neighborId, currentLoss + addedLoss)
      }
    }
    return undefined
  })

  return result
}

/**
 * 全経路の最大圧損（最遠経路の圧損）を返す (REQ-1004)
 * @param pathLosses - 各 Diffuser への圧損 Map
 * @returns 最大圧損 (Pa)
 */
export function findMaxPathPressureLoss(pathLosses: Map<string, number>): number {
  if (pathLosses.size === 0) return 0
  return Math.max(...pathLosses.values())
}

/**
 * 最遠経路圧損から AHU 必要送風静圧を算出する (REQ-1004)
 * requiredFanPressure = 最遠経路総圧損 × 安全率（1.1）
 * @param maxPathLossPa - 最遠経路の総圧損 (Pa)
 * @returns 必要送風静圧 (Pa)
 */
export function calcRequiredFanPressure(maxPathLossPa: number): number {
  return maxPathLossPa * FAN_PRESSURE_SAFETY_FACTOR
}

/**
 * dirty ノードから PressureLossSystem が再計算すべき systemId を収集する
 * @param dirtyIds - 変更のあったノード ID セット
 * @param nodes - シーン全ノード辞書
 * @returns 再計算が必要な systemId の Set
 */
export function findDirtySystemsForPressureLoss(
  dirtyIds: Set<string>,
  nodes: Record<string, AnyNode>,
): Set<string> {
  const systemIds = new Set<string>()

  for (const dirtyId of dirtyIds) {
    const node = nodes[dirtyId]
    if (!node) continue

    if (
      node.type === 'duct_segment' ||
      node.type === 'duct_fitting' ||
      node.type === 'ahu' ||
      node.type === 'diffuser'
    ) {
      const nodeWithSystem = node as AnyNode & { systemId: string }
      if (nodeWithSystem.systemId) {
        systemIds.add(nodeWithSystem.systemId)
      }
    }
  }

  return systemIds
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** 2点間のユークリッド距離 (m) */
function calcSegmentLength(start: [number, number, number], end: [number, number, number]): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * 継手の通過風速を算出する（隣接 DuctSegment の風速を使用）
 * 該当する隣接セグメントが見つからない場合は 0 を返す
 */
function getFittingVelocity(
  fittingId: string,
  rootId: string,
  nodes: Record<string, AnyNode>,
  graph: ReturnType<typeof buildSystemGraph>,
): number {
  const fittingGraphNode = graph.nodes.get(fittingId)
  if (!fittingGraphNode) return 0

  // 上流側（rootId 方向）の隣接 DuctSegment を探す
  for (const neighborId of fittingGraphNode.neighbors) {
    const neighborNode = nodes[neighborId]
    if (!neighborNode || neighborNode.type !== 'duct_segment') continue
    if (!neighborNode.width || !neighborNode.height || !neighborNode.airflowRate) continue

    const area = (neighborNode.width / 1000) * (neighborNode.height / 1000)
    return neighborNode.airflowRate / 3600 / area
  }

  return 0
}
