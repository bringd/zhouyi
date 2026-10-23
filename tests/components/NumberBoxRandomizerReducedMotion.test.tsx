/**
 * 随机取数在「减少动态效果」下的降级行为。
 *
 * 单独成文件的原因：framer-motion 只在模块首次加载时探测一次
 * prefers-reduced-motion，若与其它用例同文件，探测会发生在默认 mock
 * （matches: false）下，之后无法再切换。本文件在 import 组件之前就替换
 * matchMedia，再用动态 import 引入组件与支架，保证探测命中 mock。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const originalMatchMedia = window.matchMedia

window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

describe('NumberBoxWithRandomizer — 减少动态效果', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('滚轮不再逐帧淡入（不留初始态 opacity 动画）', async () => {
    const { RandomizerHarness } = await import('../helpers/numberBoxHarness')
    const { container } = render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    const reel = container.querySelector('.number-randomizer-reel')
    expect(reel).not.toBeNull()
    // 动画版会写入 style="opacity: 0.4"（初始态），降级版不写任何内联样式
    expect(reel?.getAttribute('style') ?? '').not.toContain('opacity')
  })

  it('数字仍会持续更新（降级的是动画，不是功能）', async () => {
    const { RandomizerHarness } = await import('../helpers/numberBoxHarness')
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    const { container } = render(<RandomizerHarness />)
    fireEvent.click(screen.getByLabelText('随机生成灵数'))
    expect(container.querySelector('.number-randomizer-reel')?.textContent).toBe('100')
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(container.querySelector('.number-randomizer-reel')?.textContent).toBe('550')
  })
})
