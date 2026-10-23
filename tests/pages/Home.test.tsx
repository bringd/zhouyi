import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import Home from '@/pages/Home'

function renderHome() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </HelmetProvider>
  )
}

describe('Home', () => {
  it('switches reading themes and links to the corresponding hexagrams', () => {
    renderHome()
    const reading = within(
      screen.getByRole('region', { name: '翻开易经的一页' })
    )
    expect(reading.getByRole('link', { name: /乾为天/ })).toHaveAttribute(
      'href',
      '/hexagram/1'
    )

    fireEvent.click(reading.getByRole('button', { name: '进退有时' }))
    expect(reading.getByRole('button', { name: '进退有时' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      reading.queryByRole('link', { name: /乾为天/ })
    ).not.toBeInTheDocument()
    expect(reading.getByRole('link', { name: /水天需/ })).toHaveAttribute(
      'href',
      '/hexagram/5'
    )
    // 当前主题的卦象应逐个出现（按链接断言，不依赖易碎的数量统计）
    expect(reading.getByRole('link', { name: /地天泰/ })).toHaveAttribute(
      'href',
      '/hexagram/11'
    )
    expect(reading.getByRole('link', { name: /风天小畜/ })).toBeInTheDocument()

    fireEvent.click(reading.getByRole('button', { name: '修身处世' }))
    expect(reading.getByRole('link', { name: /天泽履/ })).toHaveAttribute(
      'href',
      '/hexagram/10'
    )
    expect(reading.getByRole('link', { name: /风泽中孚/ })).toHaveAttribute(
      'href',
      '/hexagram/61'
    )

    fireEvent.click(reading.getByRole('button', { name: '万物之始' }))
    expect(reading.getByRole('link', { name: /乾为天/ })).toBeInTheDocument()
  })

  it('announces the current reading theme for screen readers', () => {
    renderHome()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('已切换到「万物之始」，显示 4 个卦象')

    const reading = within(
      screen.getByRole('region', { name: '翻开易经的一页' })
    )
    fireEvent.click(reading.getByRole('button', { name: '进退有时' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '已切换到「进退有时」，显示 4 个卦象'
    )
  })

  it('renders 今日卦境 as the main content of the page', () => {
    renderHome()
    // 首页的主内容是「今日卦境」，不能因为首屏是 slogan 就丢掉
    expect(screen.getByRole('heading', { name: /今 日 卦 境/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '今 日 卦 境' })).toBeInTheDocument()
  })

  it('connects the primary actions and footer to existing pages', () => {
    renderHome()
    expect(screen.getByRole('link', { name: '静心起一卦' })).toHaveAttribute(
      'href',
      '/divination'
    )
    expect(screen.getByRole('link', { name: '探索六十四卦' })).toHaveAttribute(
      'href',
      '/codex'
    )
    expect(screen.getByRole('link', { name: '易学书院' })).toHaveAttribute(
      'href',
      '/codex'
    )
    expect(screen.getByRole('link', { name: '偏好设置' })).toHaveAttribute(
      'href',
      '/settings'
    )
    expect(
      screen.getByRole('link', { name: '与同道，共读易' })
    ).toHaveAttribute('href', '/feed')
  })
})
