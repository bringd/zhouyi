import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CodexGrid } from '@/components/sections/CodexGrid'
import type { Hexagram } from '@/types'

const mockHexagrams: Hexagram[] = [
  {
    id: 1,
    number: 1,
    name: '乾为天',
    shortName: '乾',
    upperTrigramId: 1,
    lowerTrigramId: 1,
    binaryCode: '111111',
    palace: 1,
    palaceRole: '本宫卦',
    theme: ['人生总论'],
    keywords: ['创造'],
    judgement: '',
    tuanzhuan: '',
    xiangzhuan: { daXiang: '', xiaoXiang: ['', '', '', '', '', ''] },
    yaoLines: Array.from({ length: 6 }, (_, i) => ({
      position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      type: 'yang' as const,
      originalText: '',
      explanation: '',
      modernMeaning: '',
    })) as Hexagram['yaoLines'],
    modernInterpretation: '',
    relations: { opposite: 2, inverse: 1, nuclear: 1 },
  },
  {
    id: 2,
    number: 2,
    name: '坤为地',
    shortName: '坤',
    upperTrigramId: 8,
    lowerTrigramId: 8,
    binaryCode: '000000',
    palace: 8,
    palaceRole: '本宫卦',
    theme: ['人生总论', '事业行动'],
    keywords: ['柔顺'],
    judgement: '',
    tuanzhuan: '',
    xiangzhuan: { daXiang: '', xiaoXiang: ['', '', '', '', '', ''] },
    yaoLines: Array.from({ length: 6 }, (_, i) => ({
      position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      type: 'yin' as const,
      originalText: '',
      explanation: '',
      modernMeaning: '',
    })) as Hexagram['yaoLines'],
    modernInterpretation: '',
    relations: { opposite: 1, inverse: 2, nuclear: 2 },
  },
]

describe('CodexGrid', () => {
  it('renders all three view controls', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    expect(screen.getByText('主题分类')).toBeInTheDocument()
    expect(screen.getByText('卦序浏览')).toBeInTheDocument()
    expect(screen.getByText('八宫')).toBeInTheDocument()
  })

  it('defaults to theme view', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    // Group header for 人生总论 should appear
    expect(screen.getByRole('heading', { name: /人生总论/ })).toBeInTheDocument()
  })

  it('switches to palace view when 八宫 tab clicked', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('八宫'))
    expect(screen.getByRole('heading', { name: /乾宫/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /坤宫/ })).toBeInTheDocument()
  })

  it('renders hexagram names in cards', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    expect(screen.getAllByText('乾为天').length).toBeGreaterThan(0)
    expect(screen.getAllByText('坤为地').length).toBeGreaterThan(0)
  })

  it('restores the view and filters from the URL and carries them to details', () => {
    render(
      <MemoryRouter initialEntries={['/codex?view=palace&group=%E5%9D%A4%E5%AE%AB&q=2']}>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: '八宫' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox')).toHaveValue('2')
    expect(screen.getByRole('combobox')).toHaveValue('坤宫')
    const cards = screen.getAllByRole('link')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('href', '/hexagram/2?view=palace&group=%E5%9D%A4%E5%AE%AB&q=2')
    expect(within(cards[0]).getByText('本宫卦')).toBeInTheDocument()
  })

  it('searches, reports distinct counts, and clears filters without changing the view', () => {
    render(<MemoryRouter><CodexGrid hexagrams={mockHexagrams} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '八宫' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '柔顺' } })
    expect(screen.getByRole('status')).toHaveTextContent('显示 1 / 2 卦')
    expect(screen.queryByText('乾为天')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '没有这个卦' } })
    expect(screen.getByRole('heading', { name: '没有找到对应卦象' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))
    expect(screen.getByRole('status')).toHaveTextContent('显示 2 / 2 卦')
    expect(screen.getByRole('button', { name: '八宫' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows each hexagram once in sequence view and removes the group selector', () => {
    render(<MemoryRouter><CodexGrid hexagrams={mockHexagrams} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '卦序浏览' }))
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/hexagram/1?view=sequence', '/hexagram/2?view=sequence',
    ])
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '没有这个卦' } })
    expect(screen.getByRole('heading', { name: '没有找到对应卦象' })).toBeInTheDocument()
  })

  it('restores scroll after returning with the same filters in a different URL order', () => {
    const scrollDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY')!
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const first = render(<MemoryRouter initialEntries={['/codex?view=palace&group=%E5%9D%A4%E5%AE%AB&q=2']}><CodexGrid hexagrams={mockHexagrams} /></MemoryRouter>)
    try {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 })
      fireEvent.click(screen.getByRole('link'))
      first.unmount()
      render(<MemoryRouter initialEntries={['/codex?view=palace&q=2&group=%E5%9D%A4%E5%AE%AB']}><CodexGrid hexagrams={mockHexagrams} /></MemoryRouter>)
      expect(scroll).toHaveBeenCalledWith(0, 240)
    } finally {
      Object.defineProperty(window, 'scrollY', scrollDescriptor)
      scroll.mockRestore()
      frame.mockRestore()
      sessionStorage.clear()
    }
  })
})
