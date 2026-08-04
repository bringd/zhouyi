import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Divination from '@/pages/Divination'
import { readQuota, consumeQuota } from '@/lib/quota'

vi.mock('@/lib/seo', () => ({ SEO: () => null }))
vi.mock('@/components/layout/PageLayout', () => ({ PageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('framer-motion', () => ({ motion: { form: 'form', button: 'button', div: 'div' }, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

function renderDivination() {
  return render(<MemoryRouter><Divination /></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Divination quota gate', () => {
  it('renders form when quota allows', () => {
    renderDivination()
    expect(screen.getByRole('button', { name: /启\s*卦/ })).toBeInTheDocument()
  })

  it('opens SmsModal when quota=0 on submit', async () => {
    consumeQuota()
    expect(readQuota().remaining).toBe(0)
    renderDivination()
    screen.getAllByRole('textbox').filter((input) => input.getAttribute('maxlength') === '3').forEach((input) => fireEvent.change(input, { target: { value: '427' } }))
    fireEvent.click(screen.getByRole('button', { name: /启\s*卦/ }))
    await waitFor(() => expect(screen.getByText('用手机号注册')).toBeInTheDocument())
  })
})
