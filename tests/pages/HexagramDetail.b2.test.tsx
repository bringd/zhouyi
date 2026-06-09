import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import HexagramDetail from '@/pages/HexagramDetail'

// B2: relation-calc error handling — force getOpposite to throw, page must
// still render and show a graceful fallback instead of crashing.
// vi.mock is hoisted by Vitest, so it runs before all imports below.
vi.mock('@/lib/relations', async () => {
  const actual = await vi.importActual<typeof import('@/lib/relations')>('@/lib/relations')
  return {
    ...actual,
    getOpposite: vi.fn(() => { throw new Error('simulated data error') }),
  }
})

function withProviders(node: React.ReactNode) {
  return (
    <HelmetProvider>
      {node}
    </HelmetProvider>
  )
}

const renderAt = (id: string) =>
  render(
    withProviders(
      <MemoryRouter initialEntries={[`/hexagram/${id}`]}>
        <Routes>
          <Route path="/hexagram/:id" element={<HexagramDetail />} />
        </Routes>
      </MemoryRouter>
    )
  )

describe('HexagramDetail relation error handling (B2)', () => {
  it('does not crash; shows fallback message', () => {
    const { container } = renderAt('1')
    expect(container.textContent).toBeTruthy()
    expect(container.textContent).toContain('本卦关系数据缺失')
  })
})
