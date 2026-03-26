/**
 * 【機能概要】: ポリゴン面積算出ユーティリティ（Shoelace formula）
 * 【実装方針】: Shoelace formula（ガウスの面積公式）を用いた純粋関数として実装。
 *              頂点の順序（時計回り/反時計回り）に依存しないよう Math.abs で絶対値化する。
 * 【テスト対応】: TASK-0013 polygon-area.test.ts の全14テストケースを通すための実装
 * 🔵 信頼性レベル: TASK-0013 単体テスト要件「テスト1〜4」および実装詳細セクション3に明示
 */

/**
 * 【機能概要】: Shoelace formula（ガウスの面積公式）でポリゴン面積を算出する
 * 【実装方針】: O(n) の単純なループで計算。Math.abs により頂点順序に依存しない。
 * 【テスト対応】: テスト1〜14 すべての面積算出テストに対応
 * 🔵 信頼性レベル: TASK-0013 実装詳細セクション3（Shoelace formula）に明示
 * @param vertices - ポリゴンの頂点列（{x, y} 形式、2D座標）
 * @returns 面積 (m²)。頂点数 < 3 の場合は 0 を返す
 */
export function calculatePolygonArea(vertices: { x: number; y: number }[]): number {
  // 【入力値検証】: ポリゴンを形成するには最低3頂点が必要。不足の場合は0を返す
  // 🔵 信頼性レベル: TASK-0013 単体テスト要件「テスト3」（頂点不足）に明示
  if (vertices.length < 3) return 0

  // 【Shoelace formula 計算開始】: 各辺の外積の総和を算出する
  // 🔵 信頼性レベル: TASK-0013 実装詳細セクション3のコードに明示
  let area = 0
  const n = vertices.length

  for (let i = 0; i < n; i++) {
    // 【インデックス計算】: 末尾頂点の次は先頭に折り返す（閉ポリゴン）
    const j = (i + 1) % n
    const vi = vertices[i]!
    const vj = vertices[j]!
    // 【外積の加算】: x_i * y_j - x_j * y_i の累積
    area += vi.x * vj.y
    area -= vj.x * vi.y
  }

  // 【結果返却】: Math.abs で頂点順序（時計回り/反時計回り）に依存しない正の面積を返す
  // 🔵 信頼性レベル: テスト3（反時計回り）の要件から Math.abs が必要と明示
  return Math.abs(area) / 2
}
