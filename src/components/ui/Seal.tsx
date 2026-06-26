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
   * Reserved for future use; the inner character font is now sized
   * automatically based on `text.length` so it always fits inside
   * the seal. Kept on the API so older call-sites still type-check.
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
  compact: _compact = false,
  onClick,
  className,
}: SealProps) {
  // ---- Font size: scale to text length ---------------------------------
  // The old formula (fontSize * 2.2 in viewBox units) used a single
  // ~70-unit font that fit one character but overflowed for 2-4
  // characters — the right side of the text got clipped by the SVG
  // viewport and the seal looked broken on multi-char hexagram names
  // like 天地否. Scale the font down with character count so the
  // whole string fits inside the 100-unit viewBox with ~10% padding.
  //
  //   1 char: 80 (fills the seal)
  //   2 chars: 45 (each ~45, total 90)
  //   3 chars: 30 (each ~30, total 90)
  //   4 chars: 22 (each ~22, total 88)
  const charCount = Math.max(1, text.length)
  const viewBoxFontSize = Math.min(80, 90 / charCount)

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
      {/* Character(s) — sized in viewBox units so multi-char text
          (e.g. 天地否) fits inside the seal without horizontal
          overflow. See charCount formula above. */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={viewBoxFontSize}
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
