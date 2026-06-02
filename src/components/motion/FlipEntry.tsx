import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

export interface FlipEntryProps {
  children: ReactNode
  /** Delay in seconds before animation starts */
  delay?: number
  /** Duration in seconds */
  duration?: number
  className?: string
}

/**
 * Wraps children with a 180° flip + elastic ease + scale + blur-focus entry animation.
 * Plays once on mount.
 */
export function FlipEntry({
  children,
  delay = 0,
  duration = 1.2,
  className,
}: FlipEntryProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, rotateY: 180, scale: 0.5, filter: 'blur(8px)' }}
      animate={{ opacity: 1, rotateY: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{
        delay,
        duration,
        type: 'spring',
        stiffness: 100,
        damping: 12,
      }}
      style={{ perspective: 1000 }}
    >
      {children}
    </motion.div>
  )
}
