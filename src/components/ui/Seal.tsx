import { cn } from '@/utils/cn'

export interface SealProps {
  /** The character(s) to display inside the seal. 1-4 Chinese characters. */
  text: string
  /** Size in pixels (width = height = size). Default 38. */
  size?: number
  /** Rotation angle in degrees. Default 0. */
  rotation?: number
  /** Foreground color (text). Default rice (米色). */
  textColor?: string
  /** Background color. Default june-red (朱砂). */
  bgColor?: string
  /**
   * When true, forces the inner character font-size to 32px regardless of
   * `size`. Used in 38px sm cards so the glyph doesn't crowd the border.
   * Default false.
   */
  compact?: boolean
  /** Optional click handler */
  onClick?: () => void
  className?: string
}

/**
 * 朱砂方印 (Vermillion Square Seal) — a Chinese-style seal stamp.
 * Used as the site logo and as decorative seals on page titles/cards.
 *
 * The 1.5px black border + rice-colored character(s) mimics a 印章
 * 印泥 (seal paste) impression on rice paper.
 */
export function Seal({
  text,
  size = 38,
  rotation = 0,
  textColor = '#FAF6EC',
  bgColor = '#9b2c2c',
  compact = false,
  onClick,
  className,
}: SealProps) {
  // Compute font size. `compact` forces 32px (used in 38px sm cards so the
  // glyph doesn't crowd the border); otherwise scale with size, floored at 32.
  const fontSize = compact ? 32 : Math.max(Math.round(size * 0.78), 32)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      aria-label={text}
      style={{ transform: `rotate(${rotation}deg)`, flexShrink: 0 }}
      className={cn(onClick && 'cursor-pointer', className)}
    >
      {/* Outer square (seal body) */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        fill={bgColor}
        stroke="#1A1A1A"
        strokeWidth="3"
      />
      {/* Inner thin border — "印泥厚薄" depth illusion */}
      <rect
        x="9"
        y="9"
        width="82"
        height="82"
        fill="none"
        stroke={textColor}
        strokeWidth="0.8"
        opacity="0.6"
      />
      {/* Character(s) — laid out vertically for traditional seal look */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize * 2.2}
        fill={textColor}
        fontFamily="'Noto Serif SC', 'Songti SC', serif"
        fontWeight="500"
        style={{ letterSpacing: '0.05em' }}
      >
        {text}
      </text>
    </svg>
  )
}
