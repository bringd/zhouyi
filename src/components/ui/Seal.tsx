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
  /** Force compact text size (32px) regardless of seal size. Use for small seals that overlap content. */
  compact?: boolean
  /** Optional click handler */
  onClick?: () => void
  className?: string
}

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
  // Compact 模式强制 32px 字号；否则按 size 缩放（44px @ 56, 56px @ 80）
  const fontSize = compact
    ? 32
    : Math.max(Math.round(size * 0.78), 32)

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
      {/* Outer square (seal body) — 减负版：去除外黑边 */}
      <rect x="2" y="2" width="96" height="96" fill={bgColor} />
      {/* Inner thin border — "印泥厚薄" depth illusion */}
      <rect
        x="9"
        y="9"
        width="82"
        height="82"
        fill="none"
        stroke={textColor}
        strokeWidth="1"
        opacity="0.5"
      />
      {/* Character(s) */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
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
