import { describe, it, expect } from 'vitest'
import { renderCardSvg, cardDataFromIds } from '@/lib/imageGen'

describe('imageGen', () => {
  describe('renderCardSvg', () => {
    it('produces a self-contained SVG document', () => {
      const data = cardDataFromIds({ mainId: 1 })
      expect(data).not.toBeNull()
      const svg = renderCardSvg(data!)
      expect(svg).toMatch(/^<\?xml/)
      expect(svg).toMatch(/<svg /)
      expect(svg).toMatch(/<\/svg>$/)
    })

    it('includes the main hexagram name', () => {
      const data = cardDataFromIds({ mainId: 1 }) // 乾为天
      const svg = renderCardSvg(data!)
      expect(svg).toContain('乾为天')
    })

    it('renders 6 yang rects for 乾 (binary 111111)', () => {
      const data = cardDataFromIds({ mainId: 1 })
      const svg = renderCardSvg(data!)
      const rectCount = (svg.match(/<rect /g) ?? []).length
      // hero background 1 + 6 yang fills + 6 highlights = 13 rects
      expect(rectCount).toBeGreaterThanOrEqual(13)
    })

    it('renders 12 yin rects for 坤 (binary 000000)', () => {
      const data = cardDataFromIds({ mainId: 2 }) // 坤为地
      const svg = renderCardSvg(data!)
      const rectCount = (svg.match(/<rect /g) ?? []).length
      // hero background 1 + 12 yin fills (2 segments x 6) + 12 highlights = 25 rects
      expect(rectCount).toBeGreaterThanOrEqual(25)
    })

    it('uses gold fill for hexagram body', () => {
      const data = cardDataFromIds({ mainId: 1 })
      const svg = renderCardSvg(data!)
      expect(svg).toMatch(/fill="#C89E3A"/)
    })

    it('renders 5 inter-line separators', () => {
      const data = cardDataFromIds({ mainId: 1 })
      const svg = renderCardSvg(data!)
      // Each separator uses shadowInk stroke; expect exactly 5
      expect((svg.match(/stroke="rgba\(26,26,26,0\.12\)"/g) ?? []).length).toBe(5)
    })

    it('omits AI summary section when not provided', () => {
      const data = cardDataFromIds({ mainId: 1 })
      const svg = renderCardSvg(data!)
      expect(svg).not.toContain('AI 解 读')
    })

    it('includes AI summary when provided', () => {
      const data = cardDataFromIds({ mainId: 1, aiSummary: '乾卦纯阳之象' })
      const svg = renderCardSvg(data!)
      expect(svg).toContain('AI 解 读')
      expect(svg).toContain('乾卦纯阳之象')
    })

    it('includes 感言 when provided', () => {
      const data = cardDataFromIds({ mainId: 1, userNote: '把握当下' })
      const svg = renderCardSvg(data!)
      expect(svg).toContain('感 言')
      expect(svg).toContain('把握当下')
    })

    it('escapes XML special characters in text', () => {
      const data = cardDataFromIds({
        mainId: 1,
        aiSummary: 'Use <tags> & "quotes"',
        userNote: "It's a test",
      })
      const svg = renderCardSvg(data!)
      expect(svg).toContain('&lt;tags&gt;')
      expect(svg).toContain('&amp;')
      expect(svg).toContain('&quot;')
      // Single quotes aren't escaped to &apos; for compat with most
      // SVG parsers — the unescaped form is fine.
    })

    it('includes a watermark footer', () => {
      const data = cardDataFromIds({ mainId: 1 })
      const svg = renderCardSvg(data!)
      expect(svg).toContain('易象阁')
    })

    it('includes the moving-line + changed-hexagram section when both provided', () => {
      // Use a fixed pair (main=1 乾为天, changed=2 坤为地) and check
      // against the actual names resolved from the static JSON.
      const data = cardDataFromIds({
        mainId: 1,
        changedId: 2,
        movingLine: 3,
      })
      expect(data).not.toBeNull()
      const svg = renderCardSvg(data!)
      expect(svg).toContain('动 · 第 3 爻')
      expect(svg).toContain('→')
      // The changed hex name is whatever hex id 2 resolves to
      expect(svg).toContain(data!.changed!.name)
    })
  })

  describe('cardDataFromIds', () => {
    it('returns null for an invalid main id', () => {
      expect(cardDataFromIds({ mainId: 999 as never })).toBeNull()
    })

    it('returns a CardData with just main hex for a bare call', () => {
      const data = cardDataFromIds({ mainId: 1 })
      expect(data).not.toBeNull()
      expect(data!.main.id).toBe(1)
      expect(data!.changed).toBeUndefined()
      expect(data!.movingLine).toBeUndefined()
    })

    it('passes through changed + movingLine + summary + note + timestamp', () => {
      const data = cardDataFromIds({
        mainId: 1,
        changedId: 2,
        movingLine: 3,
        aiSummary: 'X',
        userNote: 'Y',
        timestamp: '2026-06-15 14:30',
      })
      expect(data).toMatchObject({
        changed: { id: 2 },
        movingLine: 3,
        aiSummary: 'X',
        userNote: 'Y',
        timestamp: '2026-06-15 14:30',
      })
    })
  })
})
