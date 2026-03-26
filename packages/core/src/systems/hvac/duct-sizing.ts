/**
 * TASK-0032: DuctSizingSystem — ダクト寸法選定 純粋計算関数群
 *
 * 【機能概要】: 等速法（Equal Velocity Method）でダクト断面寸法を自動決定する
 * 【設計方針】: React/Three.js 非依存の純粋関数として実装（テスタビリティ重視）
 * 【対応要件】: REQ-901（等速法寸法選定）, REQ-902（推奨風速）, REQ-903（アスペクト比制約）
 * 🔵 信頼性レベル: TASK-0032 実装詳細に基づく
 */

import standardDuctSizes from '../../data/standard-duct-sizes.json'
import type { AnyNode } from '../../schema/types'
import { buildSystemGraph } from '../../utils/hvac-graph'

// ============================================================================
// 標準寸法表の構築
// ============================================================================

/**
 * 矩形ダクトの標準個別寸法リスト (mm)
 * rectangular.width ∪ rectangular.height から重複排除・昇順ソート
 */
const STANDARD_DIMS_MM: number[] = Array.from(
  new Set([
    ...standardDuctSizes.rectangular.map((s) => s.width),
    ...standardDuctSizes.rectangular.map((s) => s.height),
  ]),
).sort((a, b) => a - b)

// ============================================================================
// 定数 (REQ-902)
// ============================================================================

/** 幹線推奨風速 7 m/s（範囲 6~8 m/s の中央値） */
export const MAIN_DUCT_VELOCITY_MS = 7

/** 枝線推奨風速 4 m/s（範囲 3~5 m/s の中央値） */
export const BRANCH_DUCT_VELOCITY_MS = 4

/** アスペクト比上限 (REQ-903) */
export const MAX_ASPECT_RATIO = 4.0

// ============================================================================
// 型定義
// ============================================================================

export interface DuctSizeResult {
  /** 幅 (mm) */
  width: number
  /** 高さ (mm) */
  height: number
}

// ============================================================================
// 純粋計算関数
// ============================================================================

/**
 * 単一寸法を標準サイズ表にスナップする（対象値以上の最小標準寸法を選択）(REQ-902)
 * @param mm - スナップ前の寸法 (mm)
 * @returns スナップ後の標準寸法 (mm)
 */
export function snapToStandardDim(mm: number): number {
  const found = STANDARD_DIMS_MM.find((d) => d >= mm)
  return found ?? STANDARD_DIMS_MM[STANDARD_DIMS_MM.length - 1]!
}

/**
 * アスペクト比 ≤ 4.0 制約を適用し、超過する場合は短辺を拡大してスナップ (REQ-903)
 * @param width - 幅 (mm)
 * @param height - 高さ (mm)
 * @returns アスペクト比制約を満たす {width, height}
 */
export function applyAspectRatioConstraint(width: number, height: number): DuctSizeResult {
  const longSide = Math.max(width, height)
  const shortSide = Math.min(width, height)

  if (longSide / shortSide <= MAX_ASPECT_RATIO) {
    return { width, height }
  }

  // 短辺を ratio ≤ 4.0 に必要な最小値に拡大してスナップ
  const requiredShort = longSide / MAX_ASPECT_RATIO
  const snappedShort = snapToStandardDim(requiredShort)

  return width >= height ? { width, height: snappedShort } : { width: snappedShort, height }
}

/**
 * 等速法で断面積を算出し、標準サイズにスナップした矩形寸法を返す (REQ-901)
 * @param airflowRateM3h - 風量 (m³/h)
 * @param velocityMs - 目標風速 (m/s)
 * @returns スナップ済みの {width, height}、風量ゼロ以下は null
 */
export function calcDuctSize(airflowRateM3h: number, velocityMs: number): DuctSizeResult | null {
  if (airflowRateM3h <= 0) return null

  const q = airflowRateM3h / 3600 // m³/h → m³/s
  const area = q / velocityMs // m² = Q / v （REQ-901）
  const sideMm = Math.sqrt(area) * 1000 // 正方形に近い比率を優先（アスペクト比最小化）

  const rawWidth = snapToStandardDim(sideMm)
  const rawHeight = snapToStandardDim(sideMm)

  return applyAspectRatioConstraint(rawWidth, rawHeight)
}

/**
 * セグメントがAHU直近（幹線）か判定し、推奨風速を返す (REQ-902)
 * AHU の隣接ノードに segmentId が含まれる場合 → 幹線風速 7 m/s
 * @param segmentId - 判定対象 DuctSegment ID
 * @param systemId - 所属 System ID
 * @param nodes - シーン全ノード辞書
 * @returns 推奨風速 (m/s)
 */
export function selectDuctVelocity(
  segmentId: string,
  systemId: string,
  nodes: Record<string, AnyNode>,
): number {
  const graph = buildSystemGraph(systemId, nodes)
  if (!graph.root) return BRANCH_DUCT_VELOCITY_MS

  const ahuGraphNode = graph.nodes.get(graph.root)
  if (!ahuGraphNode) return BRANCH_DUCT_VELOCITY_MS

  return ahuGraphNode.neighbors.includes(segmentId)
    ? MAIN_DUCT_VELOCITY_MS
    : BRANCH_DUCT_VELOCITY_MS
}

/**
 * dirtyNodes から寸法選定が必要な DuctSegment ID を抽出する
 * 条件: type=duct_segment かつ airflowRate > 0
 * @param dirtyIds - 変更のあったノード ID セット
 * @param nodes - シーン全ノード辞書
 * @returns 寸法選定対象の DuctSegment ID 配列
 */
export function findDirtyDuctSegmentsForSizing(
  dirtyIds: Set<string>,
  nodes: Record<string, AnyNode>,
): string[] {
  return Array.from(dirtyIds).filter((id) => {
    const node = nodes[id]
    if (!node || node.type !== 'duct_segment') return false
    const seg = node as AnyNode & { airflowRate: number | null }
    return seg.airflowRate != null && seg.airflowRate > 0
  })
}
