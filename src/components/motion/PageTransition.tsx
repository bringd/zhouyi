import { motion, useReducedMotion } from 'framer-motion'
import { type ReactNode } from 'react'

export interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * Wraps page content with a fade-in transition.
 * Use at the top of each page component.
 *
 * 当系统开启「减少动态效果」(prefers-reduced-motion: reduce) 时不做位移，
 * 只保留一瞬间的淡入 —— CSS 的 media query 覆盖不到 Framer Motion 的 JS 动画，
 * 必须在这里显式处理。
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <div className={className}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
