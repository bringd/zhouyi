import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SmsModal } from '@/components/auth/SmsModal'

beforeEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('SmsModal', () => {
  it('renders phone input on first step', () => {
    render(<SmsModal onClose={() => {}} onSuccess={() => {}} />)
    expect(screen.getByLabelText(/手机号/)).toBeInTheDocument()
  })

  it('rejects invalid phone format', async () => {
    render(<SmsModal onClose={() => {}} onSuccess={() => {}} />)
    const input = screen.getByLabelText(/手机号/)
    fireEvent.change(input, { target: { value: '12345' } })
    fireEvent.click(screen.getByText(/发送验证码/))
    await waitFor(() => {
      expect(screen.getByText(/手机号格式错误/)).toBeInTheDocument()
    })
  })

  it('moves to code step after send success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ttl: 300, message: '已发送' }),
    }))
    render(<SmsModal onClose={() => {}} onSuccess={() => {}} />)
    const input = screen.getByLabelText(/手机号/)
    fireEvent.change(input, { target: { value: '13800138000' } })
    fireEvent.click(screen.getByText(/发送验证码/))
    await waitFor(() => {
      expect(screen.getByLabelText(/验证码/)).toBeInTheDocument()
    })
  })

  it('calls onSuccess + onClose after verify', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    let callIdx = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callIdx++
      if (callIdx === 1) return { ok: true, status: 200, json: async () => ({ ttl: 300 }) }
      return { ok: true, status: 200, json: async () => ({ userId: 'u1', mode: 'registered' }) }
    }))

    render(<SmsModal onClose={onClose} onSuccess={onSuccess} />)
    fireEvent.change(screen.getByLabelText(/手机号/), { target: { value: '13800138000' } })
    fireEvent.click(screen.getByText(/发送验证码/))

    await waitFor(() => screen.getByLabelText(/验证码/))
    fireEvent.change(screen.getByLabelText(/验证码/), { target: { value: '123456' } })
    fireEvent.click(screen.getByText(/注册/))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('13800138000')
      expect(onClose).toHaveBeenCalled()
    })
  })
})
