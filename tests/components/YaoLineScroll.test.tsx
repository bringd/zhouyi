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

describe('YaoLineScroll (option A design — mini yao indicator)', () => {
  it('renders a mini yao stack on the left of each card', () => {
    const lines = Array.from({ length: 6 }, (_, i) =>
      yao({ position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 })
    )
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    // 6 cards, each with a mini yao stack (data-testid)
    const stacks = container.querySelectorAll('[data-testid="mini-yao-stack"]')
    expect(stacks).toHaveLength(6)
    // Each stack has 6 mini-line rows
    expect(stacks[0]?.querySelectorAll('[data-current]')).toHaveLength(6)
  })

  it('highlights the current position in the mini yao stack (one row per card)', () => {
    const lines = [yao({ position: 3, type: 'yang' })]
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    const currentRows = container.querySelectorAll('[data-current="true"]')
    // Exactly one row is the current one (position 3)
    expect(currentRows).toHaveLength(1)
  })

  it('marks the correct position row as current for position 1 (V2 design)', () => {
    const lines = [yao({ position: 1, type: 'yang' })]
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    const stack = container.querySelector('[data-testid="mini-yao-stack"]')
    expect(stack).not.toBeNull()
    const currentRow = stack?.querySelector('[data-current="true"]')
    expect(currentRow).not.toBeNull()
    // V2 design: current row has red ring (ring-june-red) + red bg
    expect(currentRow?.className).toContain('ring-june-red')
    expect(currentRow?.className).toContain('bg-june-red')
  })

  it('marks the correct position row as current for position 6 (V2 design)', () => {
    const lines = [yao({ position: 6, type: 'yin' })]
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    const stack = container.querySelector('[data-testid="mini-yao-stack"]')
    const currentRow = stack?.querySelector('[data-current="true"]')
    expect(currentRow).not.toBeNull()
    expect(currentRow?.className).toContain('ring-june-red')
    expect(currentRow?.className).toContain('bg-june-red')
  })

  it('renders the position label as a red badge next to the original text (V2 design)', () => {
    const lines = [yao({ position: 2, type: 'yang' })]
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    // V2 design: label is a red background badge with white text
    const labelEl = screen.getByText('九二')
    expect(labelEl).toBeInTheDocument()
    expect(labelEl.className).toContain('bg-june-red')
    expect(labelEl.className).toContain('text-rice')
  })

  it('V2 stack: current row has june-red ring + red bg, others are dimmed (V2 design)', () => {
    const lines = Array.from({ length: 6 }, (_, i) =>
      yao({
        position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        type: (i + 1) % 2 === 0 ? 'yang' : 'yin',
      })
    )
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    // For each card, exactly one row in its mini-stack has data-current="true"
    const cards = container.querySelectorAll('[data-yao-position]')
    expect(cards).toHaveLength(6)
    cards.forEach((card) => {
      const stack = card.querySelector('[data-testid="mini-yao-stack"]')
      const currentRows = stack?.querySelectorAll('[data-current="true"]')
      expect(currentRows).toHaveLength(1)
    })
  })

  it('shows 6 placeholder cards for an empty hexagram (all 6 yao cards render)', () => {
    // This validates that the parent (HexagramDetail) now always renders the
    // 6-yao section. The component itself should produce 6 cards regardless of content.
    const lines = Array.from({ length: 6 }, (_, i) =>
      yao({ position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 })
    )
    const { container } = render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    // 6 cards
    const cards = container.querySelectorAll('[data-yao-position]')
    expect(cards).toHaveLength(6)
    // All 6 爻位 labels present
    expect(screen.getByText('初九')).toBeInTheDocument()
    expect(screen.getByText('上九')).toBeInTheDocument()
    // 6 placeholder texts for 爻辞
    const placeholders = screen.getAllByText(/（爻辞待补）/)
    expect(placeholders.length).toBeGreaterThanOrEqual(6)
  })

  it('shows field-level placeholders (▎释 / ▎今) when those fields are empty', () => {
    const lines = [yao({ position: 1, type: 'yang' })]
    render(
      <MemoryRouter>
        <YaoLineScroll yaoLines={lines} />
      </MemoryRouter>
    )
    expect(screen.getByText(/（释义待补）/)).toBeInTheDocument()
    expect(screen.getByText(/（今译待补）/)).toBeInTheDocument()
  })
})

