import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppearanceProvider } from '@/contexts/AppearanceContext'
import { AppearanceSwitcher } from '@/components/layout/AppearanceSwitcher'
import { AppearancePicker } from '@/components/layout/AppearancePicker'
import { getAppearance } from '@/lib/storage'
import { APPEARANCE_PAGE_BG } from '@/lib/appearance'

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AppearanceProvider>{ui}</AppearanceProvider>
    </MemoryRouter>
  )
}

describe('外观选择', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-appearance')
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('默认是青岚书院，并把外观写到根节点', () => {
    renderWithProvider(<AppearanceSwitcher />)
    expect(getAppearance()).toBe('qinglan')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('qinglan')
  })

  it('顶栏入口与设置页共用同一状态：设置页选中的，顶栏同步', () => {
    renderWithProvider(
      <>
        <AppearanceSwitcher />
        <AppearancePicker />
      </>
    )
    const cards = screen.getAllByRole('radio')
    expect(cards).toHaveLength(3)
    fireEvent.click(cards[1]) // 朱砂档案
    expect(getAppearance()).toBe('zhusha')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('zhusha')
    // 顶栏的可访问名跟着更新
    expect(
      screen.getByRole('button', { name: '外观：朱砂档案' })
    ).toBeInTheDocument()
  })

  it('顶栏下拉选择后立即生效并持久化', () => {
    renderWithProvider(<AppearanceSwitcher />)
    const trigger = screen.getByRole('button', { name: /外观/ })
    fireEvent.click(trigger)
    const items = screen.getAllByRole('menuitemradio')
    expect(items).toHaveLength(3)
    fireEvent.click(items[2]) // 夜航观象
    expect(getAppearance()).toBe('yehang')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('yehang')
  })

  it('根节点底色跟着外观走（首帧预绘用的内联底色不能停在旧值）', () => {
    // jsdom 会把十六进制色归一化成 rgb() 字符串
    const toRgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
    }
    renderWithProvider(<AppearanceSwitcher />)
    expect(document.documentElement.style.backgroundColor).not.toBe('')
    fireEvent.click(screen.getByRole('button', { name: /外观/ }))
    fireEvent.click(screen.getAllByRole('menuitemradio')[2]) // 夜航观象
    expect(document.documentElement.style.backgroundColor).toBe(
      toRgb(APPEARANCE_PAGE_BG.yehang)
    )
    fireEvent.click(screen.getByRole('button', { name: /外观/ }))
    fireEvent.click(screen.getAllByRole('menuitemradio')[1]) // 朱砂档案
    expect(document.documentElement.style.backgroundColor).toBe(
      toRgb(APPEARANCE_PAGE_BG.zhusha)
    )
  })

  it('下拉里的选中态用 aria-checked 表达', () => {
    renderWithProvider(<AppearanceSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: /外观/ }))
    const items = screen.getAllByRole('menuitemradio')
    expect(items[0]).toHaveAttribute('aria-checked', 'true')
    expect(items[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('键盘：方向键在选项间移动，Esc 关闭并把焦点还给按钮', () => {
    renderWithProvider(<AppearanceSwitcher />)
    const trigger = screen.getByRole('button', { name: /外观/ })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3)
    const items = screen.getAllByRole('menuitemradio')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(items[1], { key: 'Escape' })
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0)
    expect(document.activeElement).toBe(trigger)
  })

  it('设置页卡片可用方向键切换外观', () => {
    renderWithProvider(<AppearancePicker />)
    const cards = screen.getAllByRole('radio')
    fireEvent.keyDown(cards[0], { key: 'ArrowRight' })
    expect(getAppearance()).toBe('zhusha')
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('存储写入失败时不阻断切换，并以非阻塞方式说明', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string) => {
        // 只让设置写入失败，探针写入照常（hasStorage 依赖它）
        if (key === 'zhouyi:settings') throw new Error('QuotaExceededError')
      })
    renderWithProvider(<AppearanceSwitcher />)
    const trigger = screen.getByRole('button', { name: /外观/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getAllByRole('menuitemradio')[1])
    // 当前会话里已经切换
    expect(document.documentElement.getAttribute('data-appearance')).toBe('zhusha')
    expect(screen.getByRole('status')).toHaveTextContent('存储不可用')
    setItem.mockRestore()
  })

  it('刷新后仍保持此前选择', () => {
    const first = renderWithProvider(<AppearanceSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: /外观/ }))
    fireEvent.click(screen.getAllByRole('menuitemradio')[1])
    first.unmount()
    // 模拟刷新：重新挂载 provider
    renderWithProvider(<AppearanceSwitcher />)
    expect(getAppearance()).toBe('zhusha')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('zhusha')
  })

  it('旧设置（无外观字段）按默认外观启动', () => {
    localStorage.setItem(
      'zhouyi:settings',
      JSON.stringify({ preferredLocale: 'zh-CN', theme: 'light' })
    )
    renderWithProvider(<AppearanceSwitcher />)
    expect(document.documentElement.getAttribute('data-appearance')).toBe('qinglan')
  })

  it('存储里的非法外观值按默认外观启动', () => {
    localStorage.setItem(
      'zhouyi:settings',
      JSON.stringify({ appearance: 'neon' })
    )
    renderWithProvider(<AppearanceSwitcher />)
    expect(document.documentElement.getAttribute('data-appearance')).toBe('qinglan')
  })

  it('切换外观不会卸载页面内容（业务状态保留）', () => {
    function Counter() {
      const [count, setCount] = useState(0)
      return (
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          计数 {count}
        </button>
      )
    }
    renderWithProvider(
      <>
        <AppearanceSwitcher />
        <Counter />
      </>
    )
    const counter = screen.getByRole('button', { name: /计数/ })
    fireEvent.click(counter)
    expect(counter).toHaveTextContent('计数 1')
    fireEvent.click(screen.getByRole('button', { name: /外观/ }))
    fireEvent.click(screen.getAllByRole('menuitemradio')[1])
    // 切外观后计数仍在（没有被重新挂载清零）
    expect(screen.getByRole('button', { name: /计数/ })).toHaveTextContent('计数 1')
  })
})
