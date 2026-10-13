import { describe, it, expect } from 'vitest'
import {
  validateModernInterpretation,
  MODERN_INTERPRETATION_MIN_LEN,
  MODERN_INTERPRETATION_MAX_LEN,
} from '@/lib/modernInterpretation'

/** The hand-written id=3 水雷屯 reference text, verbatim. */
const REFERENCE_3 =
  '屯者，盈也、物之初生也。屯卦上坎下震，象征云雷交作、天地初开之艰难。此卦昭示：万事开头难，凡事初创之时必然经历一段混沌与困顿。在事业层面，屯卦提示勿急于求成，宜稳扎稳打、聚拢人心、借势而起。在人生起步阶段，则提醒积蓄力量、广结善缘，等待时机成熟。在困境中，最忌盲目冒进与孤立无援；最宜守持正固、寻求合作。此卦之要在于明辨难与机——大难之中往往蕴藏大机，唯有心怀远见、沉着应对者，方能转危为安。读屯卦者，宜取其坚韧不拔的毅力，去其犹豫不决的迟疑，方为得卦之真意。'

const TAIL = '读屯卦者，宜取其坚韧不拔的毅力，去其犹豫不决的迟疑，方为得卦之真意。'
/** head carrying a deliberate layer-2 keyword so unrelated rules stay quiet. */
const HEAD = '屯者，盈也、物之初生也。在事业层面，宜稳扎稳打、聚拢人心。在人生阶段，宜积蓄力量。'

/**
 * Build an entry of EXACTLY `total` 字: `head`, then Chinese filler, then
 * `tail`. Keeping the tail last is the point — the closing formula is
 * anchored at the end of the string, so padding after it would silently
 * invalidate every fixture.
 */
function mk(head: string, tail: string, total: number): string {
  const filler = Math.max(0, total - head.length - tail.length)
  const out = head + '甲'.repeat(filler) + tail
  if (out.length !== total) {
    throw new Error(`fixture sized ${out.length}, expected ${total}`)
  }
  return out
}

describe('validateModernInterpretation', () => {
  it('accepts the hand-written reference text', () => {
    expect(validateModernInterpretation(REFERENCE_3, 3)).toEqual([])
  })

  it('rejects empty / non-string input', () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
      expect(validateModernInterpretation(bad), String(bad)).toEqual(['empty'])
    }
  })

  it(`rejects a generated entry shorter than ${MODERN_INTERPRETATION_MIN_LEN} 字`, () => {
    expect(validateModernInterpretation(mk(HEAD, TAIL, 199), 10)).toEqual(['too short (199 < 200)'])
  })

  it('applies a looser floor to the hand-written entries (id 1 乾为天 is 170 字)', () => {
    const qianHead = '乾为天，纯阳之卦，象征刚健、创造、领导之力。在事业层面，提示主动进取、自强不息。'
    const qianTail = '读乾卦者，宜取其刚健不息的进取心，去其刚愎自用的偏执，方为得卦之真意。'
    const qian170 = mk(qianHead, qianTail, 170)
    expect(qian170.length).toBe(170)
    // Exempt by id …
    expect(validateModernInterpretation(qian170, 1)).toEqual([])
    // … but the very same text, treated as generated, is rejected.
    expect(validateModernInterpretation(qian170, 10)).toEqual(['too short (170 < 200)'])
    // … and the exemption is still floored.
    expect(validateModernInterpretation(mk(HEAD, TAIL, 149), 1)).toEqual(['too short (149 < 150)'])
  })

  it(`rejects anything longer than ${MODERN_INTERPRETATION_MAX_LEN} 字`, () => {
    expect(validateModernInterpretation(mk(HEAD, TAIL, 301), 10)).toEqual(['too long (301 > 300)'])
  })

  it('rejects a missing closing formula', () => {
    expect(validateModernInterpretation(mk(HEAD, '', 240), 10)).toEqual([
      'missing/truncated closing formula',
    ])
  })

  it('rejects a TRUNCATED closing formula — the bug that once shipped', () => {
    // Cut right after "去其…，": the half-clause that a weaker check accepted.
    const truncatedTail = '读屯卦者，宜取其坚韧不拔的毅力，去其犹豫不决的迟疑，'
    const text = mk(HEAD, truncatedTail, 280)
    expect(text.endsWith('，')).toBe(true)
    expect(validateModernInterpretation(text, 10)).toEqual(['missing/truncated closing formula'])
  })

  it('accepts a closing formula the model split into two sentences', () => {
    const splitTail = '读屯卦者，宜取其坚毅，去其迟疑。方为得卦之真意。'
    expect(validateModernInterpretation(mk(HEAD, splitTail, 240), 10)).toEqual([])
  })

  it('rejects text with no life-application layer', () => {
    const bare = '屯者，盈也、物之初生也。此卦昭示天地初开之艰难，云雷交作而万物始生。'
    expect(validateModernInterpretation(mk(bare, TAIL, 240), 10)).toEqual([
      'missing life-application layer',
    ])
  })

  it.each([
    ['卦象分析卦名：屯（坎上震下）', 'scaffolding header'],
    ['第3卦水雷屯——现代解读', 'scaffolding title'],
    ['卦辞：元亨利贞。', 'field label'],
    ['1.卦象解读：上卦为坎', 'numbered section'],
  ])('rejects lecture-outline scaffolding: %s', (fragment, label) => {
    expect(validateModernInterpretation(mk(fragment + HEAD, TAIL, 280), 10)).toContain(label)
  })

  it.each([
    ['#', 'markdown heading'],
    ['**加粗**', 'markdown emphasis'],
    ['`代码`', 'markdown code'],
    ['| 表格 |', 'markdown table'],
    ['坎卦🡪代表水', 'emoji/symbol glyph'],
    ['坎卦:象征水', 'half-width colon'],
  ])('rejects noise: %s', (fragment, label) => {
    expect(validateModernInterpretation(mk(HEAD + fragment, TAIL, 290), 10)).toContain(label)
  })

  it('rejects ascii whitespace inside the prose', () => {
    expect(validateModernInterpretation(mk(HEAD, TAIL, 240) + ' ', 10)).toEqual(['ascii space'])
    expect(validateModernInterpretation(mk(HEAD, TAIL, 240) + '\n', 10)).toEqual(['newline'])
  })

  it('reports every problem at once, not just the first', () => {
    // Short, no closing, no life layer, scaffolding, markdown, half-width colon.
    const awful = '# 卦象分析卦名：屯（坎上震下）坎卦:象征水。'
    const problems = validateModernInterpretation(awful, 10)
    expect(problems.some((p) => p.startsWith('too short'))).toBe(true)
    expect(problems).toContain('missing/truncated closing formula')
    expect(problems).toContain('missing life-application layer')
    expect(problems).toContain('scaffolding header')
    expect(problems.length).toBeGreaterThanOrEqual(5)
  })
})
