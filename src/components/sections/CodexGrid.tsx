import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { filterCodex, groupCodex, type CodexView } from '@/lib/codex'
import { cn } from '@/utils/cn'
import type { Hexagram } from '@/types'
import '@/styles/codex.css'

export interface CodexGridProps {
  hexagrams: Hexagram[]
  defaultView?: CodexView
  className?: string
}

const VIEWS: { id: CodexView; label: string }[] = [
  { id: 'theme', label: '主题分类' },
  { id: 'sequence', label: '卦序浏览' },
  { id: 'palace', label: '八宫' },
]

export function CodexGrid({
  hexagrams,
  defaultView = 'theme',
  className,
}: CodexGridProps) {
  const [params, setParams] = useSearchParams()
  const requestedView = params.get('view')
  const view = VIEWS.some((v) => v.id === requestedView)
    ? (requestedView as CodexView)
    : defaultView
  const query = params.get('q') ?? ''
  const allGroups = useMemo(
    () => groupCodex(hexagrams, view),
    [hexagrams, view],
  )
  const group = allGroups.some((g) => g.label === params.get('group'))
    ? (params.get('group') ?? '')
    : ''
  const matches = useMemo(
    () => filterCodex(hexagrams, query),
    [hexagrams, query],
  )
  const groups = groupCodex(matches, view).filter(
    (g) => !group || g.label === group,
  )
  const count = new Set(groups.flatMap((g) => g.items.map((h) => h.id))).size
  const scrollKey =
    'zhouyi:codex:scroll:' + JSON.stringify([view, query, group])

  // Both browser Back and the explicit return link restore the catalogue position.
  useEffect(() => {
    let frame: number | undefined
    try {
      const top = Number(sessionStorage.getItem(scrollKey))
      if (top > 0 && Number.isFinite(top))
        frame = requestAnimationFrame(() => window.scrollTo(0, top))
    } catch {
      /* Browsing still works when session storage is disabled. */
    }
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
    // Restore once on mount, not on every search keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (changes: Record<string, string>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div
      className={cn('codex-catalog', className)}
      onClickCapture={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest('a[data-hexagram-link]')
        )
          return
        try {
          sessionStorage.setItem(scrollKey, String(window.scrollY))
        } catch {
          /* Optional UI state. */
        }
      }}
    >
      <div
        className="codex-catalog__views"
        role="group"
        aria-label="图鉴浏览方式"
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => update({ view: v.id, group: '' })}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="codex-catalog__tools">
        <label className="codex-catalog__search">
          <span>查找卦象</span>
          <input
            type="search"
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="卦名、卦序或关键词，例如：损、41、修身"
          />
        </label>
        {view !== 'sequence' && (
          <label className="codex-catalog__group">
            <span>{view === 'palace' ? '选择宫位' : '选择主题'}</span>
            <select
              value={group}
              onChange={(e) => update({ group: e.target.value })}
            >
              <option value="">
                全部{view === 'palace' ? '宫位' : '主题'}
              </option>
              {allGroups.map((g) => (
                <option key={g.label} value={g.label}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(query || group) && (
          <button
            type="button"
            className="codex-catalog__clear"
            onClick={() => update({ q: '', group: '' })}
          >
            清除筛选
          </button>
        )}
      </div>
      <p className="codex-catalog__summary" role="status" aria-live="polite">
        显示 {count} / {hexagrams.length} 卦
        {view === 'theme'
          ? ' · 同一卦可归入多个主题'
          : view === 'palace'
            ? ' · 按本宫、世次、游魂、归魂排列'
            : ' · 按文王卦序排列'}
      </p>
      {!groups.length && (
        <div className="codex-catalog__empty">
          <h2>没有找到对应卦象</h2>
          <p>试试卦名、1—64 的卦序，或清除筛选条件。</p>
        </div>
      )}
      <div className="codex-catalog__groups">
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h2 className="codex-catalog__heading">
              {g.label} <span>({g.items.length})</span>
            </h2>
            <div className="codex-catalog__grid">
              {g.items.map((h) => (
                <HexagramCard
                  key={h.id}
                  hexagram={h}
                  size="sm"
                  showNumber
                  showPalaceRole={view === 'palace'}
                  detailTo={`/hexagram/${h.id}${params.size ? '?' + params.toString() : ''}`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
