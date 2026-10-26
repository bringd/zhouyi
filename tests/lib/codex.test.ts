import { describe, expect, it } from 'vitest'
import data from '@/data/hexagrams.json'
import { filterCodex, groupCodex, parseHexagramId } from '@/lib/codex'
import type { Hexagram } from '@/types'

const hexagrams = data as Hexagram[]

describe('codex catalogue', () => {
  it('sorts palaces by their traditional line-change roles', () => {
    const groups = groupCodex(hexagrams, 'palace')
    expect(groups.map((group) => group.label)).toEqual([
      '乾宫',
      '震宫',
      '坎宫',
      '艮宫',
      '坤宫',
      '巽宫',
      '离宫',
      '兑宫',
    ])
    expect(groups[0].items.map((h) => h.id)).toEqual([
      1, 44, 33, 12, 20, 23, 35, 14,
    ])
    for (const group of groups)
      expect(group.items.map((h) => h.palaceRole)).toEqual([
        '本宫卦',
        '一世',
        '二世',
        '三世',
        '四世',
        '五世',
        '游魂',
        '归魂',
      ])
  })

  it('keeps the sequence view unique and ordered regardless of input order', () => {
    expect(
      groupCodex([...hexagrams].reverse(), 'sequence')[0].items.map(
        (h) => h.id,
      ),
    ).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })

  it.each(['41', '第41卦', '４１', '损', '山泽损', '简约'])(
    'finds 损 by %s',
    (query) => {
      expect(filterCodex(hexagrams, query).map((h) => h.id)).toContain(41)
    },
  )

  it('matches an exact number and handles empty/no-result searches', () => {
    expect(filterCodex(hexagrams, '1').map((h) => h.id)).toEqual([1])
    expect(filterCodex(hexagrams, '   ')).toHaveLength(64)
    expect(filterCodex(hexagrams, '不存在的卦')).toEqual([])
  })

  it.each(['0', '65', '-1', '1abc', '1.5', '01', '', undefined])(
    'rejects invalid route id %s',
    (id) => {
      expect(parseHexagramId(id)).toBeNull()
    },
  )

  it.each(['1', '41', '64'])('accepts valid route id %s', (id) => {
    expect(parseHexagramId(id)).toBe(Number(id))
  })
})
