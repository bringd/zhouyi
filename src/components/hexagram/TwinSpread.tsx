import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { YaoLineStack } from './YaoLineStack'
import { Stamp } from '@/components/ui/Stamp'
import type { Hexagram } from '@/types'

export interface TwinSpreadProps {
  leftHex: Hexagram
  rightHex: Hexagram
  /** Optional label for the left page (e.g., "本卦") */
  leftLabel?: string
  /** Optional label for the right page (e.g., "变卦") */
  rightLabel?: string
  /** Optional: 1-6, moving line to highlight on the LEFT hexagram */
  movingLine?: 1 | 2 | 3 | 4 | 5 | 6
  /** Title for the spread (e.g., "卦象已成") */
  title?: string
  className?: string
}

function getLinesFromBinary(binaryCode: string): ['yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin'] {
  return binaryCode.split('').map((c) => (c === '1' ? 'yang' : 'yin')) as ['yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin']
}

/**
 * Twin hexagram spread — 工笔-style dual-page display.
 * Shows two hexagrams with optional labels, an arrow between them,
 * and a moving-line highlight on the left page.
 */
export function TwinSpread({
  leftHex,
  rightHex,
  leftLabel,
  rightLabel,
  movingLine,
  title,
  className,
}: TwinSpreadProps) {
  const leftLines = getLinesFromBinary(leftHex.binaryCode)
  const rightLines = getLinesFromBinary(rightHex.binaryCode)

  return (
    <div className={cn('w-full', className)}>
      {title && (
        <h2 className="font-display text-2xl text-center text-ink mb-6 tracking-widest">{title}</h2>
      )}
      <div className="flex items-stretch justify-center gap-4 md:gap-8">
        {/* Left page */}
        <motion.div
          className="flex-1 max-w-xs bg-rice border-2 border-june-bronze p-5 relative"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          {leftLabel && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-june-bronze text-rice text-xs font-display px-3 py-1 rounded-sm">
              {leftLabel}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 pt-3">
            <Stamp text={leftHex.shortName} size="sm" rotation={-3} />
            <h3 className="font-display text-xl text-ink font-bold">{leftHex.name}</h3>
            <YaoLineStack lines={leftLines} width={140} thickness={6} highlightLine={movingLine} />
            <p
              className="font-body text-sm text-ink-light text-center mt-2 leading-relaxed"
              style={{ fontFamily: 'KaiTi, STKaiti, serif' }}
            >
              {leftHex.judgement}
            </p>
          </div>
        </motion.div>

        {/* Arrow between */}
        <div className="flex flex-col items-center justify-center gap-2 px-2">
          <div className="w-px h-12 bg-june-bronze" />
          <div className="text-june-bronze text-2xl">⟶</div>
          <div className="w-px h-12 bg-june-bronze" />
        </div>

        {/* Right page */}
        <motion.div
          className="flex-1 max-w-xs bg-rice border-2 border-june-bronze p-5 relative"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {rightLabel && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-june-red text-rice text-xs font-display px-3 py-1 rounded-sm">
              {rightLabel}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 pt-3">
            <Stamp text={rightHex.shortName} size="sm" rotation={3} />
            <h3 className="font-display text-xl text-ink font-bold">{rightHex.name}</h3>
            <YaoLineStack lines={rightLines} width={140} thickness={6} />
            <p
              className="font-body text-sm text-ink-light text-center mt-2 leading-relaxed"
              style={{ fontFamily: 'KaiTi, STKaiti, serif' }}
            >
              {rightHex.judgement}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
