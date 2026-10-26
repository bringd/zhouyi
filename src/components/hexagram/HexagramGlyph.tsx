import { cn } from '@/utils/cn'
import type { LineState, LineType } from '@/types'
import '@/styles/hexagram.css'

// 基础类型统一放在 src/types，组件层继续从这里 re-export 保持向后兼容
export type { LineState, LineType }

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
  /** Override the moving-line tooltip for a reading-position indicator. */
  title?: string
  /** Allow test runners to attach data-* attributes */
  'data-testid'?: string
  'data-yao-position'?: number
}

const STATE_COLORS: Record<LineState, string> = {
  normal: 'bg-ink',
  highlight: 'bg-june-red',
  changed: 'bg-june-gold',
}

const STATE_TOKENS: Record<LineState, string> = {
  normal: '--color-yao-normal',
  highlight: '--color-yao-marked',
  changed: '--color-yao-marked',
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
  title,
  'data-testid': testId,
  'data-yao-position': position,
}: HexagramGlyphProps) {
  const colorClass = STATE_COLORS[state]
  const lineClass = cn(
    'yao-line',
    state !== 'normal' && 'yao-line--marked',
    className,
  )
  const paint = { backgroundColor: `var(${STATE_TOKENS[state]})` }
  const markerTitle =
    title ??
    (state === 'highlight'
      ? '动爻'
      : state === 'changed'
        ? '已变爻'
        : undefined)
  if (type === 'yang') {
    return (
      <div
        className={cn(colorClass, lineClass)}
        style={{ width: `${width}px`, height: `${thickness}px`, ...paint }}
        data-line-state={state}
        data-yao-position={position}
        title={markerTitle}
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
      className={cn('flex', lineClass)}
      style={{ width: `${width}px`, height: `${thickness}px`, gap: `${gap}px` }}
      data-line-state={state}
      data-yao-position={position}
      title={markerTitle}
      role="img"
      aria-label={`yin line, ${state}`}
      data-testid={testId}
    >
      <div
        className={colorClass}
        style={{
          width: `${segmentWidth}px`,
          height: `${thickness}px`,
          ...paint,
        }}
      />
      <div
        className={colorClass}
        style={{
          width: `${segmentWidth}px`,
          height: `${thickness}px`,
          ...paint,
        }}
      />
    </div>
  )
}
