import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NumberBoxWithRandomizer } from '@/components/ui/NumberBoxRandomizer'

describe('NumberBoxWithRandomizer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders label, input, and the random button', () => {
    render(
      <NumberBoxWithRandomizer value={null} onChange={() => {}} label="第一灵数" />
    )
    expect(screen.getByText('第一灵数')).toBeInTheDocument()
    expect(screen.getByLabelText('随机生成灵数')).toBeInTheDocument()
    expect(screen.getByText('天降灵数')).toBeInTheDocument()
  })

  it('enters rolling state on click (button text → 停 止)', () => {
    render(
      <NumberBoxWithRandomizer value={null} onChange={() => {}} label="第一灵数" />
    )
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    expect(screen.getByText('停 止')).toBeInTheDocument()
  })

  it('rolls to a new display value at the default high-speed interval', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    render(
      <NumberBoxWithRandomizer value={null} onChange={() => {}} label="第一灵数" />
    )
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    expect(screen.getByText('100')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByText('550')).toBeInTheDocument()
  })

  it('locks the current value when user clicks 停 止', () => {
    const onChange = vi.fn()
    render(
      <NumberBoxWithRandomizer value={null} onChange={onChange} label="第一灵数" />
    )
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(1500) // 出过 1-2 个数字
    })
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const final = onChange.mock.calls[0][0] as number
    expect(final).toBeGreaterThanOrEqual(100)
    expect(final).toBeLessThanOrEqual(999)
  })

  it('auto-locks after 10s timeout', () => {
    const onChange = vi.fn()
    render(
      <NumberBoxWithRandomizer value={null} onChange={onChange} label="第一灵数" />
    )
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(10500)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    const final = onChange.mock.calls[0][0] as number
    expect(final).toBeGreaterThanOrEqual(100)
    expect(final).toBeLessThanOrEqual(999)
  })

  it('button is disabled while locked', () => {
    const onChange = vi.fn()
    render(
      <NumberBoxWithRandomizer value={null} onChange={onChange} label="第一灵数" />
    )
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    act(() => {
      vi.advanceTimersByTime(10500)
    })
    // locked 瞬间 onLock 已触发 onChange，父组件已更新 → 组件回到 idle
    // 但同一渲染周期内按钮 disabled=true
    expect(screen.getByLabelText('随机生成灵数')).toBeDisabled()
  })
})