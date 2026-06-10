import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Seal } from '@/components/ui/Seal'

describe('Seal', () => {
  it('renders text inside the seal', () => {
    const { container } = render(<Seal text="讼" />)
    expect(container.querySelector('text')?.textContent).toBe('讼')
  })

  it('respects compact prop (smaller text in small seal)', () => {
    // Use size=56 so the two formulas diverge:
    //   default  = max(round(56*0.78), 32) = 44
    //   compact  = 32
    const { container: c1 } = render(<Seal text="讼" size={56} />)
    const { container: c2 } = render(<Seal text="讼" size={56} compact />)
    const f1 = c1.querySelector('text')?.getAttribute('font-size')
    const f2 = c2.querySelector('text')?.getAttribute('font-size')
    expect(f1).not.toBe(f2)
  })
})
