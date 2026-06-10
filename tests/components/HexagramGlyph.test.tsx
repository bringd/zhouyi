import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HexagramGlyph } from '@/components/hexagram/HexagramGlyph'

describe('HexagramGlyph', () => {
  it('renders a solid line for yang type', () => {
    render(<HexagramGlyph type="yang" data-testid="glyph" />)
    const glyph = screen.getByTestId('glyph')
    expect(glyph.getAttribute('aria-label')).toBe('yang line, normal')
    // Single child div
    expect(glyph.children).toHaveLength(0)
  })

  it('renders two segments for yin type', () => {
    render(<HexagramGlyph type="yin" data-testid="glyph" />)
    const glyph = screen.getByTestId('glyph')
    expect(glyph.getAttribute('aria-label')).toBe('yin line, normal')
    expect(glyph.children).toHaveLength(2)
  })

  it('applies highlight color (red) when state=highlight', () => {
    render(<HexagramGlyph type="yang" state="highlight" data-testid="glyph" />)
    const glyph = screen.getByTestId('glyph')
    expect(glyph.className).toContain('bg-june-red')
  })

  it('applies changed color (gold) when state=changed', () => {
    render(<HexagramGlyph type="yang" state="changed" data-testid="glyph" />)
    expect(screen.getByTestId('glyph').className).toContain('bg-june-gold')
  })

  it('respects custom width and thickness', () => {
    render(<HexagramGlyph type="yang" width={120} thickness={8} data-testid="glyph" />)
    const glyph = screen.getByTestId('glyph')
    expect(glyph.style.width).toBe('120px')
    expect(glyph.style.height).toBe('8px')
  })
})
