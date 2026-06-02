import { cn } from '@/utils/cn'

export type RelationType = 'opposite' | 'inverse' | 'nuclear' | 'changed'

export interface RelationTabsProps {
  /** Currently active tab */
  active: RelationType
  /** Called when tab changes */
  onChange: (relation: RelationType) => void
  /** Tabs to show (default: all 4) */
  tabs?: ReadonlyArray<{ key: RelationType; label: string }>
  className?: string
}

const DEFAULT_TABS: ReadonlyArray<{ key: RelationType; label: string }> = [
  { key: 'opposite', label: '错卦' },
  { key: 'inverse', label: '综卦' },
  { key: 'nuclear', label: '互卦' },
  { key: 'changed', label: '变卦' },
]

/**
 * Tab strip for switching between hexagram relationships.
 */
export function RelationTabs({ active, onChange, tabs = DEFAULT_TABS, className }: RelationTabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2 justify-center', className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'px-4 py-2 rounded-sm font-display text-sm transition-colors',
              isActive
                ? 'bg-june-red text-rice border border-june-red'
                : 'bg-rice text-ink border border-june-bronze hover:bg-rice-dark'
            )}
            aria-pressed={isActive}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
