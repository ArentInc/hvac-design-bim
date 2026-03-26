/**
 * 【機能概要】: ゾーン境界ポリゴンと建築参照外壁面の 2D 交差検出
 * 【改善内容】: areCollinear と calcOverlapLength1D の重複計算を排除し、
 *   calcSegmentOverlap として統合。不要な import を整理。
 * 【設計方針】: 2D XY 平面上でゾーン境界の各辺と外壁ラインセグメントの
 *   コリニアな重なり（1D 投影交差）を計算し、PerimeterSegment 配列を返す。
 * 【パフォーマンス】: 元の実装では areCollinear・calcOverlapLength1D で
 *   Math.sqrt・dx/dy 計算を 2 回繰り返していたが、統合により 1 回に削減。
 * 【テスト対応】: TASK-0014 TC-N01〜TC-N04c, TC-B06, TC-B07
 * 🔵 信頼性レベル: REQ-208、TASK-0014 実装詳細に明示的記載
 */

import type { z } from 'zod'
import type { WallMetadata } from '../../loaders/architecture-metadata'
import type { PerimeterSegment } from '../../schema/nodes/hvac-shared'

// 【型定義】: Zod スキーマから PerimeterSegment の TypeScript 型を導出
// 【改善内容】: 型推論専用のため import type を使用（実行時バンドルサイズを削減）🔵
type PerimeterSegmentType = z.infer<typeof PerimeterSegment>

// 【定数定義】: 浮動小数点演算の誤差閾値（単位: m）
// 【調整可能性】: HVAC 設計の精度要件に合わせて 0.001m（1mm）を設定
// 🟡 信頼性レベル: TASK-0014 注意事項「イプシロン 0.001m」に基づく
const EPSILON = 0.001

// 【内部型定義】: 2D 点の型エイリアス（可読性向上のため）
type Point2D = [number, number]

// 【内部型定義】: 2D ラインセグメントの型エイリアス
type Edge2D = [Point2D, Point2D]

/**
 * 【機能概要】: ゾーン境界ポリゴンと建築参照外壁面の 2D 交差検出
 * 【設計方針】: ゾーン境界の各辺と外壁ラインセグメントが同一直線上にある場合、
 *   1D 投影での重なり長さを計算して PerimeterSegment を生成する。
 * 【保守性】: 純関数として実装し、副作用なし。テストが容易。
 * 🔵 信頼性レベル: REQ-208 に明示的記載
 * @param zoneBoundary HvacZoneNode.boundary（2D ポリゴン頂点座標、XY 平面）
 * @param architectureWalls 建築参照の外壁面メタデータ配列
 * @param wallHeight 壁高さ（m）。HvacZoneNode.ceilingHeight を使用
 * @returns 検出された PerimeterSegment 配列（交差なしの場合は空配列）
 */
export function detectPerimeterSegments(
  zoneBoundary: Point2D[],
  architectureWalls: WallMetadata[],
  wallHeight: number,
): PerimeterSegmentType[] {
  // 【入力値検証】: 空の architectureWalls に対して安全に空配列を返す（TC-B07）
  if (architectureWalls.length === 0) {
    return []
  }

  // 【入力値検証】: 空のゾーン境界に対して安全に空配列を返す（防御的実装）
  // 🟡 信頼性レベル: 一般的な防御的プログラミングパターン
  if (zoneBoundary.length < 3) {
    return []
  }

  // 【ゾーン境界辺の抽出】: ポリゴン頂点配列から各辺（ラインセグメント）を生成
  // 例: [p0, p1, p2, p3] → [p0-p1, p1-p2, p2-p3, p3-p0]
  const zoneEdges = extractZoneEdges(zoneBoundary)

  // 【結果配列の初期化】: 検出されたセグメントを格納する配列
  const result: PerimeterSegmentType[] = []

  // 【外壁面の反復処理】: 各外壁面とゾーン境界の各辺を照合する
  for (const wall of architectureWalls) {
    // 【外壁ラインセグメントの取得】: vertices の最初と最後の点から 2D ラインを取得
    // 頂点が 2 点未満の外壁は形状が不正なためスキップ
    if (wall.vertices.length < 2) {
      continue
    }

    // 【型安全性】: noUncheckedIndexedAccess に対応するため non-null assertion を使用
    // vertices.length >= 2 の事前チェック済みのため安全
    const wallStart: Point2D = [wall.vertices[0]!.x, wall.vertices[0]!.y]
    const wallEnd: Point2D = [
      wall.vertices[wall.vertices.length - 1]!.x,
      wall.vertices[wall.vertices.length - 1]!.y,
    ]

    // 【ゾーン辺との照合】: 各ゾーン辺に対して外壁との重なりを確認
    // 最大重なり長さを記録（複数のゾーン辺に跨る外壁に対応）
    let maxOverlap = 0

    for (const edge of zoneEdges) {
      // 【統合処理】: コリニア判定と重なり長さ計算を 1 回の sqrt で実施（改善点）
      const overlapLength = calcSegmentOverlap(edge, [wallStart, wallEnd])

      if (overlapLength > maxOverlap) {
        maxOverlap = overlapLength
      }
    }

    // 【イプシロンフィルタ】: 微小な重なり（浮動小数点誤差レベル）は除外する（TC-B06）
    if (maxOverlap <= EPSILON) {
      continue
    }

    // 【PerimeterSegment 生成】: 重なり長さ × 壁高さで wallArea を計算（TC-N01b）
    // glazingRatio は建築参照データからそのまま引き継ぐ
    result.push({
      orientation: wall.orientation,
      wallArea: maxOverlap * wallHeight,
      glazingRatio: wall.glazingRatio,
    })
  }

  return result
}

