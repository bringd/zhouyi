import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { TwinSpread } from '@/components/hexagram/TwinSpread'
import { Stamp } from '@/components/ui/Stamp'
import { FlipEntry } from '@/components/motion/FlipEntry'
import { BreathEffect } from '@/components/motion/BreathEffect'
import { PageTransition } from '@/components/motion'
import { getHexagramById } from '@/lib/divination'
import { getRecord, saveRecord } from '@/lib/storage'
import { generateInterpretation, AIError } from '@/lib/ai'
import { cn } from '@/utils/cn'
import type { UserRecord, HexagramId } from '@/types'

export interface ResultDisplayProps {
  /** The record id to display */
  recordId: string
  className?: string
}

/**
 * Display the divination result for a given record id.
 * Shows hexagram (left), interpretation (right), AI deep-read button, and twin spread.
 */
export function ResultDisplay({ recordId, className }: ResultDisplayProps) {
  const navigate = useNavigate()
  const [record, setRecord] = useState<UserRecord | null>(() => getRecord(recordId))
  const [aiText, setAiText] = useState<string | null>(record?.aiInterpretation ?? null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-light font-body mb-4">未找到该起卦记录</p>
        <Link to="/divination">
          <Button>重新起卦</Button>
        </Link>
      </div>
    )
  }

  const main = getHexagramById(record.mainHexagramId as HexagramId)
  const changed = getHexagramById(record.changedHexagramId as HexagramId)
  if (!main || !changed) {
    return <div className="text-center py-12 text-ink-light">卦象数据缺失</div>
  }

  const handleAIInterpretation = async () => {
    setAiError(null)
    setAiLoading(true)
    try {
      let accumulated = ''
      const result = await generateInterpretation(
        { mainHexagram: main, changedHexagram: changed, movingLine: record.movingLine, question: record.question },
        null,
        (chunk) => {
          accumulated += chunk
          setAiText(accumulated)
        }
      )
      setAiText(result.text)
      // Save to record
      const updated: UserRecord = { ...record, aiInterpretation: result.text }
      setRecord(updated)
      saveRecord(updated)
    } catch (err) {
      let msg: string
      if (err instanceof AIError) {
        if (err.code === 'unauthorized') msg = '会话已过期，请刷新页面'
        else if (err.code === 'rate-limit') msg = err.message || '请求过于频繁，请稍后再试'
        else if (err.code === 'timeout') msg = '请求超时'
        else if (err.code === 'server-error') msg = '服务暂时不可用，请稍后再试'
        else if (err.code === 'network-error') msg = '网络错误，请检查网络后重试'
        else msg = err.message
      } else {
        msg = err instanceof Error ? err.message : 'AI 解读失败'
      }
      setAiError(msg)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <PageTransition className={cn('max-w-6xl mx-auto p-4 md:p-8', className)}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-display-md font-display text-ink tracking-widest">卦 象 已 成</h1>
        <div className="text-sm text-ink-light font-body mt-2">
          {new Date(record.createdAt).toLocaleString('zh-CN')}
        </div>
      </div>

      {/* Question display */}
      {record.question && (
        <div className="mb-6 p-4 bg-rice border border-june-bronze/30 rounded-md text-center">
          <div className="text-xs text-june-bronze font-display tracking-widest mb-1">所 问 之 事</div>
          <div className="font-body text-ink">{record.question}</div>
        </div>
      )}

      {/* Main + changed hexagram hero */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center mb-10">
        <FlipEntry className="w-full">
          <BreathEffect className="w-full rounded-md" duration={4500}>
            <div className="aspect-square w-full bg-gradient-to-br from-june-red via-june-clay to-june-red relative flex items-center justify-center p-8 rounded-md shadow-2xl">
              <div className="absolute top-4 left-4 text-rice/60 font-display text-sm tracking-widest">第 {main.number} 卦</div>
              <div className="absolute top-4 right-4">
                <Stamp text={main.shortName} size="sm" rotation={-3} />
              </div>
              <div className="w-full max-w-xs">
                <HexagramCard hexagram={main} size="lg" navigateOnClick={false} showStamp={false} />
              </div>
              <div className="absolute bottom-4 right-4 text-rice font-display text-2xl tracking-widest">{main.shortName}</div>
            </div>
          </BreathEffect>
        </FlipEntry>

        <motion.div className="flex flex-col gap-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
          <h2 className="text-display-md font-display text-ink leading-tight">{main.name}</h2>
          <div className="flex flex-wrap gap-2">
            {main.keywords.slice(0, 4).map((kw) => (
              <span key={kw} className="px-3 py-1 bg-june-red/10 text-june-red rounded-pill text-xs font-display">
                {kw}
              </span>
            ))}
          </div>
          {main.modernInterpretation && (
            <p className="font-body text-ink-light text-base leading-relaxed">{main.modernInterpretation}</p>
          )}
          <div className="text-sm text-ink-light font-body">
            动爻 · 第 <span className="text-june-red font-bold">{record.movingLine}</span> 爻
            {' → '}
            <Link to={`/hexagram/${changed.id}`} className="text-june-red font-bold hover:underline">
              变卦 · {changed.name}
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Twin spread: 本卦 + 变卦 with full judgements */}
      <div className="mb-10">
        <TwinSpread
          leftHex={main}
          rightHex={changed}
          leftLabel="本卦"
          rightLabel="变卦"
          movingLine={record.movingLine}
        />
      </div>

      {/* AI interpretation */}
      <div className="mb-10 p-6 bg-rice border-2 border-june-bronze rounded-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-ink tracking-widest">AI 深 度 解 读</h3>
          {!aiText && (
            <Button onClick={handleAIInterpretation} loading={aiLoading} variant="primary">
              {aiLoading ? '解读中…' : '开始 AI 解读'}
            </Button>
          )}
        </div>
        {aiError && <p className="text-june-red text-sm font-body mb-2">{aiError}</p>}
        {aiText ? (
          <div className="font-body text-ink-light leading-relaxed whitespace-pre-wrap">{aiText}</div>
        ) : !aiError && (
          <p className="text-ink-light/60 text-sm font-body italic">点击"开始 AI 解读"以获得更深入的现代视角分析。</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate('/divination')} variant="primary">再起一卦</Button>
        <Link to="/">
          <Button variant="secondary">回到首页</Button>
        </Link>
        <Link to={`/hexagram/${main.id}`}>
          <Button variant="ghost">查看本卦详情</Button>
        </Link>
      </div>
    </PageTransition>
  )
}
