import { describe, it, expect } from 'vitest'
import { getRandomSampleQuestion, QUESTION_POOL } from '@/lib/sampleQuestions'

describe('sampleQuestions', () => {
  it('pool has at least 5 questions', () => {
    expect(QUESTION_POOL.length).toBeGreaterThanOrEqual(5)
  })

  it('every question is a non-empty string', () => {
    for (const q of QUESTION_POOL) {
      expect(typeof q).toBe('string')
      expect(q.trim().length).toBeGreaterThan(0)
    }
  })

  it('returns a member of the pool', () => {
    for (let i = 0; i < 50; i++) {
      expect(QUESTION_POOL).toContain(getRandomSampleQuestion())
    }
  })

  it('can produce different values across calls (statistically)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      seen.add(getRandomSampleQuestion())
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})