/**
 * 【機能概要】: ポリゴン頂点配列からゾーン境界の各辺を抽出する
 * 【設計方針】: 連続する頂点ペアと、最後の頂点から最初の頂点へ閉じる辺を生成
 * 【単一責任】: ポリゴンの辺抽出のみを担当する純関数
 * 🔵 信頼性レベル: 標準的なポリゴン処理パターン
 * @param boundary ポリゴン頂点配列（3点以上を前提とする）
 * @returns 辺の配列。各辺は [[x0, y0], [x1, y1]] の形式
 */
function extractZoneEdges(boundary: Point2D[]): Edge2D[] {
  // 【辺の抽出】: n 頂点から n 辺を生成（ポリゴンを閉じる）
  // i 番目の辺: boundary[i] → boundary[(i+1) % n]（最後は最初に戻る）
  // 【型安全性】: boundary.length >= 3 の事前チェック済みのため非 undefined が保証される
  const edges: Edge2D[] = []
  for (let i = 0; i < boundary.length; i++) {
    const start = boundary[i] as Point2D
    const end = boundary[(i + 1) % boundary.length] as Point2D
    edges.push([start, end])
  }
  return edges
}

/**
 * 【機能概要】: 2 つのラインセグメントがコリニアな場合の重なり長さを計算する
 * 【改善内容】: Green フェーズの areCollinear と calcOverlapLength1D を統合。
 *   dx/dy/len の計算を 1 回のみ実施し、Math.sqrt の呼び出しを半減。
 * 【設計方針】: コリニアでない場合は 0 を返し、コリニアな場合は 1D 投影で重なりを計算。
 *   コリニア判定と重なり長さ計算を 1 つの関数に統合することで、
 *   中間結果（len, nx, ny）を再計算せず効率的に処理できる。
 * 【パフォーマンス】: O(1)。Math.sqrt を 1 回、その他の演算は定数回のみ実施。
 * 🟡 信頼性レベル: 標準的な 2D/1D 幾何学アルゴリズムの統合
 * @param edgeA ゾーン境界の辺 [[x0,y0],[x1,y1]]
 * @param edgeB 外壁ラインセグメント [[x0,y0],[x1,y1]]
 * @returns コリニアな場合は重なり長さ（m）、コリニアでない場合は 0
 */
function calcSegmentOverlap(edgeA: Edge2D, edgeB: Edge2D): number {
  const [a0, a1] = edgeA
  const [b0, b1] = edgeB

  // 【方向ベクトルと長さの計算】: edgeA の方向ベクトルを 1 回だけ計算
  const dx = a1[0] - a0[0]
  const dy = a1[1] - a0[1]
  const len = Math.sqrt(dx * dx + dy * dy)

  // 【零ベクトルチェック】: 辺の長さが EPSILON 未満の場合は処理不能
  if (len < EPSILON) {
    return 0
  }

  // 【コリニア判定】: edgeB の両端点が edgeA の直線上にあるか確認
  // 外積の絶対値 = 点と直線の距離 × 直線長さ（正規化する前の外積）
  // 距離 = |cross| / len で、距離 ≤ EPSILON なら同一直線上と判定
  const cross0 = Math.abs((b0[0] - a0[0]) * dy - (b0[1] - a0[1]) * dx)
  const cross1 = Math.abs((b1[0] - a0[0]) * dy - (b1[1] - a0[1]) * dx)

  if (cross0 > EPSILON * len || cross1 > EPSILON * len) {
    // 【非コリニア】: edgeB が edgeA の直線上にない → 重なりなし
    return 0
  }

  // 【1D 射影】: edgeA の方向（単位ベクトル）に各端点を射影してスカラー値を取得
  // edgeA 自体は t ∈ [0, len] の区間として表現
  const nx = dx / len
  const ny = dy / len

  const tB0 = (b0[0] - a0[0]) * nx + (b0[1] - a0[1]) * ny
  const tB1 = (b1[0] - a0[0]) * nx + (b1[1] - a0[1]) * ny

  // 【区間の正規化】: edgeB の射影区間 [bLo, bHi] を定義
  const bLo = Math.min(tB0, tB1)
  const bHi = Math.max(tB0, tB1)

  // 【1D 重なり計算】: [0, len] と [bLo, bHi] の重なり区間を計算
  // overlapLo = max(0, bLo)、overlapHi = min(len, bHi)
  const overlapLo = Math.max(0, bLo)
  const overlapHi = Math.min(len, bHi)

  // 【重なり長さの返却】: 重なりがない場合（overlapHi ≤ overlapLo）は 0 を返す
  return Math.max(0, overlapHi - overlapLo)
}
