import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAuthState, refreshAuth, markRegistered } from '@/lib/auth'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('auth', () => {
  it('initial state is loading', () => {
    expect(getAuthState().status).toBe('loading')
  })

  it('refreshAuth fetches /api/auth/me and stores in cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ userId: 'u1', mode: 'guest', remaining: 1 }),
    }))

    const state = await refreshAuth()
    expect(state.status).toBe('guest')
    if (state.status === 'guest') {
      expect(state.userId).toBe('u1')
    }
  })

  it('cache: second getAuthState returns cached without fetch', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      calls++
      return { json: async () => ({ userId: 'u1', mode: 'guest', remaining: 1 }) }
    }))

    await refreshAuth()
    getAuthState()
    expect(calls).toBe(1)
  })

  it('markRegistered updates cache to registered', () => {
    markRegistered('13800138000')
    const state = getAuthState()
    expect(state.status).toBe('registered')
    if (state.status === 'registered') {
      expect(state.phone).toBe('13800138000')
    }
  })
})