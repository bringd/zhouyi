import { cn } from '@/utils/cn'

export type LineType = 'yin' | 'yang'
export type LineState = 'normal' | 'highlight' | 'changed'

export interface HexagramGlyphProps {
  type: LineType
  state?: LineState
  /** Width of the line in pixels (or CSS unit) */
  width?: number
  /** Thickness of the line in pixels */
  thickness?: number
  /** Gap between the two halves of a yin line */
  gap?: number
  className?: string
  /** Allow test runners to attach data-* attributes */
  'data-testid'?: string
}

const STATE_COLORS: Record<LineState, string> = {
  normal: 'bg-ink',
  highlight: 'bg-june-red',
  changed: 'bg-june-gold',
}

/**
 * Single yao line glyph.
 * yin = broken line (two segments with a gap)
 * yang = solid line (one continuous)
 */
export function HexagramGlyph({
  type,
  state = 'normal',
  width = 80,
  thickness = 6,
  gap = 6,
  className,
  'data-testid': testId,
}: HexagramGlyphProps) {
  const colorClass = STATE_COLORS[state]
  if (type === 'yang') {
    return (
      <div
        className={cn(colorClass, className)}
        style={{ width: `${width}px`, height: `${thickness}px` }}
        role="img"
        aria-label={`yang line, ${state}`}
        data-testid={testId}
      />
    )
  }
  // yin: two segments
  const segmentWidth = (width - gap) / 2
  return (
    <div
      className={cn('flex', className)}
      style={{ width: `${width}px`, height: `${thickness}px`, gap: `${gap}px` }}
      role="img"
      aria-label={`yin line, ${state}`}
      data-testid={testId}
    >
      <div className={colorClass} style={{ width: `${segmentWidth}px`, height: `${thickness}px` }} />
      <div className={colorClass} style={{ width: `${segmentWidth}px`, height: `${thickness}px` }} />
    </div>
  )
}
