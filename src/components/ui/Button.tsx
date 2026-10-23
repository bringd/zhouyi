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
  // Primary: 印泥色渐变 + 描边 + 反色字。
  // 具体颜色由 `src/styles/appearance.css` 的 `.ui-button--primary` 决定，
  // 这样按钮会跟随当前外观（夜航观象下是淡金，而不是朱砂红）。
  primary: 'ui-button--primary',
  // Secondary: 宣纸底 + 赭石描边 + 浓墨字
  secondary: 'ui-button--secondary bg-rice text-ink border-2 border-june-bronze hover:bg-rice-dark',
  // Ghost: 透明 + 浓墨字 + 悬停出现米色底
  ghost: 'ui-button--ghost bg-transparent text-ink hover:bg-rice',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm tracking-wider',
  md: 'px-5 py-2.5 text-base tracking-wider',
  // lg: 仪式化大尺寸, 0.5em 字距, 加宽 padding
  lg: 'px-12 py-4 text-xl tracking-[0.5em] font-medium',
}

const BASE_CLASSES =
  'ui-button inline-flex items-center justify-center gap-2 rounded-sm font-display transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-june-gold focus-visible:ring-offset-2 focus-visible:ring-offset-rice'

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
