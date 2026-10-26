import { describe, expect, it } from 'vitest'
import hexagrams from '@/data/hexagrams.json'
import reference from '../fixtures/zhouyi-xiaoxiang.json'

const words = (s: string) => s.replace(/[^\p{Script=Han}]/gu, '')

describe('classical text collation', () => {
  it('matches all 384 small-image passages to the dated external reference', () => {
    expect(reference.entries).toHaveLength(64)
    for (const h of hexagrams) {
      const source = reference.entries.find((entry) => entry.id === h.id)!
      expect(source.revision).toContain('oldid=')
      expect(h.xiangzhuan.xiaoXiang.map(words), h.name).toEqual(
        source.xiaoXiang.map(words),
      )
    }
  })

  it('preserves the correct line label for all 384 yin/yang lines', () => {
    for (const h of hexagrams)
      for (const line of h.yaoLines) {
        const n = line.type === 'yang' ? '九' : '六'
        const prefix =
          line.position === 1
            ? '初' + n
            : line.position === 6
              ? '上' + n
              : n + '一二三四五六'[line.position - 1]
        expect(
          line.originalText.startsWith(prefix),
          `${h.name} ${line.position}`,
        ).toBe(true)
      }
  })

  it('keeps the corrected 乾 and 损 anchors and separates 用九/用六', () => {
    expect(hexagrams[0].tuanzhuan).toContain('大明终始')
    expect(hexagrams[0].modernInterpretation).toContain('六爻皆阳')
    expect(hexagrams[0].yaoLines[2].explanation).toContain('重刚而不中')
    expect(hexagrams[40].xiangzhuan.xiaoXiang[3]).toBe('损其疾，亦可喜也。')
    expect(hexagrams[40].xiangzhuan.xiaoXiang[4]).toBe('六五元吉，自上佑也。')
    expect(hexagrams[0].specialText?.label).toBe('用九')
    expect(hexagrams[1].specialText?.label).toBe('用六')
    expect(hexagrams.every((h) => h.yaoLines.length === 6)).toBe(true)
  })
})
