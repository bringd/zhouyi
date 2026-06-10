import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional header content */
  header?: ReactNode
  /** Optional footer content */
  footer?: ReactNode
  /** Padding size */
  padding?: 'sm' | 'md' | 'lg' | 'none'
  /** Whether to show a hover effect (lift on hover) */
  interactive?: boolean
}

const PADDING_CLASSES = {
  none: '',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8',
} as const

const BASE_CLASSES = 'bg-rice border-2 border-june-bronze rounded-md shadow-sm'

/**
 * Card component with rice paper background and bronze border.
 * Used for hexagram cards, content blocks, and panels.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { header, footer, padding = 'md', interactive = false, className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        BASE_CLASSES,
        PADDING_CLASSES[padding],
        interactive && 'transition-transform hover:-translate-y-1 hover:shadow-md cursor-pointer',
        className
      )}
      {...rest}
    >
      {header && <div className="mb-4 pb-3 border-b border-june-bronze/30">{header}</div>}
      {children}
      {footer && <div className="mt-4 pt-3 border-t border-june-bronze/30">{footer}</div>}
    </div>
  )
})
