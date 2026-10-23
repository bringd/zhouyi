import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  displayValue: number | null
  rolling: boolean
}

const REEL_CLASS =
  'number-randomizer-reel pointer-events-none absolute inset-0 flex items-center justify-center ' +
  'bg-rice-dark/85 rounded-sm font-display tracking-widest text-3xl text-ink tabular-nums'

export function RandomizerReel({ displayValue, rolling }: Props) {
  const reduceMotion = useReducedMotion()

  if (!rolling || displayValue === null) return null
  const text = String(displayValue).padStart(3, '0')

  // 减少动态效果：不逐帧淡入、不随数字变化重新挂载，只让数字直接替换
  if (reduceMotion) {
    return (
      <div aria-hidden="true" className={REEL_CLASS}>
        {text}
      </div>
    )
  }

  return (
    <motion.div
      aria-hidden="true"
      key={displayValue}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.05 }}
      className={REEL_CLASS}
    >
      {text}
    </motion.div>
  )
}
