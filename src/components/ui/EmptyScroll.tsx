import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

export interface EmptyScrollProps {
  /** 主标题 (3-4 字, 如 "卷轴未展") */
  title?: string
  /** 主描述文字 */
  message: string
  /** 副描述/补充说明 (可选) */
  hint?: string
  /** CTA 链接 (可选) */
  cta?: {
    to: string
    label: string
  }
  /** 自定义类名 */
  className?: string
  /** 移动端精简版 (去掉两侧卷轴轴) */
  compact?: boolean
}

/**
 * 卷轴式空状态组件 (per P0 UI optimization)
 * 把"未实现"变成"待展开"的故事感,呼应中国古籍视觉。
 */
export function EmptyScroll({
  title = '卷轴未展',
  message,
  hint,
  cta,
  className,
  compact = false,
}: EmptyScrollProps) {
  return (
    <div
      className={cn(
        'relative bg-rice-dark border border-june-bronze/40 rounded-sm',
        'px-6 py-10 sm:px-12 sm:py-12',
        'text-center max-w-2xl mx-auto',
        className
      )}
    >
      {!compact && (
        <>
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-3/5 bg-gradient-to-b from-june-bronze to-june-clay rounded-r-sm"
          />
          <span
            aria-hidden
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-3/5 bg-gradient-to-b from-june-bronze to-june-clay rounded-l-sm"
          />
        </>
      )}

      <ScrollGlyph />

      <h3 className="mt-6 font-display text-xl sm:text-2xl text-ink tracking-[0.3em]">{title}</h3>

      <div className="mt-4 font-body text-ink-light leading-relaxed">
        <p>{message}</p>
        {hint && <p className="mt-1 text-sm text-ink-light/70">{hint}</p>}
      </div>

      {cta && (
        <Link
          to={cta.to}
          className={cn(
            'inline-block mt-8 px-7 py-2.5',
            'bg-gradient-to-b from-[#b33434] to-[#8a2424] text-[#f5e8c8]',
            'border border-june-gold rounded-sm',
            'font-display text-sm tracking-[0.3em]',
            'shadow-[inset_0_1px_0_rgba(255,220,180,0.35),0_2px_8px_rgba(155,44,44,0.3)]',
            'hover:from-[#c03939] hover:to-[#962828] transition-all duration-200'
          )}
        >
          {cta.label} →
        </Link>
      )}
    </div>
  )
}

/** 卷轴 SVG 图标 (内嵌) */
function ScrollGlyph() {
  return (
    <svg
      className="block mx-auto"
      width="220"
      height="80"
      viewBox="0 0 220 80"
      aria-hidden
    >
      {/* 卷面 */}
      <rect x="20" y="20" width="180" height="40" fill="#f5f0e1" stroke="#a06b3a" strokeWidth="1.5" />
      {/* 左卷轴头 */}
      <rect x="6" y="14" width="16" height="52" fill="#a06b3a" rx="1" />
      <rect x="10" y="18" width="2" height="44" fill="#c9a96e" opacity="0.5" />
      {/* 右卷轴头 */}
      <rect x="198" y="14" width="16" height="52" fill="#a06b3a" rx="1" />
      <rect x="208" y="18" width="2" height="44" fill="#c9a96e" opacity="0.5" />
      {/* 卷心虚线 (待书) */}
      <line
        x1="35"
        y1="40"
        x2="185"
        y2="40"
        stroke="#c9a96e"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity="0.7"
      />
      {/* 卷面四角的印章痕迹 */}
      <rect
        x="160"
        y="48"
        width="10"
        height="10"
        fill="none"
        stroke="#9b2c2c"
        strokeWidth="1"
        opacity="0.6"
      />
    </svg>
  )
}

/**
 * 简洁版空状态 (无装饰, 用于次要空态如 "暂无结果")
 */
export function EmptySimple({
  message,
  hint,
  className,
}: {
  message: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-center py-10 px-6 bg-rice-dark border border-june-bronze/30 rounded-sm',
        className
      )}
    >
      <p className="font-body text-ink-light">{message}</p>
      {hint && <p className="mt-2 text-xs text-ink-light/60 font-body">{hint}</p>}
    </div>
  )
}
