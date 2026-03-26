/**
 * 【機能概要】: ポリゴン面積算出ユーティリティ（ZoneDrawTool 用）
 * 【設計方針】: Shoelace formula（ガウスの面積公式）による純粋関数実装。
 *              実装は packages/core に集約するが、editor パッケージ内テストの
 *              インポートパス解決のため、このファイルで関数を直接実装する。
 * 【注意】: packages/core/src/utils/polygon-area.ts と同一ロジック。
 *          アルゴリズム変更は両ファイルを同期すること。
 * 🔵 信頼性レベル: TASK-0013 Shoelace formula 要件に明示
 */

/**
 * 【機能概要】: Shoelace formula（ガウスの面積公式）でポリゴン面積を算出する
 * 【設計方針】: O(n) の単純なループ。Math.abs により頂点順序に依存しない。
 * 【パフォーマンス】: 頂点数に対して線形計算量（O(n)）のため、リアルタイム算出に適する。
 * 🔵 信頼性レベル: TASK-0013 実装詳細セクション3（Shoelace formula）に明示
 * @param vertices - ポリゴンの頂点列（{x, y} 形式、2D座標）
 * @returns 面積 (m²)。頂点数 < 3 の場合は 0 を返す
 */
export function calculatePolygonArea(vertices: { x: number; y: number }[]): number {
  // 【入力値検証】: ポリゴンを形成するには最低3頂点が必要。不足の場合は0を返す
  // 🔵 信頼性レベル: TASK-0013 単体テスト要件「テスト3」（頂点不足）に明示
  if (vertices.length < 3) return 0

  // 【Shoelace formula 計算】: 各辺の外積の総和を算出する
  // 🔵 信頼性レベル: TASK-0013 実装詳細セクション3のコードに明示
  let area = 0
  const n = vertices.length

  for (let i = 0; i < n; i++) {
    // 【インデックス計算】: 末尾頂点の次は先頭に折り返す（閉ポリゴン）
    const j = (i + 1) % n
    // 【外積の累積】: x_i * y_j - x_j * y_i
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }

  // 【結果返却】: Math.abs で頂点順序（時計回り/反時計回り）に依存しない正の面積を返す
  // 🔵 信頼性レベル: テスト3（反時計回り）の要件から Math.abs が必要と明示
  return Math.abs(area) / 2
}
