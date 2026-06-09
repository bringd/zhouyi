import { cn } from '@/utils/cn'
import type { YaoLine } from '@/types'

export interface MiniYaoStackProps {
  /** The 6 yao lines for this hexagram (position 1-6, bottom-to-top). */
  yaoLines: YaoLine[]
  /** 1-6, which row to highlight as the current one. */
  currentLine: number
  className?: string
}

function MiniYao({ type, isCurrent }: { type: 'yin' | 'yang'; isCurrent: boolean }) {
  const color = isCurrent ? '#9b2c2c' : 'rgba(26,26,26,0.18)'
  const w = 32
  if (type === 'yang') {
    return <div style={{ width: w, height: 6, background: color, borderRadius: 1 }} />
  }
  return (
    <div style={{ display: 'flex', gap: 4, width: w }}>
      <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
      <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
    </div>
  )
}

/**
 * 6 爻 mini 堆栈 — 用于 YaoLineScroll / 详情页右侧"当前显示的是哪一爻"的视觉指示。
 * 视觉：6 爻垂直堆叠（6 上 1 下），当前爻红环红底高亮，其他爻灰显 60% 透明。
 */
export function MiniYaoStack({ yaoLines, currentLine, className }: MiniYaoStackProps) {
  return (
    <div
      className={cn(
        'flex flex-col bg-rice/60 border border-june-bronze/30 rounded-md p-2',
        className
      )}
      style={{ gap: 7 }}
      aria-label={`位置指示器，当前在第 ${currentLine} 爻`}
      data-testid="mini-yao-stack"
    >
      {[6, 5, 4, 3, 2, 1].map((pos) => {
        const isCurrent = pos === currentLine
        const yao = yaoLines[pos - 1]
        const type: 'yin' | 'yang' = yao?.type ?? 'yang'
        return (
          <div
            key={pos}
            data-current={isCurrent ? 'true' : 'false'}
            data-position={pos}
            className={cn(
              'flex items-center justify-center rounded-sm transition-all',
              isCurrent
                ? 'bg-june-red/20 ring-2 ring-june-red shadow-sm'
                : 'opacity-60'
            )}
            style={{ padding: '2px 4px' }}
          >
            <MiniYao type={type} isCurrent={isCurrent} />
          </div>
        )
      })}
    </div>
  )
}
