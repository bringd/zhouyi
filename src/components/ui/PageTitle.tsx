import { type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface PageTitleProps {
  /** Main title (Chinese text) */
  title: string
  /** Optional subtitle (Chinese text) */
  subtitle?: string
  /** Optional "kicker" text shown above title (e.g. "第 1 卦") */
  kicker?: string
  /** Optional small element on the right of the title (e.g. keywords as pills) */
  trailing?: ReactNode
  /** Size variant: 'md' (default) for sub-pages, 'lg' for hero hexagram detail */
  size?: 'md' | 'lg'
  /** Additional className for the wrapper */
  className?: string
  /** Optional id for the heading element (accessibility) */
  id?: string
}

/**
 * 卷轴匾额 (Scroll Plaque) — page title with traditional Chinese framed
 * styling: bronze border + gold inner border + 双钩 side marks. Adds
 * "工笔重彩" visual weight to H1 areas that previously felt thin.
 */
export function PageTitle({
  title,
  subtitle,
  kicker,
  trailing,
  size = 'md',
  className,
  id,
}: PageTitleProps) {
  const titleTextSize = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'
  const kickerTextSize = size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <header className={cn('text-center my-8 sm:my-10', className)}>
      {kicker && (
        <div
          className={cn(
            'font-display tracking-[0.3em] text-june-bronze mb-3',
            kickerTextSize
          )}
        >
          {kicker}
        </div>
      )}

      <div className="relative inline-block">
        <PlaqueFrame size={size} title={title} />
        <h1
          id={id}
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'font-display text-ink whitespace-nowrap',
            'tracking-[0.25em] sm:tracking-[0.35em]',
            'px-4 sm:px-6',
            titleTextSize
          )}
        >
          {title}
        </h1>
      </div>

      {trailing && <div className="mt-4">{trailing}</div>}

      {subtitle && (
        <div className="mt-4 flex items-center justify-center gap-3 text-xs sm:text-sm text-ink-light font-display tracking-widest">
          <span aria-hidden className="w-8 h-px bg-june-bronze" />
          <span>{subtitle}</span>
          <span aria-hidden className="w-8 h-px bg-june-bronze" />
        </div>
      )}
    </header>
  )
}

/** The visual plaque frame (SVG) behind the H1 text.
 *  Width auto-scales to the title length so 6-character titles like
 *  "六十四卦图鉴" don't wrap. */
function PlaqueFrame({ size, title }: { size: 'md' | 'lg'; title: string }) {
  const charCount = [...title].length
  const baseW = size === 'lg' ? 380 : 320
  const h = size === 'lg' ? 72 : 60
  // Each Chinese char needs ~34px (md) / 44px (lg) of width including letter-spacing.
  // Cap growth at 4-char to avoid huge frames for short titles.
  const extraChars = Math.max(charCount - 3, 0)
  const w = baseW + extraChars * (size === 'lg' ? 56 : 40)
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="block mx-auto"
      aria-hidden
    >
      {/* Outer bronze border */}
      <rect
        x="2"
        y="2"
        width={w - 4}
        height={h - 4}
        fill="#FAF6EC"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Inner gold thin border */}
      <rect
        x="8"
        y="8"
        width={w - 16}
        height={h - 16}
        fill="none"
        stroke="#C89E3A"
        strokeWidth="0.5"
        opacity="0.8"
      />
      {/* Double-hook side marks (双钩描边) */}
      <line
        x1="0"
        y1={h / 2}
        x2="2"
        y2={h / 2}
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1={w - 2}
        y1={h / 2}
        x2={w}
        y2={h / 2}
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
