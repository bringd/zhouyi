import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RandomizerHarness } from '../helpers/numberBoxHarness'

describe('NumberBoxWithRandomizer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders label, input, and the random button', () => {
    render(<RandomizerHarness />)
    expect(screen.getByText('第一灵数')).toBeInTheDocument()
    expect(screen.getByLabelText('随机生成灵数')).toBeInTheDocument()
    expect(screen.getByText('天降灵数')).toBeInTheDocument()
  })

  it('enters rolling state on click (button text → 停 止)', () => {
    render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    expect(screen.getByText('停 止')).toBeInTheDocument()
  })

  it('rolls to a new display value at the default high-speed interval', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    const { container } = render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    expect(screen.getByText('100')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByText('550')).toBeInTheDocument()
    expect(container.querySelector('.number-randomizer-reel')?.textContent).toBe('550')
  })

  it('locks the current value when user clicks 停 止', () => {
    render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(1500) // 出过 1-2 个数字
    })
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    const locked = screen.getByTestId('value').textContent ?? ''
    expect(locked).not.toBe('null')
    const final = Number(locked)
    expect(final).toBeGreaterThanOrEqual(100)
    expect(final).toBeLessThanOrEqual(999)
  })

  it('auto-locks after 10s timeout', () => {
    render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(10500)
    })
    const locked = screen.getByTestId('value').textContent ?? ''
    expect(locked).not.toBe('null')
    const final = Number(locked)
    expect(final).toBeGreaterThanOrEqual(100)
    expect(final).toBeLessThanOrEqual(999)
  })

  it('button is disabled while locked', () => {
    render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(10500)
    })
    // locked 之后随机按钮不再可用，但输入框仍可手动填写
    expect(screen.getByLabelText('随机生成灵数')).toBeDisabled()
    expect(screen.getByRole('textbox')).not.toBeDisabled()
  })

  it('把锁定的数字同时写回输入框的原始文本', () => {
    render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(10500)
    })
    const value = screen.getByTestId('value').textContent ?? ''
    expect(screen.getByTestId('text').textContent).toBe(value)
  })
})
