import { useEffect, useId, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { useAppearance } from '@/contexts/AppearanceContext'
import { APPEARANCE_OPTIONS } from '@/lib/appearance'
import { cn } from '@/utils/cn'

export interface AppearanceSwitcherProps {
  className?: string
}

/**
 * 顶栏「外观」快捷入口。
 *
 * - 点击即生效，不需要刷新或再次保存；
 * - 展开后是一个 menu，用 menuitemradio 表达「三选一」的语义，
 *   选中态同时有勾号与文字，不只靠颜色；
 * - 键盘：Enter/Space/↓ 展开，↑↓ 在选项间移动，Esc 关闭并把焦点还给按钮，
 *   Tab 离开时收起。
 */
export function AppearanceSwitcher({ className }: AppearanceSwitcherProps) {
  const { appearance, setAppearance, notice } = useAppearance()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitemradio"]'
    )
    first?.focus()
  }, [open])

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]'
      ) ?? []
    )
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement
    )
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(currentIndex + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(currentIndex - 1 + items.length) % items.length]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const currentName =
    APPEARANCE_OPTIONS.find((option) => option.id === appearance)?.name ?? ''

  return (
    <div className={cn('appearance-switcher', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="appearance-switcher__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        aria-label={`外观：${currentName}`}
      >
        <Palette size={16} aria-hidden="true" />
        <span className="appearance-switcher__label" aria-hidden="true">
          外观
        </span>
        <span className="appearance-switcher__current" aria-hidden="true">
          {currentName}
        </span>
      </button>

      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label="选择外观"
        className={cn('appearance-switcher__menu', open && 'is-open')}
        hidden={!open}
        onKeyDown={onMenuKeyDown}
      >
        {APPEARANCE_OPTIONS.map((option) => {
          const selected = option.id === appearance
          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={cn(
                'appearance-switcher__item',
                selected && 'is-selected'
              )}
              onClick={() => {
                setAppearance(option.id)
                close()
              }}
            >
              <span
                className="appearance-switcher__swatch"
                aria-hidden="true"
                style={{
                  background: option.swatch.paper,
                  borderColor: option.swatch.ink,
                }}
              >
                <i style={{ background: option.swatch.accent }} />
              </span>
              <span className="appearance-switcher__text">
                <b>{option.name}</b>
                <small>{option.tagline}</small>
              </span>
              {selected && (
                <Check size={15} className="appearance-switcher__check" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      {notice && (
        <p className="appearance-switcher__notice" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
