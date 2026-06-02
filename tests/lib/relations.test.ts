import { describe, it, expect } from 'vitest'
import { getOpposite, getInverse, getNuclear, getHexagramWithRelations } from '@/lib/relations'

describe('getOpposite (错卦)', () => {
  it('乾 (id=1) opposite is 坤 (id=2)', () => {
    expect(getOpposite(1)).toBe(2)
  })

  it('坤 (id=2) opposite is 乾 (id=1)', () => {
    expect(getOpposite(2)).toBe(1)
  })

  it('泰 (id=11) opposite is 否 (id=12)', () => {
    expect(getOpposite(11)).toBe(12)
  })

  it('否 (id=12) opposite is 泰 (id=11)', () => {
    expect(getOpposite(12)).toBe(11)
  })

  it('坎 (id=29) opposite is 离 (id=30)', () => {
    expect(getOpposite(29)).toBe(30)
  })

  it('离 (id=30) opposite is 坎 (id=29)', () => {
    expect(getOpposite(30)).toBe(29)
  })

  it('既济 (id=63) opposite is 未济 (id=64)', () => {
    expect(getOpposite(63)).toBe(64)
  })

  it('师 (id=7) opposite is 天火同人 (id=13)', () => {
    // 师 binary 010000 → flipped 101111 = lower 101 (离) + upper 111 (乾) = 天火同人
    expect(getOpposite(7)).toBe(13)
  })
})

describe('getInverse (综卦)', () => {
  it('屯 (id=3) inverse is 山水蒙 (id=4)', () => {
    // 屯 binary 100010 → reversed 010001 = lower 010 (坎) + upper 001 (艮) = 山水蒙
    expect(getInverse(3)).toBe(4)
  })

  it('既济 (id=63) inverse is 未济 (id=64)', () => {
    // 101010 is a palindrome under reversal, so the inverse coincides with the opposite.
    expect(getInverse(63)).toBe(64)
  })

  it('未济 (id=64) inverse is 既济 (id=63)', () => {
    expect(getInverse(64)).toBe(63)
  })

  it('随 (id=17) inverse is 蛊 (id=18)', () => {
    // 随 100110 → 011001 = lower 011 (巽) + upper 001 (艮) → 山风蛊 (18)
    expect(getInverse(17)).toBe(18)
  })

  it('蛊 (id=18) inverse is 随 (id=17)', () => {
    expect(getInverse(18)).toBe(17)
  })

  it('泰 (id=11) inverse is 否 (id=12) (palindrome)', () => {
    // 111000 reversed is 000111 = 否. Same as opposite.
    expect(getInverse(11)).toBe(12)
  })
})

describe('getNuclear (互卦)', () => {
  it('乾 (id=1) nuclear is 乾 (id=1)', () => {
    // 111111: lines 2,3,4 = 111, lines 3,4,5 = 111 → 111111 = 乾
    expect(getNuclear(1)).toBe(1)
  })

  it('坤 (id=2) nuclear is 坤 (id=2)', () => {
    // 000000: lines 2,3,4 = 000, lines 3,4,5 = 000 → 000000 = 坤
    expect(getNuclear(2)).toBe(2)
  })

  it('需 (id=5) nuclear is 火泽睽 (id=38)', () => {
    // 需 111010: lines 2,3,4 = 110 (兑), lines 3,4,5 = 101 (离)
    // new binary = 110 101 = lower 110 (兑) + upper 101 (离) = 火泽睽
    expect(getNuclear(5)).toBe(38)
  })

  it('既济 (id=63) nuclear is 未济 (id=64)', () => {
    // 101010: lines 2,3,4 = 010 (坎), lines 3,4,5 = 101 (离)
    // new binary = 010 101 = lower 010 (坎) + upper 101 (离) = 火水未济
    expect(getNuclear(63)).toBe(64)
  })

  it('未济 (id=64) nuclear is 既济 (id=63)', () => {
    expect(getNuclear(64)).toBe(63)
  })

  it('师 (id=7) nuclear is 地雷复 (id=24)', () => {
    // 师 010000: lines 2,3,4 = 100 (震), lines 3,4,5 = 000 (坤)
    // new binary = 100 000 = lower 100 (震) + upper 000 (坤) = 地雷复
    expect(getNuclear(7)).toBe(24)
  })
})

describe('getHexagramWithRelations', () => {
  it('returns the main hexagram plus 3 related hexagrams', () => {
    const r = getHexagramWithRelations(3) // 屯
    expect(r.id).toBe(3)
    expect(r.name).toBe('水雷屯')
    expect(r.opposite.id).toBe(50) // 错卦 of 屯 = 鼎 (011101 = 巽下+离上)
    expect(r.inverse.id).toBe(4) // 综卦 of 屯 = 山水蒙 (010001 = 坎+艮)
    expect(r.nuclear.id).toBe(23) // 互卦 of 屯 = 山地剥 (000 001 = 艮+坤)
  })

  it('乾 is its own opposite/inverse/nuclear', () => {
    const r = getHexagramWithRelations(1)
    expect(r.opposite.id).toBe(2) // 错卦 = 坤
    expect(r.inverse.id).toBe(1) // 综卦: 111111 reversed = 111111 = 乾
    expect(r.nuclear.id).toBe(1) // 互卦: 111111 → 111 111 = 乾
  })
})
