import { describe, it, expect } from 'vitest'
import { cn } from '@/utils/cn'

describe('cn', () => {
  it('concatenates string class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('handles conditional class names with &&', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  it('handles object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('handles array syntax', () => {
    expect(cn('base', ['a', 'b'])).toBe('base a b')
  })

  it('returns empty string when no inputs', () => {
    expect(cn()).toBe('')
  })
})
