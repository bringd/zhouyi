import { cn } from '@/utils/cn'
import { HexagramGlyph, type LineType, type LineState } from './HexagramGlyph'

export interface YaoLineStackProps {
  /** Array of 6 line types, bottom-to-top */
  lines: [LineType, LineType, LineType, LineType, LineType, LineType]
  /** Optional: 1-6, the moving line position to highlight */
  highlightLine?: 1 | 2 | 3 | 4 | 5 | 6
  /** Array of 6 line states, bottom-to-top (default all 'normal') */
  states?: [LineState, LineState, LineState, LineState, LineState, LineState]
  /** Width of each line in pixels */
  width?: number
  /** Thickness of each line in pixels */
  thickness?: number
  /** Gap between lines in pixels */
  lineGap?: number
  className?: string
  /** Allow test runners to attach data-* attributes */
  'data-testid'?: string
}

const ALL_NORMAL: [LineState, LineState, LineState, LineState, LineState, LineState] = [
  'normal', 'normal', 'normal', 'normal', 'normal', 'normal',
]

/**
 * Vertical stack of 6 yao lines, representing a complete hexagram.
 * Lines are rendered bottom-to-top (position 1 at bottom, position 6 at top).
 */
export function YaoLineStack({
  lines,
  highlightLine,
  states = ALL_NORMAL,
  width = 80,
  thickness = 6,
  lineGap = 4,
  className,
  'data-testid': testId,
}: YaoLineStackProps) {
  // Build effective states: if highlightLine is provided, override that line's state to 'highlight'
  const effectiveStates: [LineState, LineState, LineState, LineState, LineState, LineState] = highlightLine
    ? (states.map((s, i) => (i + 1 === highlightLine ? 'highlight' : s)) as [LineState, LineState, LineState, LineState, LineState, LineState])
    : states

  return (
    <div
      className={cn('flex flex-col', className)}
      style={{ gap: `${lineGap}px`, width: `${width}px` }}
      role="img"
      aria-label="hexagram"
      data-testid={testId}
    >
      {/* Render top-to-bottom: position 6 first, position 1 last */}
      {[5, 4, 3, 2, 1, 0].map((i) => (
        <HexagramGlyph
          key={i}
          type={lines[i]}
          state={effectiveStates[i]}
          width={width}
          thickness={thickness}
        />
      ))}
    </div>
  )
}
