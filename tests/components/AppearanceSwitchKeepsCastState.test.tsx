/**
 * 回归：切换外观时，起卦页的「原始输入文本」与「取数滚动状态」都不能丢。
 *
 * 起因：换外观 = 换视图组件类型 = 整棵表单子树卸载重建。
 * 之前原始文本存在 NumberBox 内部、取数控制器存在 NumberBoxRandomizer 内部，
 * 切一次外观就丢；取数滚动时更糟——子组件被卸载、定时器被清掉，
 * 父层却还记着「取数中」，启卦按钮永远点不动。
 *
 * 现在原始文本与取数控制器都提到稳定层（DivinationForm），
 * 切换外观只是换视图，本文件锁住这个行为。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppearanceProvider } from '@/contexts/AppearanceContext'
import { AppearanceSwitcher } from '@/components/layout/AppearanceSwitcher'
import { DivinationForm } from '@/components/sections/DivinationForm'

function renderForm() {
  return render(
    <MemoryRouter>
      <AppearanceProvider>
        <AppearanceSwitcher />
        <DivinationForm />
      </AppearanceProvider>
    </MemoryRouter>
  )
}

/** 通过顶栏入口切到指定外观 */
function switchTo(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: /外观/ }))
  fireEvent.click(screen.getByRole('menuitemradio', { name }))
}

function firstInput(): HTMLInputElement {
  return screen.getByLabelText('第一灵数') as HTMLInputElement
}

describe('切换外观不丢起卦输入', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('未输完的两位数在三个方向间切换后都还在', () => {
    renderForm()
    fireEvent.change(firstInput(), { target: { value: '12' } })
    expect(firstInput().value).toBe('12')

    switchTo(/朱砂档案/)
    expect(firstInput().value).toBe('12')

    switchTo(/夜航观象/)
    expect(firstInput().value).toBe('12')

    switchTo(/青岚书院/)
    expect(firstInput().value).toBe('12')
  })

  it('无效的三位数（099）在切换外观后还在，且不会被当成合法灵数', () => {
    renderForm()
    fireEvent.change(firstInput(), { target: { value: '099' } })
    expect(firstInput().value).toBe('099')

    switchTo(/夜航观象/)
    expect(firstInput().value).toBe('099')
    // 099 不是合法灵数，启卦仍然禁用
    expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()
  })

  it('取数滚动中切换外观：仍在滚动，新外观里「停止」可用，停得下来', () => {
    vi.useFakeTimers()
    renderForm()

    fireEvent.click(screen.getByLabelText('随机生成第一灵数'))
    expect(screen.getByText('停 止')).toBeInTheDocument()

    switchTo(/夜航观象/)

    // 滚动没有被打断：仍然是「停止」，滚轮还在
    expect(screen.getByText('停 止')).toBeInTheDocument()
    expect(document.querySelector('.number-randomizer-reel')).not.toBeNull()
    // 还没停，启卦仍然禁用
    expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()

    // 新外观里可以正常停下，把这一数定下来
    act(() => {
      vi.advanceTimersByTime(120)
    })
    fireEvent.click(screen.getByLabelText('停止生成第一灵数'))

    expect(firstInput().value).toMatch(/^\d{3}$/)
    expect(screen.getByLabelText('随机生成第一灵数')).toBeInTheDocument()
    expect(screen.getByText(/已选定 1 \/ 3 个灵数/)).toBeInTheDocument()
  })

  it('停止取数后再切换外观：数字保持不变', () => {
    vi.useFakeTimers()
    renderForm()

    fireEvent.click(screen.getByLabelText('随机生成第一灵数'))
    act(() => {
      vi.advanceTimersByTime(120)
    })
    fireEvent.click(screen.getByLabelText('停止生成第一灵数'))
    const before = firstInput().value
    expect(before).toMatch(/^\d{3}$/)

    switchTo(/朱砂档案/)
    expect(firstInput().value).toBe(before)

    switchTo(/夜航观象/)
    expect(firstInput().value).toBe(before)
  })

  it('滚动状态跨外观保持：切回来时仍在滚动，不会静默停掉', () => {
    vi.useFakeTimers()
    renderForm()

    fireEvent.click(screen.getByLabelText('随机生成第一灵数'))
    switchTo(/朱砂档案/)
    expect(screen.getByText('停 止')).toBeInTheDocument()

    switchTo(/青岚书院/)
    expect(screen.getByText('停 止')).toBeInTheDocument()

    // 超时自动停止依然生效（定时器在稳定层，没有被换视图打断）
    act(() => {
      vi.advanceTimersByTime(10500)
    })
    expect(firstInput().value).toMatch(/^\d{3}$/)
    expect(screen.getByLabelText('随机生成第一灵数')).toBeInTheDocument()
  })

  it('切换外观不新建记录', () => {
    renderForm()
    fireEvent.change(firstInput(), { target: { value: '123' } })
    switchTo(/朱砂档案/)
    expect(
      JSON.parse(localStorage.getItem('zhouyi:records') ?? '[]')
    ).toHaveLength(0)
  })
})
