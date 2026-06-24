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
  // Primary: 印泥+朱砂渐变 + 金线边 + 米色字 (per P0 UI optimization)
  // disabled: 古铜低饱和而非 opacity, 避免"灰粉像 disabled"的视觉错位
  primary:
    'bg-gradient-to-b from-[#b33434] to-[#8a2424] text-[#f5e8c8] border border-june-gold ' +
    'hover:from-[#c03939] hover:to-[#962828] ' +
    'shadow-[inset_0_1px_0_rgba(255,220,180,0.35),0_2px_8px_rgba(155,44,44,0.3)] ' +
    'hover:shadow-[inset_0_1px_0_rgba(255,220,180,0.4),0_4px_12px_rgba(155,44,44,0.4)] ' +
    'disabled:from-[#b8a890] disabled:to-[#9d8d75] disabled:border-[#b8a890] ' +
    'disabled:text-[#f0e8d8] disabled:shadow-none disabled:cursor-not-allowed',
  // Secondary: 宣纸底 + 赭石描边 + 浓墨字
  secondary: 'bg-rice text-ink border-2 border-june-bronze hover:bg-rice-dark',
  // Ghost: 透明 + 浓墨字 + 悬停出现米色底
  ghost: 'bg-transparent text-ink hover:bg-rice',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm tracking-wider',
  md: 'px-5 py-2.5 text-base tracking-wider',
  // lg: 仪式化大尺寸, 0.5em 字距, 加宽 padding
  lg: 'px-12 py-4 text-xl tracking-[0.5em] font-medium',
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-sm font-display transition-all duration-200 ' +
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
