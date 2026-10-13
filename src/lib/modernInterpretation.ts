/**
 * Content contract for `Hexagram.modernInterpretation`.
 *
 * Single source of truth shared by:
 *   - `tests/lib/modernInterpretation.test.ts`  (unit tests for the rules)
 *   - `tests/data/hexagrams-structure.test.ts`  (applied to all 64 entries)
 *   - `scripts/fill-modern-interpretations.mjs` (gates generated content
 *     before it is written to hexagrams.json)
 *
 * The generator importing this module is what keeps the writer and the test
 * from drifting apart: a rule change lands in exactly one place.
 *
 * Spec basis — `docs/superpowers/specs/2026-06-02-zhouyi-website-design.md`
 * §3.2 (`src/types/hexagram.ts`): `modernInterpretation: string; // 现代解读 200-300 字`.
 *
 * Pure: no I/O, no side effects.
 */

export const MODERN_INTERPRETATION_MIN_LEN = 200
export const MODERN_INTERPRETATION_MAX_LEN = 300

/**
 * The four entries id 1-4 shipped with the project as hand-written copy and
 * define the target style. They are exempt from the lower length bound
 * (id 1 乾为天 is 170 字) because replacing authorial text with generated
 * text would be a content regression. Everything else must meet the spec.
 */
export const HAND_WRITTEN_INTERPRETATION_IDS: ReadonlySet<number> = new Set([1, 2, 3, 4])

/**
 * The closing formula every entry ends with:
 *   读X卦者，宜取其……，去其……，方为得卦之真意。
 * Tolerant about punctuation between 卦者 and the final clause, because the
 * generator sometimes emits it as two sentences.
 */
export const CLOSING_FORMULA_AT_END =
  /读\s*[^，。]{0,8}卦者[，,][\s\S]{0,120}方为得卦之真意。\s*$/

/** Markers left behind when the upstream model answers with a lecture outline. */
const SCAFFOLDING_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(卦象分析|卦象解析|卦象构成)/, 'scaffolding header'],
  [/第\d+卦.{0,12}(现代解读|——)/, 'scaffolding title'],
  [/(卦名|卦象|卦辞|彖传|象传|爻辞)[:：]/, 'field label'],
  [/\d+[.、]\s*(卦象|卦辞|彖传|解读)/, 'numbered section'],
]

/** Noise that must never survive into the rendered prose. */
const NOISE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/#/, 'markdown heading'],
  [/\*/, 'markdown emphasis'],
  [/`/, 'markdown code'],
  [/\|/, 'markdown table'],
  [/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u, 'emoji/symbol glyph'],
  [/[\u4e00-\u9fff]\s*:\s*[\u4e00-\u9fff]/, 'half-width colon'],
]

/**
 * Validate one `modernInterpretation` value.
 *
 * @returns an empty array when the value satisfies the contract, otherwise a
 *   list of human-readable problems (suitable for test failure messages and
 *   for the generator's retry loop).
 */
export function validateModernInterpretation(text: unknown, id?: number): string[] {
  if (typeof text !== 'string' || text.trim() === '') return ['empty']

  const problems: string[] = []
  const isHandWritten = id !== undefined && HAND_WRITTEN_INTERPRETATION_IDS.has(id)

  if (text.length < MODERN_INTERPRETATION_MIN_LEN) {
    // Hand-written copy is held to a looser floor rather than being rewritten.
    if (!isHandWritten) {
      problems.push(`too short (${text.length} < ${MODERN_INTERPRETATION_MIN_LEN})`)
    } else if (text.length < 150) {
      problems.push(`too short (${text.length} < 150)`)
    }
  }
  if (text.length > MODERN_INTERPRETATION_MAX_LEN) {
    problems.push(`too long (${text.length} > ${MODERN_INTERPRETATION_MAX_LEN})`)
  }

  // Layer 3 — the closing formula.
  if (!CLOSING_FORMULA_AT_END.test(text)) problems.push('missing/truncated closing formula')

  // Layer 2 — at least one applied-life axis.
  if (!/(事业|职场|工作|人生|人际|交往|处世|做事|为人)/.test(text)) {
    problems.push('missing life-application layer')
  }

  for (const [re, label] of SCAFFOLDING_PATTERNS) if (re.test(text)) problems.push(label)
  for (const [re, label] of NOISE_PATTERNS) if (re.test(text)) problems.push(label)
  if (text.includes(' ')) problems.push('ascii space')
  if (text.includes('\n')) problems.push('newline')

  return problems
}
