import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

export interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * Wraps page content with a fade-in transition.
 * Use at the top of each page component.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
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
