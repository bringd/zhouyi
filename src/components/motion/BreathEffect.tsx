import { motion, type HTMLMotionProps } from 'framer-motion'
import { type ReactNode } from 'react'

export interface BreathEffectProps extends Omit<HTMLMotionProps<'div'>, 'animate'> {
  children: ReactNode
  /** Glow color (any CSS color) */
  color?: string
  /** Animation duration in ms */
  duration?: number
}

/**
 * Wraps children with a 4.5s "breath" animation — a subtle box-shadow pulse.
 * Used for static hexagram cards to give them a feeling of life.
 */
export function BreathEffect({
  children,
  color = 'rgba(212, 175, 55, 0.5)',
  duration = 4500,
  ...rest
}: BreathEffectProps) {
  return (
    <motion.div
      animate={{
        boxShadow: [
          '0 4px 20px rgba(74, 55, 28, 0.2)',
          `0 6px 32px ${color}`,
          '0 4px 20px rgba(74, 55, 28, 0.2)',
        ],
      }}
      transition={{
        duration: duration / 1000,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
