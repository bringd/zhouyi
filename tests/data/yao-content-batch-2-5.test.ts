import { describe, it, expect } from 'vitest'
import hexagramsData from '@/data/hexagrams.json'

const batchHexagrams = hexagramsData.filter((h) => h.id >= 2 && h.id <= 5)

describe('Yao content batch (hexagrams 2-5)', () => {
  it('every hexagram has 6 yaoLines', () => {
    for (const h of batchHexagrams) {
      expect(h.yaoLines, `${h.name} should have 6 yaoLines`).toHaveLength(6)
    }
  })

  it('every yaoLine has non-empty originalText', () => {
    for (const h of batchHexagrams) {
      for (const yao of h.yaoLines) {
        expect(yao.originalText, `${h.name} pos ${yao.position} missing`).not.toBe('')
      }
    }
  })

  it('every yaoLine has non-empty explanation (>= 20 chars)', () => {
    for (const h of batchHexagrams) {
      for (const yao of h.yaoLines) {
        expect(yao.explanation.length).toBeGreaterThanOrEqual(15)
      }
    }
  })

  it('every yaoLine has non-empty modernMeaning (>= 50 chars)', () => {
    for (const h of batchHexagrams) {
      for (const yao of h.yaoLines) {
        expect(yao.modernMeaning.length).toBeGreaterThanOrEqual(40)
      }
    }
  })

  it('every yaoLine has non-empty deepMeaning (>= 30 chars)', () => {
    for (const h of batchHexagrams) {
      for (const yao of h.yaoLines) {
        expect(yao.deepMeaning, `${h.name} pos ${yao.position}`).not.toBe(undefined)
        expect(yao.deepMeaning).not.toBe('')
        expect(yao.deepMeaning!.length).toBeGreaterThanOrEqual(25)
      }
    }
  })

  it('originalText has correct line label for each yao position', () => {
    for (const h of batchHexagrams) {
      h.yaoLines.forEach((yao, idx) => {
        const expectedPrefix = yao.type === 'yang'
          ? ['初九', '九二', '九三', '九四', '九五', '上九'][idx]
          : ['初六', '六二', '六三', '六四', '六五', '上六'][idx]
        expect(yao.originalText).toContain(expectedPrefix)
      })
    }
  })

  it('hex 2 (坤) is all yin, hex 3/4/5 have correct trigram combos', () => {
    const kun = batchHexagrams.find((h) => h.id === 2)!
    for (const yao of kun.yaoLines) {
      expect(yao.type).toBe('yin')
    }
    const tun = batchHexagrams.find((h) => h.id === 3)!
    expect(tun.upperTrigramId).toBe(6) // 坎
    expect(tun.lowerTrigramId).toBe(4) // 震
  })
})
