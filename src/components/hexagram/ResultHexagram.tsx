import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { YaoLineStack } from './YaoLineStack'
import { hexagramLineStates, hexagramLineTypes } from '@/lib/hexagramLines'
import { cn } from '@/utils/cn'
import type { Hexagram, UserRecord } from '@/types'

interface ResultHexagramProps {
  hexagram: Hexagram
  label: '本卦' | '变卦'
  movingLine: UserRecord['movingLine']
  isChanged?: boolean
}

export function ResultHexagram({
  hexagram,
  label,
  movingLine,
  isChanged = false,
}: ResultHexagramProps) {
  const lines = hexagramLineTypes(hexagram)
  const states = hexagramLineStates(hexagram, {
    movingLine,
    changed: isChanged,
  })

  return (
    <article
      className={cn('result-hexagram', isChanged && 'result-hexagram-changed')}
      aria-label={`${label} · ${hexagram.name}`}
    >
      <div className="result-hexagram-label">
        <span>{label}</span>
        <span>第 {String(hexagram.number).padStart(2, '0')} 卦</span>
      </div>
      <div className="result-hexagram-art">
        <span className="result-hexagram-watermark" aria-hidden="true">
          {hexagram.shortName}
        </span>
        <div
          className="result-hexagram-ring"
          role="img"
          aria-label={`${hexagram.name}，第 ${movingLine} 爻${isChanged ? '已变' : '为动爻'}`}
        >
          <div aria-hidden="true">
            <YaoLineStack
              lines={lines}
              states={states}
              highlightLine={isChanged ? undefined : movingLine}
              width={74}
              thickness={6}
              lineGap={8}
              data-testid={
                isChanged ? 'result-changed-lines' : 'result-main-lines'
              }
            />
          </div>
        </div>
      </div>
      <h3>{hexagram.name}</h3>
      <p className="result-hexagram-keywords">
        {hexagram.keywords.slice(0, 3).join(' · ')}
      </p>
      <p className="result-hexagram-judgement">{hexagram.judgement}</p>
      <Link
        to={`/hexagram/${hexagram.id}`}
        className="result-original-link"
        aria-label={`查看${hexagram.name}完整卦辞`}
      >
        查看卦象原文
        <ArrowUpRight size={13} aria-hidden="true" />
      </Link>
    </article>
  )
}
