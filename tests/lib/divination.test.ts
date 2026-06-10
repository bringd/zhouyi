import { describe, it, expect } from 'vitest'
import { divination, isValidDivinationNumber, flipLine } from '@/lib/divination'

describe('isValidDivinationNumber', () => {
  it('accepts 3-digit numbers', () => {
    expect(isValidDivinationNumber(100)).toBe(true)
    expect(isValidDivinationNumber(999)).toBe(true)
    expect(isValidDivinationNumber(427)).toBe(true)
  })

  it('rejects numbers outside 100-999', () => {
    expect(isValidDivinationNumber(99)).toBe(false)
    expect(isValidDivinationNumber(1000)).toBe(false)
    expect(isValidDivinationNumber(0)).toBe(false)
    expect(isValidDivinationNumber(-1)).toBe(false)
  })

  it('rejects non-integers', () => {
    expect(isValidDivinationNumber(100.5)).toBe(false)
    expect(isValidDivinationNumber(427.1)).toBe(false)
  })
})

describe('flipLine (helper)', () => {
  it('flips position 1 (bottom) — index 0', () => {
    expect(flipLine('111111', 1)).toBe('011111')
  })

  it('flips position 6 (top) — index 5', () => {
    expect(flipLine('000000', 6)).toBe('000001')
  })

  it('flips position 4 — index 3 (山火贲 → 离为火)', () => {
    // 山火贲 = "101001", flipping line 4 (binary[3] = 0) → "101101" = 离为火
    expect(flipLine('101001', 4)).toBe('101101')
  })
})

describe('divination', () => {
  it('calculates lower trigram from A % 8', () => {
    // 427 % 8 = 3 (离)
    const r = divination(427, 800, 500)
    expect(r.lowerTrigramId).toBe(3)
  })

  it('handles A % 8 = 0 → uses 8 (坤)', () => {
    // 800 % 8 = 0, should use trigram 8
    const r = divination(800, 100, 100)
    expect(r.lowerTrigramId).toBe(8)
  })

  it('calculates upper trigram from B % 8', () => {
    // 831 % 8 = 7 (艮)
    const r = divination(427, 831, 500)
    expect(r.upperTrigramId).toBe(7)
  })

  it('handles B % 8 = 0 → uses 8', () => {
    const r = divination(100, 800, 100)
    expect(r.upperTrigramId).toBe(8)
  })

  it('calculates moving line from C % 6', () => {
    // 562 % 6 = 4
    const r = divination(427, 831, 562)
    expect(r.movingLine).toBe(4)
  })

  it('handles C % 6 = 0 → uses 6', () => {
    const r = divination(100, 100, 600)
    expect(r.movingLine).toBe(6)
  })

  it('looks up the main hexagram by (upper, lower) trigrams', () => {
    // upper=7 (艮), lower=3 (离) → 山火贲 (hexagram 22)
    const r = divination(427, 831, 562)
    expect(r.mainHexagramId).toBe(22)
  })

  it('calculates the changed hexagram by flipping the moving line', () => {
    // main = 山火贲 (22), binaryCode = "101001", moving line = 4
    //   position 4 = index 3 in the string; bit is '0', flips to '1'
    //   new binary = "101101" = lower 101 (离) + upper 101 (离) = 离为火 (30)
    const r = divination(427, 831, 562)
    expect(r.changedHexagramId).toBe(30)
  })

  it('end-to-end: A=100,B=100,C=100 → 震上震下 (51), changed 24', () => {
    // 100 % 8 = 4 (震), 100 % 6 = 4
    // main = (4, 4) = 震为雷 (51), binary 100100
    // flipping position 4 (binary[3] = 1 → 0): "100000" = lower 100 + upper 000 = 地雷复 (24)
    const r = divination(100, 100, 100)
    expect(r.lowerTrigramId).toBe(4)
    expect(r.upperTrigramId).toBe(4)
    expect(r.movingLine).toBe(4)
    expect(r.mainHexagramId).toBe(51)
    expect(r.changedHexagramId).toBe(24)
  })

  it('throws on invalid numbers (a out of range)', () => {
    expect(() => divination(99, 500, 500)).toThrow(/a=99/)
  })

  it('throws on invalid numbers (b out of range)', () => {
    expect(() => divination(500, 1000, 500)).toThrow(/b=1000/)
  })

  it('throws on invalid numbers (c out of range)', () => {
    expect(() => divination(500, 500, 50)).toThrow(/c=50/)
  })

  it('throws on non-integer numbers', () => {
    expect(() => divination(100.5, 500, 500)).toThrow()
  })
})
