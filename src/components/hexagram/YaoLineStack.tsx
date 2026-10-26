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
  /**
   * Accessible name of the glyph, e.g. "地山谦卦象图".
   *
   * 不传时按装饰性图形处理（aria-hidden）：读屏用户会跳过它。
   * 只有当卦图本身是「独立表达信息」的元素时（例如今日卦境的主卦图，
   * 旁边没有等价文字）才传中文名称，否则请传空。
   */
  label?: string
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
  label,
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
      // 有中文名称时作为图片呈现；没有名称时按装饰性图形隐藏，避免读屏重复朗读
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={testId}
    >
      {/* Render top-to-bottom: position 6 first, position 1 last */}
      {[5, 4, 3, 2, 1, 0].map((i) => (
        <HexagramGlyph
          key={i}
          type={lines[i]}
          state={effectiveStates[i]}
          data-yao-position={i + 1}
          width={width}
          thickness={thickness}
        />
      ))}
    </div>
  )
}
