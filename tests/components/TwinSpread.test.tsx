import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TwinSpread } from '@/components/hexagram/TwinSpread'
import type { Hexagram } from '@/types'

const mockQian: Hexagram = {
  id: 1, number: 1, name: '乾为天', shortName: '乾',
  upperTrigramId: 1, lowerTrigramId: 1, binaryCode: '111111',
  palace: 1, palaceRole: '本宫卦', theme: ['人生总论'],
  keywords: ['创造'], judgement: '元，亨，利，贞。', tuanzhuan: '',
  xiangzhuan: { daXiang: '', xiaoXiang: ['', '', '', '', '', ''] },
  yaoLines: Array.from({ length: 6 }, (_, i) => ({
    position: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    type: 'yang' as const,
    originalText: '', explanation: '', modernMeaning: '',
  })) as Hexagram['yaoLines'],
  modernInterpretation: '',
  relations: { opposite: 2, inverse: 1, nuclear: 1 },
}

const mockKun: Hexagram = { ...mockQian, id: 2, name: '坤为地', shortName: '坤', binaryCode: '000000' }

describe('TwinSpread', () => {
  it('renders both hexagram names', () => {
    render(<TwinSpread leftHex={mockQian} rightHex={mockKun} />)
    expect(screen.getByText('乾为天')).toBeInTheDocument()
    expect(screen.getByText('坤为地')).toBeInTheDocument()
  })

  it('renders the arrow between them', () => {
    const { container } = render(<TwinSpread leftHex={mockQian} rightHex={mockKun} />)
    expect(container.textContent).toContain('⟶')
  })

  it('renders labels when provided', () => {
    render(<TwinSpread leftHex={mockQian} rightHex={mockKun} leftLabel="本卦" rightLabel="变卦" />)
    expect(screen.getByText('本卦')).toBeInTheDocument()
    expect(screen.getByText('变卦')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<TwinSpread leftHex={mockQian} rightHex={mockKun} title="卦象已成" />)
    expect(screen.getByText('卦象已成')).toBeInTheDocument()
  })

  it('highlights moving line on left hex', () => {
    const { container } = render(<TwinSpread leftHex={mockQian} rightHex={mockKun} movingLine={4} />)
    // Position 4 is index 2 from top (positions 6,5,4,3,2,1 rendered top-to-bottom)
    // The highlight class is bg-june-red on the moving line
    const highlightElements = container.querySelectorAll('.bg-june-red')
    expect(highlightElements.length).toBeGreaterThan(0)
  })
})
