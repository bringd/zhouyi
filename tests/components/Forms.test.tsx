import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionInput } from '@/components/ui/QuestionInput'
import { NumberBox } from '@/components/ui/NumberBox'
import { RelationTabs } from '@/components/ui/RelationTabs'

describe('QuestionInput', () => {
  it('renders with value', () => {
    render(<QuestionInput value="hello" onChange={() => {}} />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const handler = vi.fn()
    render(<QuestionInput value="" onChange={handler} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new text' } })
    expect(handler).toHaveBeenCalledWith('new text')
  })

  it('shows character count', () => {
    render(<QuestionInput value="hello" onChange={() => {}} />)
    expect(screen.getByText(/5 \/ 200/)).toBeInTheDocument()
  })

  it('respects custom maxLength', () => {
    render(<QuestionInput value="hi" onChange={() => {}} maxLength={50} />)
    expect(screen.getByText(/2 \/ 50/)).toBeInTheDocument()
  })
})

describe('NumberBox', () => {
  it('renders the label and value', () => {
    render(<NumberBox value={427} onChange={() => {}} label="第一灵数" description="下卦" />)
    expect(screen.getByText('第一灵数')).toBeInTheDocument()
    expect(screen.getByDisplayValue('427')).toBeInTheDocument()
    expect(screen.getByText('下卦')).toBeInTheDocument()
  })

  it('renders empty when value is null', () => {
    render(<NumberBox value={null} onChange={() => {}} label="第一灵数" />)
    const input = screen.getByRole('textbox')
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('calls onChange with number when valid', () => {
    const handler = vi.fn()
    render(<NumberBox value={null} onChange={handler} label="test" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '427' } })
    expect(handler).toHaveBeenCalledWith(427)
  })

  it('calls onChange with null when value is empty', () => {
    const handler = vi.fn()
    render(<NumberBox value={427} onChange={handler} label="test" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    expect(handler).toHaveBeenCalledWith(null)
  })

  // Regression: bug where digit-by-digit typing cleared the input on each
  // keystroke because the parent's null state overrode the visible value.
  // The fix uses local state to keep partial input visible.
  it('keeps partial input visible while user types digit-by-digit', () => {
    const handler = vi.fn()
    const { rerender } = render(<NumberBox value={null} onChange={handler} label="test" />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    // Type "1" — not yet valid (1 < 100)
    fireEvent.change(input, { target: { value: '1' } })
    expect(input.value).toBe('1')
    expect(handler).toHaveBeenLastCalledWith(null)

    // Type "2" — parent re-renders with null (from previous onChange)
    rerender(<NumberBox value={null} onChange={handler} label="test" />)
    fireEvent.change(input, { target: { value: '12' } })
    expect(input.value).toBe('12')
    expect(handler).toHaveBeenLastCalledWith(null)

    // Type "3" — now valid (123 in range)
    rerender(<NumberBox value={null} onChange={handler} label="test" />)
    fireEvent.change(input, { target: { value: '123' } })
    expect(input.value).toBe('123')
    expect(handler).toHaveBeenLastCalledWith(123)
  })

  it('strips non-digit characters from input', () => {
    const handler = vi.fn()
    render(<NumberBox value={null} onChange={handler} label="test" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a1b2c3' } })
    expect(input.value).toBe('123')
    expect(handler).toHaveBeenLastCalledWith(123)
  })

  it('syncs local text when parent resets the value (e.g., form reset)', () => {
    const handler = vi.fn()
    const { rerender } = render(<NumberBox value={427} onChange={handler} label="test" />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('427')
    rerender(<NumberBox value={null} onChange={handler} label="test" />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })
})

describe('RelationTabs', () => {
  it('renders all 4 tabs by default', () => {
    render(<RelationTabs active="opposite" onChange={() => {}} />)
    expect(screen.getByText('错卦')).toBeInTheDocument()
    expect(screen.getByText('综卦')).toBeInTheDocument()
    expect(screen.getByText('互卦')).toBeInTheDocument()
    expect(screen.getByText('变卦')).toBeInTheDocument()
  })

  it('marks active tab with aria-pressed', () => {
    render(<RelationTabs active="opposite" onChange={() => {}} />)
    expect(screen.getByText('错卦').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('综卦').getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange when tab clicked', () => {
    const handler = vi.fn()
    render(<RelationTabs active="opposite" onChange={handler} />)
    fireEvent.click(screen.getByText('综卦'))
    expect(handler).toHaveBeenCalledWith('inverse')
  })
})
