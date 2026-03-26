// 【機能概要】: 負荷値（W）をPRDセクション21.5フォーマット（REQ-1505）に変換するユーティリティ
// 【実装方針】: 1000W以上はkW表記（小数点1桁）、1000W未満はW表記（整数）
// 🔵 信頼性レベル: requirements.md 2.2、REQ-1505に明示

/**
 * 【機能概要】: ワット値を表示用文字列にフォーマットする
 * 【実装方針】: テストケースの期待値に合わせた最小実装
 * 【テスト対応】: format-load.test.ts 全8テスト
 * 🔵 信頼性レベル: requirements.md エッジ5「1000W境界値はkW表記」に明示
 * @param watts - ワット数（数値）
 * @returns フォーマット済み文字列（例: '17.4 kW', '800 W'）
 */
export function formatLoad(watts: number): string {
  // 【分岐処理】: 1000W以上はkW表記、未満はW表記（REQ-1505）
  if (watts >= 1000) {
    // 【kW変換】: 1000で除算してtoFixed(1)で小数点1桁固定
    return `${(watts / 1000).toFixed(1)} kW`
  }
  // 【W表記】: 整数表示（Math.roundで端数処理）
  return `${Math.round(watts)} W`
}
