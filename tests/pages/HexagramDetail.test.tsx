import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import HexagramDetail from '@/pages/HexagramDetail'
import { validateModernInterpretation } from '@/lib/modernInterpretation'
import { getHexagramById } from '@/lib/divination'

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

// Regression test for audit finding C1. The section is rendered behind
// `{hexagram.modernInterpretation && …}`, so 60 of 64 pages silently dropped
// it while every data-level check still passed — nothing asserted that the
// text reaches the DOM. These tests fail if that guard ever hides real copy.
describe('现代解读 renders (C1 regression)', () => {
  /** The <p> inside the 现代解读 <section>, or null if the section is absent. */
  const modernParagraph = (container: HTMLElement): string | null => {
    const h2 = Array.from(container.querySelectorAll('h2')).find(
      (el) => el.textContent?.replace(/\s/g, '') === '现代解读'
    )
    if (!h2) return null
    return h2.parentElement?.querySelector('p')?.textContent ?? null
  }

  // id 1 is hand-written, 30 and 64 were empty before the backfill.
  it.each([1, 30, 64])('renders filled, spec-compliant copy for hexagram %i', (id) => {
    const { container } = renderAt(String(id))
    const text = modernParagraph(container)
    expect(text, `id=${id} has no 现代解读 paragraph`).not.toBeNull()
    // Same contract the generator and the data tests use — one source of truth.
    expect(validateModernInterpretation(text, id), `id=${id}`).toEqual([])
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

describe('HexagramDetail catalogue fixes', () => {
  it.each(['0', '65', '1abc', '1.5', '01'])('handles invalid id %s without rendering a wrong hexagram', (id) => {
    const { container } = renderAt(id)
    expect(screen.getByRole('heading', { name: '未找到该卦象' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回图鉴' })).toHaveAttribute('href', '/codex')
    expect(container.querySelector('[data-testid="hero-card"]')).toBeNull()
  })

  it('renders all six 小象 beside their matching line positions', () => {
    renderAt('41')
    const hexagram = getHexagramById(41)
    for (let position = 1; position <= 6; position++) {
      expect(screen.getByTestId(`xiaoxiang-${position}`)).toHaveTextContent(hexagram.xiangzhuan.xiaoXiang[position - 1])
    }
  })

  it.each([['1', '用九'], ['2', '用六']])('shows the special text for %s separately from its six lines', (id, label) => {
    const { container } = renderAt(id)
    expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid^="xiaoxiang-"]')).toHaveLength(6)
  })

  it('retains catalogue filters in return, sequence and relation links', () => {
    renderAt('41?view=palace&q=%E6%8D%9F&group=%E8%89%AE%E5%AE%AB')
    const suffix = '?view=palace&q=%E6%8D%9F&group=%E8%89%AE%E5%AE%AB'
    expect(screen.getByRole('link', { name: '返回图鉴' })).toHaveAttribute('href', '/codex' + suffix)
    expect(screen.getByRole('link', { name: /上一卦/ })).toHaveAttribute('href', '/hexagram/40' + suffix)
    expect(screen.getByRole('link', { name: /下一卦/ })).toHaveAttribute('href', '/hexagram/42' + suffix)
    expect(screen.getByRole('link', { name: /查看 泽山咸/ })).toHaveAttribute('href', '/hexagram/31' + suffix)
    fireEvent.click(screen.getByRole('link', { name: /下一卦/ }))
    expect(screen.getByRole('heading', { name: '风雷益' })).toBeInTheDocument()
  })

  it('offers chapter anchors and an immutable source reference', () => {
    renderAt('1')
    expect(screen.getByRole('link', { name: '六爻与小象' })).toHaveAttribute('href', '#yao')
    expect(screen.queryByRole('link', { name: /上一卦/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下载卦象卡' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('原文来源与校订说明'))
    expect(screen.getByRole('link', { name: /原文对照/ }).getAttribute('href')).toMatch(/^https:\/\/zh.wikisource.org\/.*oldid=/)
  })
})
