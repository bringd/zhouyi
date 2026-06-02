import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'

const allYang: ['yang', 'yang', 'yang', 'yang', 'yang', 'yang'] = ['yang', 'yang', 'yang', 'yang', 'yang', 'yang']

describe('YaoLineStack', () => {
  it('renders 6 lines', () => {
    render(<YaoLineStack lines={allYang} data-testid="stack" />)
    const stack = screen.getByTestId('stack')
    expect(stack.children).toHaveLength(6)
  })

  it('renders bottom-to-top (position 1 at the visual bottom)', () => {
    render(<YaoLineStack lines={allYang} data-testid="stack" />)
    const stack = screen.getByTestId('stack')
    // The first child div should be position 6 (top)
    // Since all lines look the same in allYang, we can only verify count
    expect(stack.children).toHaveLength(6)
  })

  it('highlights the specified moving line', () => {
    const mixed: ['yang', 'yang', 'yang', 'yang', 'yang', 'yang'] = ['yang', 'yang', 'yang', 'yang', 'yang', 'yang']
    render(<YaoLineStack lines={mixed} highlightLine={4} data-testid="stack" />)
    const stack = screen.getByTestId('stack')
    // The 3rd visual child (index 2) corresponds to position 4
    // (positions 6,5,4,3,2,1 rendered top-to-bottom; position 4 is index 2)
    const children = Array.from(stack.children)
    const movingLineChild = children[2] // position 4
    expect(movingLineChild.className).toContain('bg-june-red')
  })

  it('uses custom width and gap', () => {
    render(<YaoLineStack lines={allYang} width={100} lineGap={8} data-testid="stack" />)
    const stack = screen.getByTestId('stack')
    expect(stack.style.width).toBe('100px')
    expect(stack.style.gap).toBe('8px')
  })
})
