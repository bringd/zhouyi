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

  // Regression test for the "印章被遮挡" bug. The Seal must come
  // AFTER the HexagramCard in DOM order inside the hero card wrapper;
  // otherwise the card's opaque rice background paints over the
  // Seal's left side (~26px) and the stamp looks chopped off. The
  // explicit z-10 on the Seal is belt-and-suspenders for any future
  // sibling inserted between them.
  it('renders the outer Seal AFTER the HexagramCard so the card cannot paint over it', () => {
    const { container } = renderAt('11')
    const heroCard = container.querySelector('[data-testid="hero-card"]')
    expect(heroCard).not.toBeNull()
    const children = Array.from(heroCard!.children)
    // The Seal is identifiable by its unique viewBox 0 0 100 100 (the
    // only Seal-shaped SVG in the page; the YaoLineStack SVGs don't
    // use this viewBox).
    const sealWrapper = children.find((el) =>
      el.querySelector('svg[viewBox="0 0 100 100"]') !== null
    )
    expect(sealWrapper).toBeDefined()
    // The Card is the OTHER direct child of the hero wrapper.
    const cardWrapper = children.find((el) => el !== sealWrapper)
    expect(cardWrapper).toBeDefined()
    const sealIndex = children.indexOf(sealWrapper!)
    const cardIndex = children.indexOf(cardWrapper!)
    expect(sealIndex).toBeGreaterThan(cardIndex)
    // The Seal wrapper carries z-10 to keep stacking intent explicit
    expect(sealWrapper!.className).toMatch(/z-10/)
    // pointer-events-none so clicks pass through to the card body
    expect(sealWrapper!.className).toMatch(/pointer-events-none/)
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
