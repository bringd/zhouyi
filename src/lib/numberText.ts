/**
 * 灵数输入框的「原始文本 ⇄ 合法数值」转换。
 *
 * 为什么单独抽出来：输入框要保留用户敲下来的**原始文本**
 * （可能是 '1'、'12'、'099' 这类还没输完或不合法的中间态），
 * 而业务层只认 100–999 的整数。两者必须分开存，
 * 否则「只输了两位」和「没输」会被混成同一个 null。
 *
 * 这一层是纯函数，不碰 DOM 与 React。
 */

/** 灵数最多三位 */
export const NUMBER_TEXT_MAX_DIGITS = 3

/**
 * 过滤非数字字符并截断到三位。
 * 输入框每次 change 都过一遍，保证界面上永远是纯数字。
 */
export function sanitizeNumberText(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, NUMBER_TEXT_MAX_DIGITS)
}

/**
 * 原始文本 → 合法灵数。
 * 空文本、位数不足、位数超出、数值越界一律返回 null。
 */
export function parseNumberText(text: string): number | null {
  if (text === '') return null
  if (!/^\d{1,3}$/.test(text)) return null
  const value = Number(text)
  if (value < 100 || value > 999) return null
  return value
}

/**
 * 合法灵数 → 原始文本（用于回填初始值）。
 * null 表示「还没填」，回填成空串。
 */
export function numberToText(value: number | null): string {
  return value === null ? '' : String(value)
}
