import { Link, useLocation } from 'react-router-dom'
import { Seal } from '@/components/ui/Seal'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { path: '/', label: '今日卦境' },
  { path: '/codex', label: '64 卦图鉴' },
  { path: '/divination', label: '三数起卦' },
  { path: '/feed', label: '社区卦册' },
  { path: '/records', label: '我的卦册' },
] as const

export interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const location = useLocation()

  return (
    <header className={cn('bg-rice border-b-2 border-june-bronze', className)}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo: 朱砂方印 + 中英双语副标 */}
        <Link
          to="/"
          className="flex items-center gap-3 shrink-0 group"
          aria-label="易象阁 首页"
        >
          <Seal text="易象" size={38} />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg sm:text-xl text-june-red tracking-[0.3em] group-hover:tracking-[0.4em] transition-all">
              易象阁
            </span>
            <span className="text-[10px] sm:text-[11px] text-ink-light tracking-[0.2em] font-body mt-0.5">
              YI · XIANG · GE
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'px-3 py-2 rounded-sm font-display text-sm transition-colors',
                  isActive
                    ? 'bg-june-red text-rice'
                    : 'text-ink hover:bg-rice-dark'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Desktop settings icon (mobile uses the bottom nav bar) */}
        <Link
          to="/settings"
          className="hidden md:flex text-ink-light hover:text-june-red transition-colors"
          aria-label="设置"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>

        {/* Mobile: only show settings gear (logo + nav at bottom) */}
        <Link
          to="/settings"
          className="md:hidden text-ink-light hover:text-june-red transition-colors"
          aria-label="设置"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* Mobile bottom nav (4 items, always visible) */}
      <nav className="md:hidden flex items-center justify-around border-t border-june-bronze/30 py-2 bg-rice-dark/40">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'px-2 py-1 font-display text-xs transition-colors',
                isActive ? 'text-june-red font-semibold' : 'text-ink-light'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
