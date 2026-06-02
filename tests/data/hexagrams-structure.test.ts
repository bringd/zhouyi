import { describe, it, expect } from 'vitest'
import trigramsData from '@/data/trigrams.json'
import hexagramsData from '@/data/hexagrams.json'

describe('Data structure sanity', () => {
  it('trigrams.json has exactly 8 entries', () => {
    expect(trigramsData).toHaveLength(8)
  })

  it('trigram IDs are unique and 1-8', () => {
    const ids = trigramsData.map((t) => t.id)
    expect(new Set(ids).size).toBe(8)
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('hexagrams.json has exactly 64 entries', () => {
    expect(hexagramsData).toHaveLength(64)
  })

  it('hexagram IDs are unique and 1-64', () => {
    const ids = hexagramsData.map((h) => h.id)
    expect(new Set(ids).size).toBe(64)
    expect(Math.min(...ids)).toBe(1)
    expect(Math.max(...ids)).toBe(64)
  })

  it('each hexagram has 6 yaoLines', () => {
    for (const h of hexagramsData) {
      expect(h.yaoLines).toHaveLength(6)
    }
  })

  it('each hexagram has 4-6 keywords', () => {
    for (const h of hexagramsData) {
      expect(h.keywords.length).toBeGreaterThanOrEqual(4)
      expect(h.keywords.length).toBeLessThanOrEqual(6)
    }
  })

  it('upper and lower trigram IDs are valid (1-8)', () => {
    for (const h of hexagramsData) {
      expect(h.upperTrigramId).toBeGreaterThanOrEqual(1)
      expect(h.upperTrigramId).toBeLessThanOrEqual(8)
      expect(h.lowerTrigramId).toBeGreaterThanOrEqual(1)
      expect(h.lowerTrigramId).toBeLessThanOrEqual(8)
    }
  })
})
