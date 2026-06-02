import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '@/pages/Home'
import Codex from '@/pages/Codex'
import Divination from '@/pages/Divination'
import NotFound from '@/pages/NotFound'
import Records from '@/pages/Records'

describe('Page smoke tests', () => {
  it('Home renders without error', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    // DailyHero header "今日卦境" should appear
    expect(screen.getByText(/今 日 卦 境/)).toBeInTheDocument()
  })

  it('Codex renders without error', () => {
    render(<MemoryRouter><Codex /></MemoryRouter>)
    expect(screen.getByText(/六十四卦图鉴/)).toBeInTheDocument()
    expect(screen.getByText('主题分类')).toBeInTheDocument()
  })

  it('Divination renders without error', () => {
    render(<MemoryRouter><Divination /></MemoryRouter>)
    expect(screen.getByText(/三 数 起 卦/)).toBeInTheDocument()
  })

  it('NotFound renders without error', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>)
    expect(screen.getByText(/此路不通/)).toBeInTheDocument()
  })

  it('Records renders without error', () => {
    render(<MemoryRouter><Records /></MemoryRouter>)
    // "我的卦册" appears in the page <h1> as well as in the Header and Footer nav.
    // The page-level h1 is the heading we want to verify.
    const headings = screen.getAllByText(/我的卦册/)
    expect(headings.length).toBeGreaterThan(0)
  })
})
