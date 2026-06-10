import { useState, useMemo } from 'react'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { cn } from '@/utils/cn'
import type { Hexagram, Theme } from '@/types'

export interface CodexGridProps {
  /** All hexagrams to display */
  hexagrams: Hexagram[]
  /** Initial view mode */
  defaultView?: 'theme' | 'palace'
  className?: string
}

/**
 * 64-hexagram codex grid with theme/palace grouping tabs.
 * Default: theme (per brainstorming decision H).
 */
export function CodexGrid({ hexagrams, defaultView = 'theme', className }: CodexGridProps) {
  const [view, setView] = useState<'theme' | 'palace'>(defaultView)

  const grouped = useMemo(() => {
    if (view === 'theme') {
      return groupByTheme(hexagrams)
    } else {
      return groupByPalace(hexagrams)
    }
  }, [view, hexagrams])

  return (
    <div className={cn('w-full', className)}>
      {/* Tab strip */}
      <div className="flex justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setView('theme')}
          className={cn(
            'px-5 py-2 rounded-sm font-display text-sm transition-colors',
            view === 'theme'
              ? 'bg-june-red text-rice'
              : 'bg-rice text-ink border border-june-bronze hover:bg-rice-dark'
          )}
          aria-pressed={view === 'theme'}
        >
          主题分类
        </button>
        <button
          type="button"
          onClick={() => setView('palace')}
          className={cn(
            'px-5 py-2 rounded-sm font-display text-sm transition-colors',
            view === 'palace'
              ? 'bg-june-red text-rice'
              : 'bg-rice text-ink border border-june-bronze hover:bg-rice-dark'
          )}
          aria-pressed={view === 'palace'}
        >
          八宫
        </button>
      </div>

      {/* Grouped grid */}
      <div className="space-y-8">
        {Object.entries(grouped).map(([groupName, items]) => (
          <section key={groupName}>
            <h3 className="text-lg font-display text-ink mb-3 border-b border-june-bronze/30 pb-2">
              {groupName} <span className="text-sm text-ink-light">({items.length})</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {items.map((h) => (
                <HexagramCard key={h.id} hexagram={h} size="sm" showKeywords={false} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

// Inline grouping helpers (could be moved to a lib/ file later)
const THEME_LABELS: Record<Theme, string> = {
  '人生总论': '人生总论',
  '事业行动': '事业行动',
  '关系情感': '关系情感',
  '成长修养': '成长修养',
  '困境抉择': '困境抉择',
  '顺遂归藏': '顺遂归藏',
}

function groupByTheme(hexagrams: Hexagram[]): Record<string, Hexagram[]> {
  const groups: Record<string, Hexagram[]> = {}
  for (const h of hexagrams) {
    for (const theme of h.theme) {
      const label = THEME_LABELS[theme] ?? theme
      if (!groups[label]) groups[label] = []
      groups[label].push(h)
    }
  }
  // Sort each group by id
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.id - b.id)
  }
  return groups
}

const PALACE_LABELS: Record<number, string> = {
  1: '乾宫',
  2: '兑宫',
  3: '离宫',
  4: '震宫',
  5: '巽宫',
  6: '坎宫',
  7: '艮宫',
  8: '坤宫',
}

function groupByPalace(hexagrams: Hexagram[]): Record<string, Hexagram[]> {
  const groups: Record<string, Hexagram[]> = {}
  for (const h of hexagrams) {
    const label = PALACE_LABELS[h.palace] ?? `宫${h.palace}`
    if (!groups[label]) groups[label] = []
    groups[label].push(h)
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.id - b.id)
  }
  return groups
}
