// 【機能概要】: 負荷値（W）をPRDセクション21.5フォーマット（REQ-1505）に変換するユーティリティ
// 【設計方針】: UI表示専用の純粋関数（副作用なし）。HvacZonePanel/CalcResultPanel両方から参照
// 🔵 信頼性レベル: requirements.md 2.2、REQ-1505に明示

// 【定数定義】: kW変換の閾値（1000W以上はkW表記）
// 【調整可能性】: REQ-1505の仕様変更時はこの値を変更するだけでよい
// 🔵 信頼性レベル: requirements.md 3.4「負荷値: 1000W以上はkW表記」に明示
const KW_THRESHOLD = 1000

/**
 * 【機能概要】: ワット値を表示用文字列にフォーマットする
 * 【改善内容】: KW_THRESHOLD定数を導入してマジックナンバーを排除
 * 【設計方針】: REQ-1505フォーマット仕様の2分岐を明確な条件で実装
 * 【パフォーマンス】: 純粋関数（引数のみに依存）でメモ化が可能
 * 【再利用性】: CalcResultPanel、HvacZonePanelなど複数のUI箇所で利用可能
 * 🔵 信頼性レベル: requirements.md 2.2、エッジ5「1000W境界値はkW表記」、REQ-1505に明示
 * @param watts - ワット数（0以上の数値を想定）
 * @returns フォーマット済み文字列（例: '17.4 kW', '800 W'）
 */
export function formatLoad(watts: number): string {
  // 【kW表記分岐】: KW_THRESHOLD以上はkW単位で表示（REQ-1505）
  if (watts >= KW_THRESHOLD) {
    // 【kW変換】: 1000で除算してtoFixed(1)で小数点1桁固定（'17.4 kW'形式）
    return `${(watts / KW_THRESHOLD).toFixed(1)} kW`
  }
  // 【W表記】: 整数表示（Math.roundで小数点以下を丸める、'800 W'形式）
  return `${Math.round(watts)} W`
}
