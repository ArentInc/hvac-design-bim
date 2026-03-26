/**
 * TASK-0044: HVAC表示カラー定数 — REQ-1501〜1503準拠
 *
 * 【設計方針】: Viewer隔離ルールに従い、カラー定数はcoreパッケージで一元管理。
 *             viewerパッケージはこのファイルからimportして使用する。
 * 【対応要件】: REQ-1501（ゾーンカラー）, REQ-1503（配管色）, REQ-1505（右パネルフォーマット）
 */

// ============================================================================
// ゾーン用途別カラー (REQ-1501)
// ============================================================================

/** ゾーン用途別フロアカラーマップ */
export const ZONE_USAGE_COLORS: Record<string, string> = {
  office_general: '#42A5F5', // 事務室 — 青系
  conference: '#FFA726', // 会議室 — オレンジ系
  reception: '#66BB6A', // 受付 — 緑系
  office_server: '#EF5350', // サーバー室 — 赤系
  corridor: '#BDBDBD', // 廊下/共用部 — グレー系
}

/** 負荷未計算状態のデフォルトカラー */
export const ZONE_DEFAULT_COLOR = '#9E9E9E'

/**
 * ゾーン用途からフロアカラーを返す純粋関数 (REQ-1501)
 * @param usage - ZoneUsage値（'office_general', 'conference', etc.）
 * @returns HEXカラー文字列
 */
export function getZoneColorByUsage(usage: string): string {
  return ZONE_USAGE_COLORS[usage] ?? ZONE_DEFAULT_COLOR
}

// ============================================================================
// 右パネル数値フォーマット (REQ-1505, PRDセクション21.5)
// ============================================================================

/**
 * HVAC負荷値を右パネル表示フォーマットに変換する
 * @param value - 負荷値 (W)
 * @returns 「12,346 W」形式（整数・カンマ区切り・単位付き）
 */
export function formatHvacLoadValue(value: number): string {
  return `${Math.round(value).toLocaleString('ja-JP')} W`
}
