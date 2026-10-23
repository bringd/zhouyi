import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PageLayout } from '@/components/layout/PageLayout'

describe('Header', () => {
  it('renders the brand', () => {
    render(<MemoryRouter><Header /></MemoryRouter>)
    expect(screen.getByText('易象阁')).toBeInTheDocument()
  })

  it('renders all nav items', () => {
    render(<MemoryRouter><Header /></MemoryRouter>)
    // Header has both desktop and mobile nav, so each label appears twice
    expect(screen.getAllByText('今日卦境').length).toBeGreaterThan(0)
    expect(screen.getAllByText('64 卦图鉴').length).toBeGreaterThan(0)
    expect(screen.getAllByText('三数起卦').length).toBeGreaterThan(0)
    expect(screen.getAllByText('我的卦册').length).toBeGreaterThan(0)
  })

  it('highlights the active route', () => {
    render(
      <MemoryRouter initialEntries={['/codex']}>
        <Header />
      </MemoryRouter>
    )
    // 激活态由 aria-current 表达（CSS 只针对这一状态），桌面与移动导航都应标记
    const codexLinks = screen.getAllByText('64 卦图鉴')
    expect(codexLinks[0]).toHaveAttribute('aria-current', 'page')
    expect(codexLinks[1]).toHaveAttribute('aria-current', 'page')
  })

  it('renders settings link', () => {
    render(<MemoryRouter><Header /></MemoryRouter>)
    // Desktop + mobile both render a settings link (one is hidden via CSS)
    expect(screen.getAllByLabelText('设置').length).toBeGreaterThanOrEqual(1)
  })

  it('keeps the divination navigation active while reading a result', () => {
    render(<MemoryRouter initialEntries={['/result/example']}><Header /></MemoryRouter>)
    expect(screen.getAllByText('三数起卦')[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByText('三数起卦')[1]).toHaveAttribute('aria-current', 'page')
  })
})

describe('Footer', () => {
  it('renders the copyright', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>)
    expect(screen.getByText(/易象阁/)).toBeInTheDocument()
  })

  it('renders the secondary nav links', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>)
    expect(screen.getByText('易学书院')).toBeInTheDocument()
    expect(screen.getByText('我的卦册')).toBeInTheDocument()
  })
})

describe('PageLayout', () => {
  it('renders children inside Header + Footer', () => {
    render(
      <MemoryRouter>
        <PageLayout>
          <div data-testid="content">page content</div>
        </PageLayout>
      </MemoryRouter>
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
    // Header brand (only in desktop section header)
    expect(screen.getByText('易象阁')).toBeInTheDocument()
  })
})
