import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Divination from '@/pages/Divination'
import { readQuota, consumeQuota, resetQuota } from '@/lib/quota'
import { getAllRecords, clearAllRecords } from '@/lib/storage'
import * as auth from '@/lib/auth'

vi.mock('@/lib/seo', () => ({ SEO: () => null }))
vi.mock('@/components/layout/PageLayout', () => ({ PageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('framer-motion', () => ({ motion: { form: 'form', button: 'button', div: 'div' }, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

function renderDivination() {
  return render(<MemoryRouter><Divination /></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  clearAllRecords()
  vi.restoreAllMocks()
})

describe('Divination quota gate', () => {
  it('renders form when quota allows', () => {
    renderDivination()
    expect(screen.getByRole('button', { name: /启\s*卦/ })).toBeInTheDocument()
  })

  // CRITICAL 2 + 3: Selector fixed (NumberBox strips maxLength — use placeholder),
  // verify gate actually fires, and add negative assertions (no record saved,
  // quota unchanged on blocked attempt).
  it('opens SmsModal when quota=0 on submit; does not save record', async () => {
    consumeQuota()
    expect(readQuota().remaining).toBe(0)
    renderDivination()

    // Use placeholder — NumberBox strips maxLength via Omit and renders
    // type="text" inputs with placeholder="···".
    const inputs = screen.getAllByPlaceholderText('···')
    expect(inputs.length).toBeGreaterThanOrEqual(3)
    fireEvent.change(inputs[0], { target: { value: '427' } })
    fireEvent.change(inputs[1], { target: { value: '831' } })
    fireEvent.change(inputs[2], { target: { value: '562' } })

    const button = screen.getByRole('button', { name: /启\s*卦/ })
    expect(button).not.toBeDisabled()
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByText('用手机号注册')).toBeInTheDocument())

    // Negative assertion: no record saved on blocked attempt.
    expect(getAllRecords().length).toBe(0)
    // Negative assertion: quota still 0 — we did NOT consume on blocked attempt.
    expect(readQuota().remaining).toBe(0)
  })

  // IMPORTANT 4: registered-mode bypass.
  it('does NOT open SmsModal when mode=registered (bypass)', async () => {
    resetQuota()
    expect(readQuota().mode).toBe('registered')

    renderDivination()

    const inputs = screen.getAllByPlaceholderText('···')
    fireEvent.change(inputs[0], { target: { value: '123' } })
    fireEvent.change(inputs[1], { target: { value: '456' } })
    fireEvent.change(inputs[2], { target: { value: '789' } })

    fireEvent.click(screen.getByRole('button', { name: /启\s*卦/ }))

    // Wait a tick to make sure any modal would have appeared.
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('用手机号注册')).not.toBeInTheDocument()
    // Record should have been saved successfully.
    await waitFor(() => expect(getAllRecords().length).toBe(1))
  })

  // IMPORTANT 5: SmsModal.onSuccess side-effects (markRegistered + resetQuota).
  it('SmsModal.onSuccess calls markRegistered(phone) and resetQuota()', async () => {
    const markRegisteredSpy = vi.spyOn(auth, 'markRegistered')

    // Mock fetch for /api/auth/sms/send and /api/auth/sms/verify (both 200).
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    consumeQuota()
    renderDivination()

    const inputs = screen.getAllByPlaceholderText('···')
    fireEvent.change(inputs[0], { target: { value: '427' } })
    fireEvent.change(inputs[1], { target: { value: '831' } })
    fireEvent.change(inputs[2], { target: { value: '562' } })
    fireEvent.click(screen.getByRole('button', { name: /启\s*卦/ }))

    await waitFor(() => expect(screen.getByText('用手机号注册')).toBeInTheDocument())

    // Step 1: enter phone, click send.
    const phoneInput = screen.getByLabelText('手机号') as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '13800138000' } })
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    // Step 2: enter code, click verify.
    await waitFor(() => expect(screen.getByText('输入验证码')).toBeInTheDocument())
    const codeInput = screen.getByLabelText('验证码') as HTMLInputElement
    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '注册' }))

    // Side-effects fired.
    await waitFor(() => expect(markRegisteredSpy).toHaveBeenCalledWith('13800138000'))
    expect(readQuota().mode).toBe('registered')
  })
})

describe('Divination quota gate — divination() throws', () => {
  // IMPORTANT 6: consumeQuota does NOT run if divination() throws.
  // We need a top-level vi.mock of the divination module so the
  // DivinationForm's binding to `divination` is replaced.
  it('does not consume quota when divination() throws', async () => {
    expect(readQuota().remaining).toBe(1)

    // Use vi.resetModules + vi.doMock pattern. We mock the module to throw.
    vi.resetModules()
    vi.doMock('@/lib/divination', () => ({
      divination: () => { throw new Error('boom') },
    }))
    // Re-import the Divination page with the mocked dependency.
    const { default: DivinationThrowing } = await import('@/pages/Divination')

    render(<MemoryRouter><DivinationThrowing /></MemoryRouter>)

    const inputs = screen.getAllByPlaceholderText('···')
    fireEvent.change(inputs[0], { target: { value: '123' } })
    fireEvent.change(inputs[1], { target: { value: '456' } })
    fireEvent.change(inputs[2], { target: { value: '789' } })
    fireEvent.click(screen.getByRole('button', { name: /启\s*卦/ }))

    // Wait a tick for the error path to settle.
    await new Promise((r) => setTimeout(r, 50))

    // Quota unchanged.
    expect(readQuota().remaining).toBe(1)
    expect(getAllRecords().length).toBe(0)

    // Restore for other tests.
    vi.doUnmock('@/lib/divination')
    vi.resetModules()
  })
})