import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MiniYaoStack } from '@/components/hexagram/MiniYaoStack'
import type { YaoLine } from '@/types'

const yaoLines: YaoLine[] = [
  { position: 1, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  { position: 2, type: 'yin', originalText: '', explanation: '', modernMeaning: '' },
  { position: 3, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  { position: 4, type: 'yin', originalText: '', explanation: '', modernMeaning: '' },
  { position: 5, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  { position: 6, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
]

describe('MiniYaoStack', () => {
  it('renders 6 rows, one per yao position', () => {
    const { container } = render(<MiniYaoStack yaoLines={yaoLines} currentLine={3} />)
    // 6 个 data-position 属性
    const rows = container.querySelectorAll('[data-position]')
    expect(rows).toHaveLength(6)
  })

  it('marks currentLine row with data-current="true"', () => {
    const { container } = render(<MiniYaoStack yaoLines={yaoLines} currentLine={4} />)
    const currentRow = container.querySelector('[data-current="true"]')
    expect(currentRow).not.toBeNull()
    expect(currentRow?.getAttribute('data-position')).toBe('4')
  })

  it('renders rows in 6→1 order (top-down visual, matches card display)', () => {
    const { container } = render(<MiniYaoStack yaoLines={yaoLines} currentLine={1} />)
    const rows = Array.from(container.querySelectorAll('[data-position]'))
    const positions = rows.map((r) => r.getAttribute('data-position'))
    expect(positions).toEqual(['6', '5', '4', '3', '2', '1'])
  })

  it('has accessible label indicating current line', () => {
    render(<MiniYaoStack yaoLines={yaoLines} currentLine={5} />)
    expect(screen.getByLabelText('位置指示器，当前在第 5 爻')).toBeInTheDocument()
  })
})
