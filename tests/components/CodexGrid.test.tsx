import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  it('renders both view tabs', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    expect(screen.getByText('主题分类')).toBeInTheDocument()
    expect(screen.getByText('八宫')).toBeInTheDocument()
  })

  it('defaults to theme view', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    // Group header for 人生总论 should appear
    expect(screen.getByText(/人生总论/)).toBeInTheDocument()
  })

  it('switches to palace view when 八宫 tab clicked', () => {
    render(
      <MemoryRouter>
        <CodexGrid hexagrams={mockHexagrams} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('八宫'))
    expect(screen.getByText(/乾宫/)).toBeInTheDocument()
    expect(screen.getByText(/坤宫/)).toBeInTheDocument()
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
})
