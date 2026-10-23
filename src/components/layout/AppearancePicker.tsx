import { useRef } from 'react'
import { Check } from 'lucide-react'
import { useAppearance } from '@/contexts/AppearanceContext'
import { APPEARANCE_OPTIONS, type AppearanceId } from '@/lib/appearance'
import { cn } from '@/utils/cn'

export interface AppearancePickerProps {
  className?: string
}

/**
 * 设置页的「外观」选择区：三张可选卡片。
 *
 * 语义：用 radiogroup + radio（而不是一排普通按钮），因为这是「三选一」；
 * 选中态同时有边框、勾号和「当前外观」文字，不只靠颜色表达。
 * 键盘：← → ↑ ↓ 在卡片间移动，Home/End 跳到首尾，Space/Enter 选中。
 */
export function AppearancePicker({ className }: AppearancePickerProps) {
  const { appearance, setAppearance, notice } = useAppearance()
  const listRef = useRef<HTMLDivElement>(null)

  const focusCard = (id: AppearanceId) => {
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-appearance-id="${id}"]`)
      ?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const ids = APPEARANCE_OPTIONS.map((option) => option.id)
    const index = ids.indexOf(appearance)
    let next: AppearanceId | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = ids[(index + 1) % ids.length]
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = ids[(index - 1 + ids.length) % ids.length]
    } else if (event.key === 'Home') {
      next = ids[0]
    } else if (event.key === 'End') {
      next = ids[ids.length - 1]
    }
    if (next) {
      event.preventDefault()
      setAppearance(next)
      focusCard(next)
    }
  }

  return (
    <section
      className={cn('appearance-picker', className)}
      aria-labelledby="appearance-picker-title"
    >
      <div className="appearance-picker__heading">
        <h2 id="appearance-picker-title" className="font-display text-lg">
          外 观
        </h2>
        <p className="appearance-picker__hint">
          切换后立即生效，网站会记住你的选择。
        </p>
      </div>

      <div
        ref={listRef}
        role="radiogroup"
        aria-labelledby="appearance-picker-title"
        className="appearance-picker__list"
        onKeyDown={onKeyDown}
      >
        {APPEARANCE_OPTIONS.map((option) => {
          const selected = option.id === appearance
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-appearance-id={option.id}
              className={cn(
                'appearance-picker__card',
                selected && 'is-selected'
              )}
              onClick={() => setAppearance(option.id)}
            >
              <span
                className="appearance-picker__preview"
                aria-hidden="true"
                style={{
                  background: option.swatch.paper,
                  borderColor: option.swatch.ink,
                }}
              >
                <i style={{ background: option.swatch.ink }} />
                <i style={{ background: option.swatch.accent }} />
                <i style={{ background: option.swatch.ink }} />
              </span>
              <span className="appearance-picker__meta">
                <b>{option.name}</b>
                <small>{option.tagline}</small>
                <span className="appearance-picker__desc">
                  {option.description}
                </span>
              </span>
              {selected && (
                <span className="appearance-picker__state">
                  <Check size={14} aria-hidden="true" />
                  当前外观
                </span>
              )}
            </button>
          )
        })}
      </div>

      {notice && (
        <p className="appearance-picker__notice" role="status">
          {notice}
        </p>
      )}
    </section>
  )
}
