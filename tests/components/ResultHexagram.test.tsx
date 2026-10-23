import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResultHexagram } from '@/components/hexagram/ResultHexagram'
import { getHexagramById } from '@/lib/divination'

describe('ResultHexagram', () => {
  it('highlights the bottom moving line and links to the original main hexagram', () => {
    render(
      <MemoryRouter>
        <ResultHexagram
          hexagram={getHexagramById(1)}
          label="本卦"
          movingLine={1}
        />
      </MemoryRouter>
    )
    const lines = screen.getByTestId('result-main-lines').children
    expect(lines).toHaveLength(6)
    expect(lines[5]).toHaveClass('bg-june-red')
    expect(lines[0]).toHaveClass('bg-ink')
    expect(
      screen.getByRole('link', { name: '查看乾为天完整卦辞' })
    ).toHaveAttribute('href', '/hexagram/1')
  })

  it('marks the changed bottom yin line without reversing the binary order', () => {
    render(
      <MemoryRouter>
        <ResultHexagram
          hexagram={getHexagramById(44)}
          label="变卦"
          movingLine={1}
          isChanged
        />
      </MemoryRouter>
    )
    const lines = screen.getByTestId('result-changed-lines').children
    expect(lines).toHaveLength(6)
    expect(lines[5].querySelectorAll('.bg-june-gold')).toHaveLength(2)
    expect(lines[0]).toHaveClass('bg-ink')
    expect(
      screen.getByRole('link', { name: '查看天风姤完整卦辞' })
    ).toHaveAttribute('href', '/hexagram/44')
  })
})
