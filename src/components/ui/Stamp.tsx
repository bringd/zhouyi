import { type HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface StampProps extends HTMLAttributes<HTMLDivElement> {
  /** Text inside the stamp (1-4 Chinese characters typically) */
  text: string
  /** Size of the stamp */
  size?: 'sm' | 'md' | 'lg'
  /** Rotation in degrees (default 0) */
  rotation?: number
  /** Optional shape variant */
  shape?: 'square' | 'rectangle'
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-base',
  lg: 'w-20 h-20 text-2xl',
} as const

/**
 * Traditional Chinese seal/stamp component.
 * Vermillion (朱砂) background with white characters.
 * Used for decorative visual accents throughout the app.
 */
export function Stamp({
  text,
  size = 'md',
  rotation = 0,
  shape = 'square',
  className,
  style,
  ...rest
}: StampProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-display font-bold text-rice bg-june-red select-none shrink-0',
        SIZE_CLASSES[size],
        shape === 'square' ? 'rounded-sm' : 'rounded-sm',
        className
      )}
      style={{
        transform: `rotate(${rotation}deg)`,
        fontFamily: 'KaiTi, STKaiti, serif',
        lineHeight: 1,
        textAlign: 'center',
        ...style,
      }}
      aria-label={`stamp: ${text}`}
      role="img"
      {...rest}
    >
      <span style={{ writingMode: shape === 'rectangle' ? 'vertical-rl' : 'horizontal-tb' }}>
        {text}
      </span>
    </div>
  )
}
