import { describe, it, expect } from 'vitest'
import hexagramsData from '@/data/hexagrams.json'

describe('Hexagram classical text content', () => {
  it('every hexagram has non-empty judgement', () => {
    for (const h of hexagramsData) {
      expect(
        h.judgement,
        `hexagram ${h.id} ${h.name} has empty judgement`,
      ).not.toBe('')
    }
  })

  it('every hexagram has non-empty tuanzhuan', () => {
    for (const h of hexagramsData) {
      expect(
        h.tuanzhuan,
        `hexagram ${h.id} ${h.name} has empty tuanzhuan`,
      ).not.toBe('')
    }
  })

  it('every hexagram has non-empty daXiang', () => {
    for (const h of hexagramsData) {
      expect(
        h.xiangzhuan.daXiang,
        `hexagram ${h.id} ${h.name} has empty daXiang`,
      ).not.toBe('')
    }
  })

  it('every hexagram has 6 xiaoXiang entries', () => {
    for (const h of hexagramsData) {
      expect(h.xiangzhuan.xiaoXiang).toHaveLength(6)
    }
  })

  it('at least 80% of xiaoXiang entries are non-empty (some hexagrams may lack per-line commentary)', () => {
    let total = 0
    let nonEmpty = 0
    for (const h of hexagramsData) {
      for (const line of h.xiangzhuan.xiaoXiang) {
        total++
        if (line !== '') nonEmpty++
      }
    }
    const ratio = nonEmpty / total
    expect(ratio).toBeGreaterThan(0.8)
  })
})
