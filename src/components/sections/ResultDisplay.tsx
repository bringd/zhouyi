import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { TwinSpread } from '@/components/hexagram/TwinSpread'
import { Seal } from '@/components/ui/Seal'
import { FlipEntry } from '@/components/motion/FlipEntry'
import { BreathEffect } from '@/components/motion/BreathEffect'
import { PageTransition } from '@/components/motion'
import { getHexagramById } from '@/lib/divination'
import { getRecord, saveRecord } from '@/lib/storage'
import { generateInterpretation, AIError } from '@/lib/ai'
import { buildSharePayload, buildShareUrl } from '@/lib/share'
import { downloadCardPng, cardDataFromIds } from '@/lib/imageGen'
import { cn } from '@/utils/cn'
import type { UserRecord, HexagramId } from '@/types'

export interface ResultDisplayProps {
  /** The record id to display */
  recordId: string
  className?: string
}

/** Max characters shown in the "简易版" AI preview before collapsing. */
const AI_SUMMARY_PREVIEW_CHARS = 120

/**
 * Display the divination result for a given record id.
 *
 * Layout follows the "① 纵列分层" mockup:
 *   1. Header (卦象已成 + timestamp)
 *   2. 本卦 visual + info split row
 *   3. AI 解读 · 简易版 (with "查看完整" expand)
 *   4. 感言 input
 *   5. Actions: ♡ 收藏 | ↗ 分享 | ↻ 再起一卦
 *
 * The TwinSpread and 动爻·爻辞 sections are preserved below the
 * template so existing per-yao context isn't lost.
 */
