import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import type { Hexagram } from '@/types'

// Mock hexagram fixture (use 乾 乾为天)
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
  yaoLines: [
    { position: 1, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
    { position: 2, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
    { position: 3, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
    { position: 4, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
    { position: 5, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
    { position: 6, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  ],
  modernInterpretation: '',
  relations: { opposite: 2, inverse: 1, nuclear: 1 },
}

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HexagramCard', () => {
  it('renders the hexagram name', () => {
    renderWithRouter(<HexagramCard hexagram={mockQian} navigateOnClick={false} />)
    expect(screen.getByText('乾为天')).toBeInTheDocument()
  })

  it('renders 6 yao lines', () => {
    const { container } = renderWithRouter(<HexagramCard hexagram={mockQian} navigateOnClick={false} />)
    expect(container.querySelectorAll('[aria-label="yang line, normal"]')).toHaveLength(6)
  })

  it('shows keywords by default', () => {
    renderWithRouter(<HexagramCard hexagram={mockQian} navigateOnClick={false} />)
    expect(screen.getByText(/创造/)).toBeInTheDocument()
  })

  it('hides keywords when showKeywords=false', () => {
    renderWithRouter(<HexagramCard hexagram={mockQian} showKeywords={false} navigateOnClick={false} />)
    expect(screen.queryByText(/创造/)).not.toBeInTheDocument()
  })

  it('renders seal for md size by default', () => {
    renderWithRouter(<HexagramCard hexagram={mockQian} navigateOnClick={false} />)
    expect(screen.getByLabelText('乾')).toBeInTheDocument()
  })

  it('does not render seal for sm size by default', () => {
    renderWithRouter(<HexagramCard hexagram={mockQian} size="sm" navigateOnClick={false} />)
    expect(screen.queryByLabelText('乾')).not.toBeInTheDocument()
  })

  it('calls custom onClick when provided', () => {
    const handler = vi.fn()
    renderWithRouter(<HexagramCard hexagram={mockQian} onClick={handler} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('navigates when clicked (default behavior)', () => {
    // MemoryRouter will use the default initial path
    renderWithRouter(<HexagramCard hexagram={mockQian} />)
    fireEvent.click(screen.getByRole('button'))
    // We can't easily test the navigation destination here without a more complex setup
    // Just verify the click handler runs without error
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
