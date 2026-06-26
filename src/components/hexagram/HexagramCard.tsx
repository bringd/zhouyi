import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Seal } from '@/components/ui/Seal'
import { YaoLineStack } from './YaoLineStack'
import { cn } from '@/utils/cn'
import type { Hexagram, HexagramId } from '@/types'
import { getHexagramById } from '@/lib/divination'

export type HexagramCardSize = 'sm' | 'md' | 'lg'

export interface HexagramCardProps {
  /** The hexagram to display (full object) OR a hexagram id */
  hexagram?: Hexagram
  hexagramId?: HexagramId
  /** Override the default size */
  size?: HexagramCardSize
  /** Show the keyword tags */
  showKeywords?: boolean
  /** Show the stamp decoration */
  showStamp?: boolean
  /** Make the card clickable to navigate to the detail page */
  navigateOnClick?: boolean
  /** Custom onClick handler (overrides navigation) */
  onClick?: () => void
  className?: string
}

const SIZE_CONFIG: Record<HexagramCardSize, { cardWidth: string; lineWidth: number; nameSize: string; kwSize: string; showStamp: boolean }> = {
  sm: { cardWidth: 'w-20', lineWidth: 60, nameSize: 'text-xs', kwSize: 'text-[8px]', showStamp: false },
  md: { cardWidth: 'w-36', lineWidth: 110, nameSize: 'text-base', kwSize: 'text-[11px]', showStamp: true },
  lg: { cardWidth: 'w-60', lineWidth: 200, nameSize: 'text-2xl', kwSize: 'text-sm', showStamp: true },
}

/**
 * Convert hexagram binary code to line type array.
 * The binary code is bottom-to-top, e.g. "111111" = 6 yang.
 */
function getLinesFromBinary(binaryCode: string): ['yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin'] {
  // index 0 = bottom, index 5 = top
  return binaryCode.split('').map((c) => (c === '1' ? 'yang' : 'yin')) as ['yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin', 'yang' | 'yin']
}

export function HexagramCard({
  hexagram: providedHex,
  hexagramId,
  size = 'md',
  showKeywords = true,
  showStamp,
  navigateOnClick = true,
  onClick,
  className,
}: HexagramCardProps) {
  const navigate = useNavigate()
  const hex = providedHex ?? (hexagramId !== undefined ? getHexagramById(hexagramId) : null)
  if (!hex) return null
  const config = SIZE_CONFIG[size]
  const lines = getLinesFromBinary(hex.binaryCode)
  const showStampEffective = showStamp ?? config.showStamp
  const isInteractive = Boolean(onClick || navigateOnClick)

  const handleClick = () => {
    if (onClick) onClick()
    else if (navigateOnClick) navigate(`/hexagram/${hex.id}`)
  }

  return (
    <motion.div
      className={cn('relative inline-block', config.cardWidth, className)}
      whileHover={{ y: -2, rotate: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={handleClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && isInteractive) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Card padding="sm" interactive={isInteractive}>
        {/* pt-10 reserves vertical space for the absolutely-positioned
            seal in the top-right corner; the seal sits in the padding
            gutter, not on top of the content. */}
        <div className="flex flex-col items-center gap-2 relative pt-10">
          {showStampEffective && (
            // Use absolute positioning inside the card body so the
            // rotated seal corner stays within the bronze border.
            // top-2.5 / right-2.5 (10px) gives the rotated corner
            // enough room that it never pokes through the 2px
            // bronze border. The Seal component also clamps its
            // text so 3-char names like 天地否 stay inside the
            // 32×32 SVG viewport.
            <div className="absolute top-2.5 right-2.5">
              <Seal text={hex.shortName} size={32} rotation={-3} />
            </div>
          )}
          <YaoLineStack lines={lines} width={config.lineWidth} />
          <div className={cn('font-display font-bold text-ink text-center', config.nameSize)}>
            {hex.name}
          </div>
          {showKeywords && hex.keywords.length > 0 && (
            <div className={cn('text-june-bronze text-center', config.kwSize, 'opacity-80')}>
              {hex.keywords.slice(0, 3).join(' · ')}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
