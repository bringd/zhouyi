import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Show a loading spinner and disable interaction */
  loading?: boolean
  /** Optional icon to render before the text */
  leftIcon?: ReactNode
  /** Optional icon to render after the text */
  rightIcon?: ReactNode
  children?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Primary: 朱砂红填充 + 米色字 + 赭石描边
  primary: 'bg-june-red text-rice border-2 border-june-bronze hover:bg-june-clay',
  // Secondary: 宣纸底 + 赭石描边 + 浓墨字
  secondary: 'bg-rice text-ink border-2 border-june-bronze hover:bg-rice-dark',
  // Ghost: 透明 + 浓墨字 + 悬停出现米色底
  ghost: 'bg-transparent text-ink hover:bg-rice',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-md font-display transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-june-bronze focus-visible:ring-offset-2 focus-visible:ring-offset-rice'

/**
 * Button component with 工笔 visual style.
 * Uses Framer Motion for subtle hover/tap micro-interactions.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      disabled={disabled || loading}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...(rest as HTMLMotionProps<'button'>)}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </motion.button>
  )
})
