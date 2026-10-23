import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionInput } from '@/components/ui/QuestionInput'
import { RelationTabs } from '@/components/ui/RelationTabs'
import { NumberBoxHarness } from '../helpers/numberBoxHarness'

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
    render(
      <NumberBoxHarness initial="427" label="第一灵数" description="下卦" />
    )
    expect(screen.getByText('第一灵数')).toBeInTheDocument()
    expect(screen.getByDisplayValue('427')).toBeInTheDocument()
    expect(screen.getByText('下卦')).toBeInTheDocument()
  })

  it('renders empty when there is no text', () => {
    render(<NumberBoxHarness initial="" label="第一灵数" />)
    const input = screen.getByRole('textbox')
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('reports the sanitized text on change', () => {
    const handler = vi.fn()
    render(<NumberBoxHarness initial="" label="test" onTextChange={handler} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '427' } })
    expect(handler).toHaveBeenCalledWith('427')
  })

  it('reports empty text when the user clears the field', () => {
    const handler = vi.fn()
    render(
      <NumberBoxHarness initial="427" label="test" onTextChange={handler} />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    expect(handler).toHaveBeenCalledWith('')
  })

  // Regression: 逐位输入时不能把已敲下的字符清掉。
  // 文本由上层（稳定层）持有，组件只负责回传，所以这里能直接验证。
  it('keeps partial input visible while user types digit-by-digit', () => {
    const handler = vi.fn()
    render(<NumberBoxHarness initial="" label="test" onTextChange={handler} />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    fireEvent.change(input, { target: { value: '1' } })
    expect(input.value).toBe('1')
    expect(handler).toHaveBeenLastCalledWith('1')

    fireEvent.change(input, { target: { value: '12' } })
    expect(input.value).toBe('12')
    expect(handler).toHaveBeenLastCalledWith('12')

    fireEvent.change(input, { target: { value: '123' } })
    expect(input.value).toBe('123')
    expect(handler).toHaveBeenLastCalledWith('123')
  })

  it('strips non-digit characters from input', () => {
    const handler = vi.fn()
    render(<NumberBoxHarness initial="" label="test" onTextChange={handler} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a1b2c3' } })
    expect(input.value).toBe('123')
    expect(handler).toHaveBeenCalledWith('123')
  })

  it('preserves partial text when deleting digits from a previously valid number', () => {
    const handler = vi.fn()
    render(
      <NumberBoxHarness initial="427" label="test" onTextChange={handler} />
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '42' } })
    expect(handler).toHaveBeenLastCalledWith('42')
    expect(input.value).toBe('42')
    fireEvent.change(input, { target: { value: '4' } })
    expect(handler).toHaveBeenLastCalledWith('4')
    expect(input.value).toBe('4')
  })

  it('syncs the text when the parent resets it', () => {
    const { rerender } = render(<NumberBoxHarness text="427" label="test" />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('427')
    rerender(<NumberBoxHarness text="" label="test" />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('marks a three-digit but out-of-range value as invalid', () => {
    render(<NumberBoxHarness initial="099" label="test" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not mark a valid value as invalid', () => {
    render(<NumberBoxHarness initial="123" label="test" />)
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
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
