import { motion, useReducedMotion } from 'framer-motion'
import type { FormEvent, ReactNode } from 'react'

export interface CastFormShellProps {
  onSubmit: (event: FormEvent) => void
  className?: string
  /** 无障碍名称 */
  label?: string
  children: ReactNode
}

/**
 * 三套外观共用的表单外壳。
 *
 * 表单元素本身在三种外观里是同一个（提交行为由上层统一处理），
 * 不同的只是内部排布，所以把入场动画集中在这里，避免三处重复。
 * 开启「减少动态效果」时不做位移/淡入。
 */
export function CastFormShell({
  onSubmit,
  className,
  label = '三数起卦',
  children,
}: CastFormShellProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.form
      onSubmit={onSubmit}
      className={className}
      aria-label={label}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.form>
  )
}
