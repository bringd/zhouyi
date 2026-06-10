import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { Button } from '@/components/ui/Button'
import { Seal } from '@/components/ui/Seal'
import { FlipEntry } from '@/components/motion/FlipEntry'
import { BreathEffect } from '@/components/motion/BreathEffect'
import { getTodayHexagram } from '@/lib/daily'
import { cn } from '@/utils/cn'
import type { Hexagram } from '@/types'
import { getHexagramById } from '@/lib/divination'

export interface DailyHeroProps {
  /** Override the auto-generated daily hexagram (for testing) */
  mainHexagram?: Hexagram
  changedHexagram?: Hexagram
  movingLine?: 1 | 2 | 3 | 4 | 5 | 6
  region?: string
  date?: string
  className?: string
}

/**
 * Magazine-style asymmetric hero section (decision I).
 * Left: large red color block with hexagram glyph + stamp
 * Right: title + keywords + interpretation preview + action buttons
 */
export function DailyHero({
  mainHexagram: providedMain,
  changedHexagram: providedChanged,
  movingLine: providedMoving,
  region,
  date,
  className,
}: DailyHeroProps) {
  // Use provided values or auto-generate today's
  const daily =
    providedMain && providedChanged ? null : getTodayHexagram()
  const main = providedMain ?? (daily ? getHexagramById(daily.mainHexagramId) : null)
  const changed =
    providedChanged ?? (daily ? getHexagramById(daily.changedHexagramId) : null)
  const moving = providedMoving ?? daily?.movingLine

  if (!main || !changed) return null

  const today = date ?? new Date().toLocaleDateString('zh-CN')
  const regionLabel =
    region ??
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : '')

  return (
    <section className={cn('w-full', className)}>
      {/* Date / region strip */}
      <div className="text-center mb-6">
        <div className="text-sm text-june-bronze font-display tracking-widest">今 日 卦 境</div>
        <div className="text-xs text-ink-light font-body mt-1">
          {regionLabel && `${regionLabel} · `}
          {today}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center max-w-5xl mx-auto">
        {/* Left: large red color block with hexagram glyph */}
        <FlipEntry className="w-full">
          <BreathEffect className="w-full rounded-md" duration={4500}>
            <div className="aspect-square w-full bg-gradient-to-br from-june-red via-june-clay to-june-red relative flex items-center justify-center p-8 rounded-md shadow-2xl">
              <div className="absolute top-4 left-4 text-rice/60 font-display text-sm tracking-widest">
                第 {main.number} 卦
              </div>
              <div className="absolute top-4 right-4">
                <Seal text={main.shortName} size={44} rotation={-3} />
              </div>
              {/* Big hexagram glyph */}
              <div className="w-full max-w-xs">
                <HexagramCard
                  hexagram={main}
                  size="lg"
                  navigateOnClick={false}
                  showStamp={false}
                />
              </div>
            </div>
          </BreathEffect>
        </FlipEntry>

        {/* Right: title + interpretation + buttons */}
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h1 className="text-display-md font-display text-ink leading-tight">{main.name}</h1>
          <div className="flex flex-wrap gap-2">
            {main.keywords.slice(0, 4).map((kw) => (
              <span
                key={kw}
                className="px-3 py-1 bg-june-red/10 text-june-red rounded-pill text-xs font-display"
              >
                {kw}
              </span>
            ))}
          </div>
          {main.modernInterpretation && (
            <p className="font-body text-ink-light text-base leading-relaxed line-clamp-4">
              {main.modernInterpretation}
            </p>
          )}
          <div className="text-sm text-ink-light font-body">
            <span>
              {`动爻 · 第 ${moving} 爻 → `}
            </span>
            <Link
              to={`/hexagram/${changed.id}`}
              className="text-june-red font-bold hover:underline"
            >
              {`变卦 · ${changed.name}`}
            </Link>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link to={`/hexagram/${main.id}`}>
              <Button variant="primary">展开卦境</Button>
            </Link>
            <Link to="/codex">
              <Button variant="secondary">查看 64 卦</Button>
            </Link>
            <Link to="/divination">
              <Button variant="ghost">三数起卦</Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
