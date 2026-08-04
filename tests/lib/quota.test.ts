import { describe, it, expect, beforeEach } from 'vitest'
import { readQuota, consumeQuota, resetQuota } from '@/lib/quota'

describe('quota', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('readQuota returns initial state: guest + remaining 1', () => {
    const q = readQuota()
    expect(q.mode).toBe('guest')
    expect(q.remaining).toBe(1)
  })

  it('consumeQuota decrements remaining', () => {
    consumeQuota()
    const q = readQuota()
    expect(q.remaining).toBe(0)
  })

  it('consumeQuota clamps at 0', () => {
    consumeQuota()
    consumeQuota()
    consumeQuota()
    expect(readQuota().remaining).toBe(0)
  })

  it('resetQuota switches to registered mode', () => {
    resetQuota()
    const q = readQuota()
    expect(q.mode).toBe('registered')
    expect(q.remaining).toBeNull()
  })

  it('reads existing state from localStorage', () => {
    localStorage.setItem('zhouyi:quota:divination', JSON.stringify({
      mode: 'guest',
      remaining: 0,
      updatedAt: Date.now(),
    }))
    expect(readQuota().remaining).toBe(0)
  })
})
