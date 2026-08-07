import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { TwinSpread } from '@/components/hexagram/TwinSpread'
import { FlipEntry } from '@/components/motion/FlipEntry'
import { PageTransition } from '@/components/motion'
import { getHexagramById } from '@/lib/divination'
import { getRecord, saveRecord } from '@/lib/storage'
import { generateInterpretation, AIError } from '@/lib/ai'
import { InterpretationRenderer } from '@/components/sections/InterpretationRenderer'
import { downloadCardPng, cardDataFromIds } from '@/lib/imageGen'
import { publishPost } from '@/lib/feed'
import { cn } from '@/utils/cn'
import type { UserRecord, HexagramId } from '@/types'

export interface ResultDisplayProps {
  recordId: string
  className?: string
}

export function ResultDisplay({ recordId, className }: ResultDisplayProps) {
  const navigate = useNavigate()
  const [record, setRecord] = useState<UserRecord | null>(() => getRecord(recordId))
  const [toast, setToast] = useState<string | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)
  const [aiText, setAiText] = useState<string | null>(record?.aiInterpretation ?? null)
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)

  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-light font-body mb-4">未找到该起卦记录</p>
        <Link to="/divination"><Button>重新起卦</Button></Link>
      </div>
    )
  }

  const main = getHexagramById(record.mainHexagramId as HexagramId)
  const changed = getHexagramById(record.changedHexagramId as HexagramId)
  if (!main || !changed) {
    return <div className="text-center py-12 text-ink-light">卦象数据缺失</div>
  }

  const timestampText = new Date(record.createdAt).toLocaleString('zh-CN')
  const aiSummarySource = record.aiInterpretation?.trim()
    ? record.aiInterpretation.trim().slice(0, 280)
    : undefined

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const handleInterpret = async () => {
    setAiError(null)
    setAiStatus('loading')
    setAiText('')
    try {
      let accumulated = ''
      const result = await generateInterpretation(
        {
          mainHexagram: main,
          changedHexagram: changed,
          movingLine: record.movingLine as 1 | 2 | 3 | 4 | 5 | 6,
          question: record.question,
        },
        null,
        (chunk) => {
          accumulated += chunk
          setAiText(accumulated)
        }
      )
      setAiText(result.text)
      setAiStatus('idle')
      const updated: UserRecord = { ...record, aiInterpretation: result.text }
      setRecord(updated)
      saveRecord(updated)
    } catch (err) {
      let msg: string
      if (err instanceof AIError) {
        switch (err.code) {
          case 'no-api-key':
          case 'missing-api-key':
            msg = err.message || '请先在设置中填写 API Key'
            break
          case 'invalid-api-key':
          case 'unauthorized':
            msg = err.message || 'API Key 无效或已过期'
            break
          case 'rate-limit':
            msg = err.message || '请求过于频繁，请稍后再试'
            break
          case 'timeout':
            msg = '请求超时'
            break
          case 'server-error':
            msg = 'AI 服务暂时不可用，请稍后再试'
            break
          case 'content-filtered':
          case 'input-filtered':
            msg = err.message || '内容触发了安全过滤，请调整提问后重试'
            break
          case 'quota-exceeded':
            msg = err.message || 'API 配额已用完'
            break
          case 'upstream-error':
          case 'token-limit':
            msg = err.message || '上游服务返回错误，请稍后再试'
            break
          case 'network-error':
          default:
            msg = err.message || '网络错误，请检查网络后重试'
        }
        // eslint-disable-next-line no-console
        console.error('[ai]', err.code, err.message, err.cause)
      } else {
        msg = err instanceof Error ? err.message || '卦象详解失败' : '卦象详解失败'
      }
      setAiError(msg)
      setAiStatus('error')
    }
  }

  const handleDownload = async () => {
    setDownloadBusy(true)
    try {
      const data = cardDataFromIds({
        mainId: main.id,
        changedId: changed.id,
        movingLine: record.movingLine,
        aiSummary: aiSummarySource,
        userNote: record.userNote ?? undefined,
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
    setPublishBusy(true)
    try {
      const res = await publishPost({
        mainHexagramId: main.id,
        changedHexagramId: changed.id,
        movingLine: record.movingLine,
        question: record.question,
        aiSummary: aiSummarySource,
      })
      setPublishedId(res.id)
      showToast('已发布到社区卦册')
    } catch (err) {
      console.error('[ResultDisplay] publish failed:', err)
      showToast(err instanceof Error ? err.message : '发布失败')
    } finally {
      setPublishBusy(false)
    }
  }

  const hasCache = Boolean(record.aiInterpretation)
  const isLoading = aiStatus === 'loading'
  const isError = aiStatus === 'error'
  const isOpen = isLoading || isError || Boolean(aiText)

  return (
    <PageTransition
      className={cn(
        'max-w-3xl mx-auto my-8 p-6 md:p-10',
        'bg-rice border-2 border-june-bronze rounded-lg',
        'shadow-[0_4px_24px_rgba(74,55,28,0.15)]',
        className,
      )}
    >
      <div className="text-center mb-6 pb-5 border-b border-june-bronze/20">
        <h1 className="text-[28px] md:text-[32px] font-display text-ink tracking-[0.4em]">
          卦 象 已 成
        </h1>
        <div className="text-sm text-ink-light font-body mt-2 tracking-widest">
          {timestampText} · 起卦
        </div>
      </div>

      {record.question && (
        <div className="text-center py-4 border-b border-june-bronze/20 mb-2">
          <div className="text-[10px] text-june-bronze font-display tracking-[0.3em] mb-2">
            — 所 问 何 事 —
          </div>
          <div className="font-display text-base text-ink leading-relaxed">
            「{record.question}」
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 sm:gap-6 items-start p-5 bg-rice-dark border-l-[3px] border-june-bronze rounded-sm mb-5">
        <FlipEntry className="w-[110px] mx-auto sm:mx-0">
          <HexagramCard hexagram={main} size="md" navigateOnClick={false} showStamp />
        </FlipEntry>
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl text-ink mb-1 tracking-wider text-center sm:text-left break-keep">
            {main.name}
          </h2>
          <div className="flex flex-wrap gap-1.5 my-2 justify-center sm:justify-start">
            {main.keywords.slice(0, 3).map((kw) => (
              <span key={kw} className="px-2 py-0.5 bg-june-red/10 text-june-red rounded-pill text-[11px] font-display">
                {kw}
              </span>
            ))}
          </div>
          <p className="font-body text-xs text-ink-light italic mb-2 text-center sm:text-left">
            卦辞：{main.judgement}
          </p>
          <p className="text-sm text-ink font-body text-center sm:text-left">
            动爻 · 第 <span className="text-june-red font-bold">{record.movingLine}</span> 爻
            {' → '}
            <Link to={`/hexagram/${changed.id}`} className="text-june-red font-bold hover:underline">
              变卦 · {changed.name}
            </Link>
          </p>
          {(() => {
            const yao = main.yaoLines.find((y) => y.position === record.movingLine)
            if (!yao) return null
            return (
              <div className="mt-4 pt-3 border-t border-june-bronze/20">
                <div className="text-[10px] font-display tracking-widest text-june-bronze mb-2">
                  动 爻 · 第 {record.movingLine} 爻 · {yao.type === 'yang' ? '九' : '六'}
                </div>
                <div
                  className="px-3 py-2 bg-rice border-l-2 border-june-red text-ink leading-loose"
                  style={{ fontFamily: 'KaiTi, STKaiti, serif', fontSize: '0.95rem' }}
                >
                  {yao.originalText}
                </div>
                {yao.modernMeaning && (
                  <p className="mt-2 text-xs text-ink-light leading-relaxed">
                    {yao.modernMeaning}
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      <div className="p-5 bg-rice-dark border-l-[3px] border-june-gold rounded-sm mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-xs text-june-bronze tracking-[0.3em]">
            卦 象 详 解
          </div>
          <div className="flex items-center gap-2">
            {!isOpen && !hasCache && (
              <Button onClick={handleInterpret} variant="primary" size="sm">
                卦象详解
              </Button>
            )}
            {isLoading && (
              <Button variant="primary" size="sm" loading disabled>
                解读中…
              </Button>
            )}
            {isError && (
              <Button onClick={handleInterpret} variant="secondary" size="sm">
                重试
              </Button>
            )}
          </div>
        </div>
        {!isOpen && !hasCache && (
          <p className="font-body text-sm text-ink-light/70 italic">
            点击「卦象详解」获取针对此次起卦的解读。
          </p>
        )}
        {isError && aiError && (
          <p className="text-june-red text-sm font-body" role="alert">
            {aiError}
          </p>
        )}
        {aiText !== null && aiText !== '' && (
          <InterpretationRenderer text={aiText} />
        )}
      </div>

      <div className="mb-5">
        <TwinSpread
          leftHex={main}
          rightHex={changed}
          leftLabel="本卦"
          rightLabel="变卦"
          movingLine={record.movingLine}
        />
      </div>

      <div className="flex flex-wrap justify-center items-center gap-3 pt-6 mt-2 border-t border-june-bronze/30">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloadBusy}
          className="inline-flex items-center px-5 py-2.5
                     bg-june-red text-rice border border-june-red
                     font-display text-sm tracking-[0.2em] rounded-sm
                     hover:bg-june-red/90 transition-colors
                     disabled:opacity-50"
          title="下载卦象卡 (PNG)"
        >
          收藏本卦
        </button>
        {publishedId ? (
          <Link to="/feed"
            className="inline-flex items-center px-5 py-2.5
                       border border-june-bronze text-june-bronze bg-transparent
                       font-display text-sm tracking-[0.2em] rounded-sm
                       hover:bg-june-bronze hover:text-rice transition-colors">
            ✓ 已发布 · 查看
          </Link>
        ) : (
          <Button onClick={handleShare} variant="ghost" loading={publishBusy}>
            ↗ 发布到社区
          </Button>
        )}
        <Button onClick={() => navigate('/divination')} variant="ghost">↻ 再起一卦</Button>
      </div>

      <div className="text-center mt-4">
        <Link to="/" className="text-xs text-ink-light/60 font-body hover:text-ink">
          回到首页
        </Link>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-ink text-rice rounded-md font-display text-sm tracking-widest shadow-lg z-50">
          {toast}
        </div>
      )}
    </PageTransition>
  )
}
