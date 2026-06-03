import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { YaoLineScroll } from '@/components/hexagram/YaoLineScroll'
import type { YaoLine } from '@/types'

// Helper to make a yao line with default empty content
const yao = (overrides: Partial<YaoLine> = {}): YaoLine => ({
  position: 1 as 1,
  type: 'yang' as const,
  originalText: '',
  explanation: '',
  modernMeaning: '',
  ...overrides,
})

describe('YaoLineScroll', () => {
  it('renders 6 yao lines', () => {
    const lines = Array.from({ length: 6 }, (_, i) =>
      yao({ position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 })
    )
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    // Should render 6 爻位 labels (初九, 九二, ..., 上九)
    expect(screen.getByText('初九')).toBeInTheDocument()
    expect(screen.getByText('九二')).toBeInTheDocument()
    expect(screen.getByText('九三')).toBeInTheDocument()
    expect(screen.getByText('九四')).toBeInTheDocument()
    expect(screen.getByText('九五')).toBeInTheDocument()
    expect(screen.getByText('上九')).toBeInTheDocument()
  })

  it('shows original text when present', () => {
    const lines = [yao({ position: 1, type: 'yang', originalText: '潜龙勿用。' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText('潜龙勿用。')).toBeInTheDocument()
  })

  it('shows explanation with ▎释 prefix when present', () => {
    const lines = [yao({ position: 1, type: 'yang', originalText: 'X', explanation: '龙潜伏。' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText(/龙潜伏/)).toBeInTheDocument()
    // Verify the ▎释 prefix label
    expect(screen.getByText('▎释：')).toBeInTheDocument()
  })

  it('shows modernMeaning with ▎今 prefix when present', () => {
    const lines = [yao({ position: 1, type: 'yang', originalText: 'X', modernMeaning: '起步。' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText('▎今：')).toBeInTheDocument()
  })

  it('shows deepMeaning section when present', () => {
    const lines = [
      yao({
        position: 1,
        type: 'yang',
        originalText: 'X',
        deepMeaning: '这是深意。',
      }),
    ]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText('深意')).toBeInTheDocument()
    expect(screen.getByText('这是深意。')).toBeInTheDocument()
  })

  it('hides deepMeaning section when empty', () => {
    const lines = [yao({ position: 1, type: 'yang', originalText: 'X' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.queryByText('深意')).not.toBeInTheDocument()
  })

  it('uses yin labels for yin lines', () => {
    const lines = [yao({ position: 1, type: 'yin', originalText: 'X' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText('初六')).toBeInTheDocument()
  })

  it('shows placeholder for completely empty content', () => {
    const lines = [yao({ position: 1, type: 'yang' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText(/此爻内容待补全/)).toBeInTheDocument()
  })

  it('renders 6 cards even when all yao lines are empty (graceful degradation)', () => {
    // The component itself always renders 6 yao cards. The parent (HexagramDetail)
    // decides whether to render the section wrapper at all.
    const lines = Array.from({ length: 6 }, (_, i) =>
      yao({ position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 })
    )
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    // 6 cards rendered (each card is a div with border-june-bronze/15)
    expect(container.querySelectorAll('.border-june-bronze\\/15')).toHaveLength(6)
  })
})
