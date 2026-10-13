import { describe, it, expect } from 'vitest'
import trigramsData from '@/data/trigrams.json'
import hexagramsData from '@/data/hexagrams.json'
import { getOpposite, getInverse, getNuclear } from '@/lib/relations'
import type { HexagramId } from '@/types'

const byBinary = new Map(hexagramsData.map((h) => [h.binaryCode, h.id]))
const byId = new Map(hexagramsData.map((h) => [h.id, h]))

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
      expect(h.yaoLines, `id=${h.id} ${h.name}`).toHaveLength(6)
    }
  })

  it('each hexagram has 4-6 keywords', () => {
    for (const h of hexagramsData) {
      expect(h.keywords.length, `id=${h.id} ${h.name}`).toBeGreaterThanOrEqual(4)
      expect(h.keywords.length, `id=${h.id} ${h.name}`).toBeLessThanOrEqual(6)
    }
  })

  it('upper and lower trigram IDs are valid (1-8)', () => {
    for (const h of hexagramsData) {
      expect(h.upperTrigramId, `id=${h.id}`).toBeGreaterThanOrEqual(1)
      expect(h.upperTrigramId, `id=${h.id}`).toBeLessThanOrEqual(8)
      expect(h.lowerTrigramId, `id=${h.id}`).toBeGreaterThanOrEqual(1)
      expect(h.lowerTrigramId, `id=${h.id}`).toBeLessThanOrEqual(8)
    }
  })
})

describe('relations (错卦 / 综卦 / 互卦)', () => {
  // Audit finding C4: all 192 relation fields held the literal 0 — a dead,
  // wrong schema. scripts/fill-relations.mjs backfilled them.
  it('are legal hexagram ids (1-64) for all 64 entries', () => {
    for (const h of hexagramsData) {
      for (const key of ['opposite', 'inverse', 'nuclear'] as const) {
        expect(h.relations[key], `id=${h.id} ${h.name}.${key}`).toBeGreaterThanOrEqual(1)
        expect(h.relations[key], `id=${h.id} ${h.name}.${key}`).toBeLessThanOrEqual(64)
      }
    }
  })

  // Independent re-derivation from the traditional definitions, straight off
  // binaryCode — no shared code with lib/relations.ts or the fill script.
  // 错卦 = flip all six bits; 综卦 = reverse them; 互卦 = lines 2-3-4 over 3-4-5.
  it('follow the traditional bit definitions', () => {
    const flipAll = (b: string) => [...b].map((c) => (c === '1' ? '0' : '1')).join('')
    const reverseAll = (b: string) => [...b].reverse().join('')
    const nuclearBinary = (b: string) => b.slice(1, 4) + b.slice(2, 5)

    for (const h of hexagramsData) {
      const label = `id=${h.id} ${h.name} (${h.binaryCode})`
      expect(h.relations.opposite, `${label} 错卦`).toBe(byBinary.get(flipAll(h.binaryCode)))
      expect(h.relations.inverse, `${label} 综卦`).toBe(byBinary.get(reverseAll(h.binaryCode)))
      expect(h.relations.nuclear, `${label} 互卦`).toBe(byBinary.get(nuclearBinary(h.binaryCode)))
    }
  })

  // The persisted JSON must agree with what the app actually computes at
  // runtime. Without this, the file could rot while the UI stays correct —
  // which is exactly how the all-zero schema survived unnoticed.
  it('match the runtime computation in lib/relations.ts', () => {
    for (const h of hexagramsData) {
      const id = h.id as HexagramId
      expect(h.relations.opposite, `id=${h.id} ${h.name} opposite`).toBe(getOpposite(id))
      expect(h.relations.inverse, `id=${h.id} ${h.name} inverse`).toBe(getInverse(id))
      expect(h.relations.nuclear, `id=${h.id} ${h.name} nuclear`).toBe(getNuclear(id))
    }
  })

  it('are involutive for 错卦 and 综卦', () => {
    for (const h of hexagramsData) {
      expect(byId.get(h.relations.opposite)!.relations.opposite, `id=${h.id} 错`).toBe(h.id)
      expect(byId.get(h.relations.inverse)!.relations.inverse, `id=${h.id} 综`).toBe(h.id)
    }
  })
})