export function ResultDisplay({ recordId, className }: ResultDisplayProps) {
  const navigate = useNavigate()
  const [record, setRecord] = useState<UserRecord | null>(() => getRecord(recordId))
  const [aiText, setAiText] = useState<string | null>(record?.aiInterpretation ?? null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiExpanded, setAiExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string>(record?.userNote ?? '')
  const [toast, setToast] = useState<string | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)

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

  const timestampText = new Date(record.createdAt).toLocaleString('zh-CN')

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
        else if (err.code === 'no-backend') msg = err.message || 'AI 解读功能暂未上线'
        else msg = err.message
      } else {
        msg = err instanceof Error ? err.message : 'AI 解读失败'
      }
      setAiError(msg)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveNote = () => {
    const updated: UserRecord = { ...record, userNote: noteDraft }
    setRecord(updated)
    saveRecord(updated)
    showToast('感言已保存')
  }

  const handleDownload = async () => {
    setDownloadBusy(true)
    try {
      const data = cardDataFromIds({
        mainId: main.id,
        changedId: changed.id,
        movingLine: record.movingLine,
        aiSummary: aiText?.trim() ? aiText.trim().slice(0, 280) : undefined,
        userNote: noteDraft.trim() || undefined,
        timestamp: timestampText,
      })
      if (data) {
        await downloadCardPng(data, `易象阁-起卦-${main.name}.png`)
        showToast('已下载卦象卡')
      }
    } catch (err) {
      console.error('[ResultDisplay] download failed:', err)
      showToast('下载失败')
    } finally {
      setDownloadBusy(false)
    }
  }

  const handleShare = async () => {
    try {
      const payload = buildSharePayload({
        mainHexagramId: main.id,
        changedHexagramId: changed.id,
        movingLine: record.movingLine,
        question: record.question,
        aiText: aiText?.trim() || undefined,
        userNote: noteDraft.trim() || undefined,
        createdAt: record.createdAt,
      })
      const url = buildShareUrl(payload)
      await navigator.clipboard.writeText(url)
      showToast('分享链接已复制')
    } catch (err) {
      console.error('[ResultDisplay] share failed:', err)
      showToast('复制失败')
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <PageTransition className={cn('max-w-2xl mx-auto p-4 md:p-8', className)}>
      {/* 1. Header */}
      <div className="text-center mb-6">
        <h1 className="text-display-md font-display text-ink tracking-widest">卦 象 已 成</h1>
        <div className="text-sm text-ink-light font-body mt-2">{timestampText} · 起卦</div>
      </div>

      {/* 2. 本卦 + 信息 左右分栏 */}
      <div className="grid grid-cols-[130px_1fr] gap-6 items-center p-5 mb-6 bg-rice-dark rounded-md">
        <FlipEntry className="w-[110px]">
          <BreathEffect className="rounded-md" duration={4500}>
            <div className="relative bg-gradient-to-br from-june-red via-june-clay to-june-red p-3 rounded-md">
              <div className="absolute top-1 left-1 text-rice/60 font-display text-[10px] tracking-widest">第 {main.number} 卦</div>
              <div className="absolute top-1 right-1">
                <Seal text={main.shortName} size={28} rotation={-3} />
              </div>
              <HexagramCard hexagram={main} size="md" navigateOnClick={false} showStamp={false} />
            </div>
          </BreathEffect>
        </FlipEntry>
        <div>
          <h2 className="font-display text-2xl text-ink mb-1">{main.name}</h2>
          <div className="flex flex-wrap gap-1.5 my-2">
            {main.keywords.slice(0, 3).map((kw) => (
              <span key={kw} className="px-2 py-0.5 bg-june-red/10 text-june-red rounded-pill text-[11px] font-display">
                {kw}
              </span>
            ))}
          </div>
          <p className="font-body text-xs text-ink-light italic mb-2">卦辞：{main.judgement}</p>
          <p className="text-sm text-ink font-body">
            动爻 · 第 <span className="text-june-red font-bold">{record.movingLine}</span> 爻
            {' → '}
            <Link to={`/hexagram/${changed.id}`} className="text-june-red font-bold hover:underline">
              变卦 · {changed.name}
            </Link>
          </p>
        </div>
      </div>

      {/* 3. AI 解读 · 简易版 */}
      <div className="mb-6 p-5 bg-june-gold/[0.06] border-l-[3px] border-june-gold rounded-sm">
        <div className="font-display text-xs text-june-bronze tracking-[0.3em] mb-2">AI 解 读 · 简 易 版</div>
        {!aiText && !aiError && (
          <p className="font-body text-sm text-ink-light/70 italic">
            点击下方"开始 AI 解读"获取现代视角分析。
          </p>
        )}
        {aiError && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-june-red text-sm font-body">{aiError}</p>
            <Button onClick={handleAIInterpretation} variant="secondary" size="sm" loading={aiLoading}>
              重试
            </Button>
          </div>
        )}
        {aiText && (
          <>
            <p className="font-body text-sm text-ink leading-[1.8]">
              {aiExpanded ? aiText : aiText.slice(0, AI_SUMMARY_PREVIEW_CHARS) + (aiText.length > AI_SUMMARY_PREVIEW_CHARS ? '…' : '')}
            </p>
            {aiText.length > AI_SUMMARY_PREVIEW_CHARS && (
              <button
                type="button"
                onClick={() => setAiExpanded(!aiExpanded)}
                className="mt-2 text-xs text-june-red font-body hover:underline"
              >
                {aiExpanded ? '▲ 收起完整解读' : '▼ 查看完整解读'}
              </button>
            )}
          </>
        )}
        {!aiText && !aiError && (
          <div className="mt-3">
            <Button onClick={handleAIInterpretation} loading={aiLoading} variant="primary" size="sm">
              {aiLoading ? '解读中…' : '开始 AI 解读'}
            </Button>
          </div>
        )}
      </div>

      {/* 4. 感言 */}
      <div className="mb-6 p-5 bg-june-red/[0.04] border-l-[3px] border-june-red rounded-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-june-red tracking-[0.3em]">感 言</div>
          {noteDraft !== (record.userNote ?? '') && (
            <button
              type="button"
              onClick={handleSaveNote}
              className="px-3 py-1 bg-june-bronze text-rice rounded-sm font-display text-[11px] tracking-widest hover:opacity-90"
            >
              保存
            </button>
          )}
        </div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (record.userNote ?? '')) handleSaveNote()
          }}
          placeholder="在此写下你的感悟…"
          className="w-full min-h-[70px] p-2.5 font-body text-sm text-ink bg-white border border-june-bronze/30 rounded-sm resize-y focus:outline-none focus:border-june-red"
          maxLength={1000}
        />
        <div className="text-right text-[10px] text-ink-light/60 font-body mt-1">
          {noteDraft.length} / 1000
        </div>
      </div>

      {/* 5. 动爻 · 爻辞 (the actual answer to the divination) */}
      {(() => {
        const yao = main.yaoLines.find((y) => y.position === record.movingLine)
        if (!yao) return null
        return (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 p-5 bg-rice border-2 border-june-bronze rounded-md"
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-base text-ink tracking-widest">
                动 爻 · 第 {record.movingLine} 爻
              </h3>
              <span className="text-[10px] text-june-bronze font-display tracking-widest">
                {yao.type === 'yang' ? '阳爻' : '阴爻'} · {yao.type === 'yang' ? '九' : '六'}
              </span>
            </div>
            <div className="relative mb-4 px-3 py-3 bg-june-red/5 border-l-4 border-june-red">
              <div
                className="font-body text-ink leading-loose"
                style={{ fontFamily: 'KaiTi, STKaiti, serif', fontSize: '1rem' }}
              >
                {yao.originalText}
              </div>
            </div>
            <div className="mb-3">
              <div className="text-[10px] text-june-bronze font-display tracking-widest mb-1">现 代 意 义</div>
              <p className="font-body text-ink-light leading-relaxed text-xs">{yao.modernMeaning}</p>
            </div>
          </motion.section>
        )
      })()}

      {/* 6. Twin spread: 本卦 + 变卦 with full judgements */}
      <div className="mb-6">
        <TwinSpread
          leftHex={main}
          rightHex={changed}
          leftLabel="本卦"
          rightLabel="变卦"
          movingLine={record.movingLine}
        />
      </div>

      {/* 7. Action buttons (template ①: 收藏 / 分享 / 再起一卦) */}
      <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-june-bronze/30">
        <Button onClick={handleDownload} variant="primary" loading={downloadBusy}>
          <span className="text-june-red mr-1">♡</span> 收藏本卦
        </Button>
        <Button onClick={handleShare} variant="secondary">↗ 分享</Button>
        <Button onClick={() => navigate('/divination')} variant="ghost">↻ 再起一卦</Button>
      </div>

      <div className="text-center mt-4">
        <Link to="/" className="text-xs text-ink-light/60 font-body hover:text-ink">
          回到首页
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-ink text-rice rounded-md font-display text-sm tracking-widest shadow-lg z-50">
          {toast}
        </div>
      )}
    </PageTransition>
  )
}
