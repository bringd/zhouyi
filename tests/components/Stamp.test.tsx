import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stamp } from '@/components/ui/Stamp'

describe('Stamp', () => {
  it('renders the text', () => {
    render(<Stamp text="乾" />)
    expect(screen.getByLabelText('stamp: 乾')).toBeInTheDocument()
  })

  it('applies vermillion background', () => {
    render(<Stamp text="乾" data-testid="stamp" />)
    const stamp = screen.getByTestId('stamp')
    expect(stamp.className).toContain('bg-june-red')
    expect(stamp.className).toContain('text-rice')
  })

  it('applies size classes', () => {
    render(<Stamp text="乾" size="lg" data-testid="stamp" />)
    const stamp = screen.getByTestId('stamp')
    expect(stamp.className).toContain('w-20')
  })

  it('applies rotation via style', () => {
    render(<Stamp text="乾" rotation={-3} data-testid="stamp" />)
    const stamp = screen.getByTestId('stamp')
    expect(stamp.style.transform).toBe('rotate(-3deg)')
  })

  it('supports rectangle shape with vertical writing mode', () => {
    render(<Stamp text="易象阁" shape="rectangle" data-testid="stamp" />)
    const stamp = screen.getByTestId('stamp')
    expect(stamp.querySelector('span')?.style.writingMode).toBe('vertical-rl')
  })
})
