import type { Hexagram, HexagramId, PalaceRole, Theme } from '@/types'

export type CodexView = 'theme' | 'palace' | 'sequence'
export interface CodexGroup {
  label: string
  items: Hexagram[]
}

export const CODEX_THEMES: readonly Theme[] = [
  '人生总论',
  '事业行动',
  '关系情感',
  '成长修养',
  '困境抉择',
  '顺遂归藏',
]
export const PALACE_NAMES: Record<number, string> = {
  1: '乾宫',
  2: '兑宫',
  3: '离宫',
  4: '震宫',
  5: '巽宫',
  6: '坎宫',
  7: '艮宫',
  8: '坤宫',
}
const PALACE_ORDER = [1, 4, 6, 7, 8, 5, 3, 2]
const ROLE_ORDER: readonly PalaceRole[] = [
  '本宫卦',
  '一世',
  '二世',
  '三世',
  '四世',
  '五世',
  '游魂',
  '归魂',
]

export function parseHexagramId(value: string | undefined): HexagramId | null {
  return value && /^(?:[1-9]|[1-5]\d|6[0-4])$/.test(value)
    ? (Number(value) as HexagramId)
    : null
}

export function filterCodex(
  hexagrams: readonly Hexagram[],
  query: string,
): Hexagram[] {
  const text = query.normalize('NFKC').trim().toLowerCase()
  if (!text) return [...hexagrams]
  const number = text.match(/^第?\s*(\d+)\s*卦?$/)
  if (number) return hexagrams.filter((h) => h.number === Number(number[1]))
  const terms = text.split(/\s+/)
  return hexagrams.filter((h) => {
    const words = [h.name, h.shortName, ...h.keywords, ...h.theme]
      .join(' ')
      .toLowerCase()
    return terms.every((term) => words.includes(term))
  })
}

export function groupCodex(
  hexagrams: readonly Hexagram[],
  view: CodexView,
): CodexGroup[] {
  if (!hexagrams.length) return []
  if (view === 'sequence')
    return [
      {
        label: '文王卦序',
        items: [...hexagrams].sort((a, b) => a.number - b.number),
      },
    ]
  if (view === 'theme')
    return CODEX_THEMES.map((label) => ({
      label,
      items: hexagrams
        .filter((h) => h.theme.includes(label))
        .sort((a, b) => a.number - b.number),
    })).filter((group) => group.items.length)
  return PALACE_ORDER.map((palace) => ({
    label: PALACE_NAMES[palace],
    items: hexagrams
      .filter((h) => h.palace === palace)
      .sort(
        (a, b) =>
          ROLE_ORDER.indexOf(a.palaceRole) - ROLE_ORDER.indexOf(b.palaceRole),
      ),
  })).filter((group) => group.items.length)
}
