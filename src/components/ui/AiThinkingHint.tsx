import { useEffect, useState } from 'react'

/**
 * Rotating subtext shown while a reasoning model is still thinking.
 *
 * The first answer token can arrive ~15-20s after the request on the same-origin
 * demo proxy (reasoning budget is billed before the text starts), so the result
 * view needs to show progress rather than a static placeholder. The parent
 * element owns the live region and the stable label; this component is
 * decorative and hidden from screen readers to avoid re-announcing every cycle.
 */
const HINTS = [
  '先看动爻落在何处，再定本卦的分寸',
  '比对变卦，确认前后是否自洽',
  '回到你的问题，找一条能落地的建议',
] as const

const CYCLE_MS = 3600

export function AiThinkingHint() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % HINTS.length),
      CYCLE_MS,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <span className="ai-thinking-hint" aria-hidden="true">
      <span className="ai-thinking-hint__text" key={index}>
        {HINTS[index]}
      </span>
    </span>
  )
}
