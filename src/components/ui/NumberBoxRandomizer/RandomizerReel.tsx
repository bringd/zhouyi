import { motion } from 'framer-motion'

interface Props {
  displayValue: number | null
  rolling: boolean
}

export function RandomizerReel({ displayValue, rolling }: Props) {
  if (!rolling || displayValue === null) return null
  return (
    <motion.div
      key={displayValue}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.05 }}
      className="pointer-events-none absolute inset-0 flex items-center justify-center
                 bg-rice-dark/85 rounded-sm font-display tracking-widest text-3xl text-ink tabular-nums"
    >
      {String(displayValue).padStart(3, '0')}
    </motion.div>
  )
}
