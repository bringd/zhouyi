import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Seal } from '@/components/ui/Seal'

describe('Seal', () => {
  it('renders text inside the seal', () => {
    const { container } = render(<Seal text="讼" />)
    expect(container.querySelector('text')?.textContent).toBe('讼')
  })

  it('scales font down for multi-character text so it fits in the viewBox', () => {
    // Old bug: 1 char and 3 chars got the same fontSize, so 3-char
    // hexagram names like 天地否 overflowed the 100-unit viewBox and
    // got visually clipped on the right. The new formula divides
    // ~90 viewBox units by character count.
    const { container: c1 } = render(<Seal text="乾" />)
    const { container: c3 } = render(<Seal text="天地否" />)
    const f1 = Number(c1.querySelector('text')?.getAttribute('font-size'))
    const f3 = Number(c3.querySelector('text')?.getAttribute('font-size'))
    expect(f1).toBeGreaterThan(f3)
    // 3 chars at fontSize 30: total text width ≈ 90, fits in 100.
    // 1 char at fontSize 80: visually fills the seal.
    expect(f1).toBeCloseTo(80, 0)
    expect(f3).toBeCloseTo(30, 0)
  })

  it('clamps fontSize for very long text (defensive)', () => {
    // 5+ chars would otherwise produce a tiny font; the min cap
    // keeps it readable. This shouldn't happen in practice (shortName
    // is 1-3 chars) but a malformed data file shouldn't break the UI.
    const { container } = render(<Seal text="天地否泰" />)
    const f = Number(container.querySelector('text')?.getAttribute('font-size'))
    expect(f).toBeGreaterThanOrEqual(15)
  })
})
