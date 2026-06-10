import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import HexagramDetail from '@/pages/HexagramDetail'

// Same providers as the Smoke test: <SEO /> needs HelmetProvider.
function withProviders(node: React.ReactNode) {
  return (
    <HelmetProvider>
      {node}
    </HelmetProvider>
  )
}

const renderAt = (id: string) =>
  render(
    withProviders(
      <MemoryRouter initialEntries={[`/hexagram/${id}`]}>
        <Routes>
          <Route path="/hexagram/:id" element={<HexagramDetail />} />
        </Routes>
      </MemoryRouter>
    )
  )

describe('HexagramDetail Hero card', () => {
  it('does not have shadow-lg on the hero card (V5)', () => {
    const { container } = renderAt('1')
    const heroCard = container.querySelector('[data-testid="hero-card"]')
    expect(heroCard).not.toBeNull()
    expect(heroCard?.className).not.toMatch(/shadow-lg/)
  })
})

describe('HexagramDetail section rhythm (D1)', () => {
  it('uses <section> elements with divide-y separators', () => {
    const { container } = renderAt('1')
    const sections = container.querySelectorAll('section')
    // 卦辞/彖传/象传/六爻/现代解读/卦象关系 — at least 5 sections
    expect(sections.length).toBeGreaterThanOrEqual(5)
    // The parent of the <section> rhythm block should carry divide-y
    const parentWithDivide = container.querySelector('.divide-y')
    expect(parentWithDivide).not.toBeNull()
  })
})
