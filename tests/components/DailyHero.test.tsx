import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DailyHero } from '@/components/sections/DailyHero'
import type { Hexagram } from '@/types'

const mockQian: Hexagram = {
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
  keywords: ['创造', '刚健', '领导'],
  judgement: '元，亨，利，贞。',
  tuanzhuan: '',
  xiangzhuan: { daXiang: '', xiaoXiang: ['', '', '', '', '', ''] },
  yaoLines: Array.from({ length: 6 }, (_, i) => ({
    position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    type: 'yang' as const,
    originalText: '',
    explanation: '',
    modernMeaning: '',
  })) as Hexagram['yaoLines'],
  modernInterpretation: '乾为天，纯阳之卦。',
  relations: { opposite: 2, inverse: 1, nuclear: 1 },
}

const mockKun: Hexagram = {
  ...mockQian,
  id: 2,
  name: '坤为地',
  shortName: '坤',
  binaryCode: '000000',
}

describe('DailyHero', () => {
  it('renders the main hexagram name', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    // The daily reading identifies the actual generated hexagram.
    expect(screen.getAllByText('乾为天').length).toBeGreaterThan(0)
  })

  it('renders the changed hexagram link', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/变卦 · 坤为地/)).toBeInTheDocument()
  })

  it('shows the moving line', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/动爻 · 第 4 爻/)).toBeInTheDocument()
  })

  it('renders 今日卦境 header', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/今 日 卦 境/)).toBeInTheDocument()
  })

  it('renders the action buttons', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('展开卦境')).toBeInTheDocument()
    expect(screen.getByText('查看 64 卦')).toBeInTheDocument()
    expect(screen.getByText('三数起卦')).toBeInTheDocument()
  })

  it('shows the time zone and explains that the date (not the zone) decides the hexagram', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    const zone = screen.getByText(/时区 .+ · 每日卦象按本地日期计算/)
    expect(zone).toBeInTheDocument()
    // 措辞不能暗示「时区不同卦象必不同」
    expect(zone.textContent).toContain('跨过日界时各地区可能看到不同卦象')
    expect(zone.textContent).not.toContain('必定')
  })

  it('labels the main hexagram glyph with its Chinese name', () => {
    render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole('img', { name: '乾为天卦象图' })).toBeInTheDocument()
  })
})

// Regression test for audit finding C1: this is the second render site that
// hides the copy behind `{main.modernInterpretation && …}`, so the home hero
// showed nothing for 60 of 64 daily hexagrams.
describe('DailyHero modernInterpretation (C1 regression)', () => {
  it('renders the daily hexagram modernInterpretation', () => {
    const { container } = render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={mockQian}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('乾为天，纯阳之卦。')).toBeInTheDocument()
    expect(container.querySelector('.daily-interpretation')?.textContent).toBe(
      '乾为天，纯阳之卦。'
    )
  })

  it('omits the paragraph entirely when the text is empty, leaving no orphan node', () => {
    const { container } = render(
      <MemoryRouter>
        <DailyHero
          mainHexagram={{ ...mockQian, modernInterpretation: '' }}
          changedHexagram={mockKun}
          movingLine={4}
        />
      </MemoryRouter>
    )
    expect(container.querySelector('.daily-interpretation')).toBeNull()
  })
})
