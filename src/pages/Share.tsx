import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { Seal } from '@/components/ui/Seal'
import { SEO } from '@/lib/seo'
import { readShareFragment, type SharePayload } from '@/lib/share'
import { getHexagramById } from '@/lib/divination'
import { downloadCardPng, cardDataFromIds } from '@/lib/imageGen'
import { getRecord, updateRecordNote } from '@/lib/storage'
import type { HexagramId, UserRecord } from '@/types'

/**
 * Public share view.
 *
 * No auth, no DB — the link itself carries the data in its `#d=` fragment.
 * Reached via `/share#d=<base64>`.
 *
 * If the fragment is missing or malformed, show a friendly fallback and a
 * link back home. If the fragment happens to point at a record id (legacy
 * localStorage case), the page also accepts `/share/:id` and resolves it
 * from localStorage as a graceful fallback.
 */
export default function Share() {
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [fallbackRecord, setFallbackRecord] = useState<UserRecord | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [downloadBusy, setDownloadBusy] = useState(false)

  const location = useLocation()

  // Parse fragment on mount AND whenever the location hash changes. Uses
  // the router's location rather than `window.location` so the component
  // is testable under MemoryRouter (which does not sync the hash to
  // `window.location.href`). The `/share/:id` fallback below does
  // require `window.location` and is browser-only.
  useEffect(() => {
    const syntheticUrl = `${location.pathname}${location.search}${location.hash}`
    const fromHash = readShareFragment(syntheticUrl)
    if (fromHash) {
      setPayload(fromHash)
      return
    }
    if (typeof window !== 'undefined') {
      const m = window.location.pathname.match(/^\/share\/([\w-]+)/)
      if (m) {
        const r = getRecord(m[1])
        if (r) setFallbackRecord(r)
      }
    }
  }, [location.pathname, location.search, location.hash])

  const resolved = useMemo(() => resolveForRender(payload, fallbackRecord), [payload, fallbackRecord])

  // Build the full canonical share URL from the current location. Using
  // useLocation() (rather than window.location) keeps this testable
  // under MemoryRouter, which does not sync the hash to window.location.
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const origin = `${window.location.protocol}//${window.location.host}`
    return `${origin}${location.pathname}${location.hash}`
  }, [location.pathname, location.hash])

  if (!resolved) {
    return (
      <PageLayout>
        <SEO title="分享 链接无效" description="该分享链接已损坏或被截断。" />
        <div className="text-center py-16 max-w-md mx-auto">
          <h1 className="text-display-md font-display text-ink tracking-widest mb-4">链接无效</h1>
          <p className="font-body text-ink-light leading-relaxed mb-6">
            这条分享链接似乎丢失了部分内容。请回到起卦页面重新生成。
          </p>
          <a href="/">
            <Button variant="primary">回到首页</Button>
          </a>
        </div>
      </PageLayout>
    )
  }

  const { main, changed, movingLine, aiSummary, userNote, timestamp } = resolved
  const mainDateText = formatDate(timestamp)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setCopyState('failed')
      setTimeout(() => setCopyState('idle'), 1800)
    }
  }

  const handleDownload = async () => {
    setDownloadBusy(true)
    try {
      const data = cardDataFromIds({
        mainId: main.id as HexagramId,
        changedId: changed?.id as HexagramId | undefined,
        movingLine,
        aiSummary,
        userNote,
        timestamp: mainDateText,
      })
      if (data) {
        await downloadCardPng(data, `易象阁-起卦-${main.name}.png`)
      }
    } catch (err) {
      console.error('[share] download failed:', err)
    } finally {
      setDownloadBusy(false)
    }
  }

  return (
    <PageLayout>
      <SEO
        title={`${main.name} · 易象阁分享`}
        description={aiSummary ?? `${main.name}卦象的分享记录。`}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md mx-auto"
      >
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-june-red via-june-clay to-june-red rounded-md p-6 text-rice text-center shadow-xl mb-6">
          <div className="absolute top-3 right-3">
            <Seal text={main.shortName} size={36} rotation={-3} />
          </div>
          <div className="flex justify-center mb-3">
            <div className="w-40">
              <HexagramCard hexagram={main} size="md" navigateOnClick={false} showStamp={false} />
            </div>
          </div>
          <h1 className="font-display text-3xl tracking-[0.4em] mb-2">{main.name}</h1>
          <p className="font-display text-xs opacity-75 tracking-widest">第 {main.number} 卦</p>
        </div>

        {/* Moving + changed */}
        {movingLine !== undefined && changed && (
          <div className="flex justify-between items-center py-3 px-4 border-b border-june-bronze/20 text-sm">
            <span className="font-display text-xs text-june-bronze tracking-widest">动 爻</span>
            <span className="text-june-red font-medium">第 {movingLine} 爻</span>
          </div>
        )}
        {changed && (
          <div className="flex justify-between items-center py-3 px-4 border-b border-june-bronze/20 text-sm">
            <span className="font-display text-xs text-june-bronze tracking-widest">变 卦</span>
            <span className="text-june-red font-medium">{changed.name}</span>
          </div>
        )}
        {mainDateText && (
          <div className="flex justify-between items-center py-3 px-4 border-b border-june-bronze/20 text-sm">
            <span className="font-display text-xs text-june-bronze tracking-widest">时 间</span>
            <span className="text-ink">{mainDateText}</span>
          </div>
        )}

        {/* AI 解读 */}
        {aiSummary && (
          <div className="px-4 py-4 bg-june-gold/[0.06] border-b border-june-bronze/20">
            <div className="font-display text-xs text-june-bronze tracking-widest mb-2">AI 解 读</div>
            <p className="font-body text-sm text-ink leading-relaxed">{aiSummary}</p>
          </div>
        )}

        {/* 感言 */}
        {userNote && (
          <div className="px-4 py-4 bg-june-red/[0.04]">
            <div className="font-display text-xs text-june-red tracking-widest mb-2">感 言</div>
            <p className="font-body text-sm text-ink leading-relaxed italic">{userNote}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-6">
          <Button onClick={handleDownload} variant="primary" loading={downloadBusy}>
            ♡ 保存为图片
          </Button>
          <Button onClick={handleCopy} variant="secondary">
            {copyState === 'copied' ? '✓ 链接已复制' : copyState === 'failed' ? '复制失败' : '↗ 复制分享链接'}
          </Button>
          <a href={`/hexagram/${main.id}`} className="block">
            <Button variant="ghost" className="w-full">查看完整卦象</Button>
          </a>
          <a href="/" className="block">
            <Button variant="ghost" className="w-full">易象阁首页</Button>
          </a>
        </div>

        <p className="text-xs text-ink-light/60 text-center mt-6 font-body">
          本结果用于周易文化研究与自我反思，不作为现实决策的唯一依据。
        </p>
      </motion.div>
    </PageLayout>
  )
}

interface ResolvedShare {
  main: ReturnType<typeof getHexagramById>
  changed: ReturnType<typeof getHexagramById>
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  aiSummary: string
  userNote: string
  timestamp: number
}

function resolveForRender(p: SharePayload | null, fallback: UserRecord | null): ResolvedShare | null {
  if (p) {
    const main = getHexagramById(p.m)
    if (!main) return null
    const changed = getHexagramById(p.c)
    return {
      main,
      changed: changed ?? main,
      movingLine: p.l,
      aiSummary: p.a ?? '',
      userNote: p.n ?? '',
      timestamp: p.t,
    }
  }
  if (fallback) {
    const main = getHexagramById(fallback.mainHexagramId)
    if (!main) return null
    return {
      main,
      changed: getHexagramById(fallback.changedHexagramId) ?? main,
      movingLine: fallback.movingLine,
      aiSummary: fallback.aiInterpretation ?? '',
      userNote: fallback.userNote ?? '',
      timestamp: fallback.createdAt,
    }
  }
  return null
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Helper used by ResultDisplay when wiring up the share button. Not
// exported from this file, but re-exported through a thin shim so the
// caller doesn't need to know about the storage internals.
export { updateRecordNote }
