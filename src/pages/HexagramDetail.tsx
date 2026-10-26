import { useParams, Link, useLocation } from 'react-router-dom'
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageTitle } from '@/components/ui/PageTitle'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { YaoLineScroll } from '@/components/hexagram/YaoLineScroll'
import { Seal } from '@/components/ui/Seal'
import { Button } from '@/components/ui/Button'
import { BreathEffect } from '@/components/motion/BreathEffect'
import { getHexagramById } from '@/lib/divination'
import { getOpposite, getInverse, getNuclear } from '@/lib/relations'
import { downloadCardPng, cardDataFromIds } from '@/lib/imageGen'
import { SEO } from '@/lib/seo'
import { cn } from '@/utils/cn'
import { PALACE_NAMES, parseHexagramId } from '@/lib/codex'
import trigrams from '@/data/trigrams.json'
import sources from '@/data/classical-sources.json'
import type { Hexagram, HexagramId } from '@/types'
import '@/styles/codex.css'

const RELATIONS = [
  { key: 'opposite', label: '错卦' },
  { key: 'inverse', label: '综卦' },
  { key: 'nuclear', label: '互卦' },
] as const

type RelationKey = (typeof RELATIONS)[number]['key']

export default function HexagramDetail() {
  const { id } = useParams<{ id: string }>()
  const parsed = parseHexagramId(id)
  let hexagram: Hexagram | null = null
  try {
    if (parsed) hexagram = getHexagramById(parsed)
  } catch {
    /* Missing static data. */
  }
  if (!hexagram) return <UnavailableHexagram />
  return (
    <DetailBoundary key={hexagram.id}>
      <HexagramReading hexagram={hexagram} />
    </DetailBoundary>
  )
}

function UnavailableHexagram({ failed = false }: { failed?: boolean }) {
  return (
    <PageLayout>
      <SEO title={failed ? '卦象暂不可用' : '未找到该卦象'} />
      <div className="text-center py-12">
        <h1 className="text-xl font-display text-ink mb-4">
          {failed ? '该卦象暂时无法显示' : '未找到该卦象'}
        </h1>
        <p className="text-ink-light font-body mb-4">
          请从图鉴选择第 1—64 卦。
        </p>
        <Link
          to="/codex"
          className="inline-flex min-h-11 items-center px-4 text-june-red underline"
        >
          返回图鉴
        </Link>
      </div>
    </PageLayout>
  )
}

class DetailBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <UnavailableHexagram failed />
    ) : (
      this.props.children
    )
  }
}

function HexagramReading({ hexagram }: { hexagram: Hexagram }) {
  const location = useLocation()
  const search = new URLSearchParams()
  const incoming = new URLSearchParams(location.search)
  for (const key of ['view', 'q', 'group']) {
    const value = incoming.get(key)
    if (value) search.set(key, value)
  }
  const suffix = search.size ? '?' + search.toString() : ''
  const returnTo = '/codex' + suffix
  const source = sources.entries.find((entry) => entry.id === hexagram.id)
  const upper = trigrams.find(
    (trigram) => trigram.id === hexagram.upperTrigramId,
  )
  const lower = trigrams.find(
    (trigram) => trigram.id === hexagram.lowerTrigramId,
  )
  const previous =
    hexagram.id > 1 ? getHexagramById((hexagram.id - 1) as HexagramId) : null
  const next =
    hexagram.id < 64 ? getHexagramById((hexagram.id + 1) as HexagramId) : null
  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView?.()
    else if (window.scrollY > 0) window.scrollTo(0, 0)
    // Changing only a relation or a chapter anchor should not reset the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexagram.id])
  const [activeRelation, setActiveRelation] = useState<RelationKey>('opposite')
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleDownload = async () => {
    if (!hexagram) return
    setDownloadBusy(true)
    try {
      const data = cardDataFromIds({ mainId: hexagram.id })
      if (data) {
        await downloadCardPng(data, `易象阁-卦象-${hexagram.name}.png`)
        setToast('已下载卦象卡')
        setTimeout(() => setToast(null), 1800)
      }
    } catch (err) {
      console.error('[HexagramDetail] download failed:', err)
      setToast('下载失败')
      setTimeout(() => setToast(null), 1800)
    } finally {
      setDownloadBusy(false)
    }
  }

  // B2: wrap relation computation in try/catch + useMemo so a single bad
  // data point (e.g. corrupt static JSON) renders a fallback instead of
  // crashing the whole page.
  const relation = useMemo<
    { ok: true; hex: ReturnType<typeof getHexagramById> } | { ok: false }
  >(() => {
    try {
      const id =
        activeRelation === 'opposite'
          ? getOpposite(hexagram.id)
          : activeRelation === 'inverse'
            ? getInverse(hexagram.id)
            : getNuclear(hexagram.id)
      return { ok: true, hex: getHexagramById(id as HexagramId) }
    } catch {
      return { ok: false }
    }
  }, [activeRelation, hexagram.id])
  const relationHex = relation.ok ? relation.hex : null

  return (
    <PageLayout>
      <SEO
        title={`第 ${hexagram.number} 卦 · ${hexagram.name}`}
        description={hexagram.judgement}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header — 卷轴匾额 (P0 UI optimization) */}
        <PageTitle
          title={hexagram.name}
          kicker={`第 ${hexagram.number} 卦`}
          size="lg"
          className="mb-6 sm:mb-8"
          trailing={
            <div className="flex flex-wrap gap-2 justify-center">
              {hexagram.keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 bg-june-red/10 text-june-red rounded-pill text-xs font-display"
                >
                  {kw}
                </span>
              ))}
            </div>
          }
        />

        <p className="text-center text-sm text-ink-light leading-relaxed">
          上卦：{upper?.name}（{upper?.nature}） · 下卦：{lower?.name}（
          {lower?.nature}） · {PALACE_NAMES[hexagram.palace]} ·{' '}
          {hexagram.palaceRole}
        </p>
        <nav className="hexagram-detail__directory" aria-label="阅读目录">
          <a href="#judgement">卦辞</a>
          <a href="#tuan">彖传</a>
          <a href="#image">大象</a>
          <a href="#yao">六爻与小象</a>
          <a href="#modern">现代解读</a>
          <a href="#relations">卦象关系</a>
        </nav>

        {/* Hero card — V5: removed shadow-lg so the breath halo is the only depth cue.
           The Seal is rendered AFTER HexagramCard so it paints on top of
           the card's rice background. (When the Seal came first in DOM
           order, the card's opaque background covered ~26px of the
           seal's left side, making the stamp look "chopped off".) The
           explicit z-10 makes the stacking intent self-documenting and
           survives anyone inserting another sibling later. */}
        <div className="flex justify-center mb-10">
          <BreathEffect className="rounded-md" duration={4500}>
            <div
              data-testid="hero-card"
              className="bg-rice border-2 border-june-bronze p-6 rounded-md w-fit relative"
            >
              <HexagramCard
                hexagram={hexagram}
                size="lg"
                navigateOnClick={false}
                showStamp={false}
              />
              <div className="absolute top-3 right-3 z-10 pointer-events-none">
                <Seal text={hexagram.shortName} size={38} rotation={-3} />
              </div>
            </div>
          </BreathEffect>
        </div>

        {/* D1: section rhythm — 6 segments in <section> with divide-y separators */}
        <div className="divide-y divide-june-bronze/30 mb-10">
          {hexagram.judgement && (
            <section
              id="judgement"
              className="hexagram-detail__section py-6 first:pt-0 last:pb-0"
            >
              <div className="text-xs text-june-bronze font-display tracking-widest mb-2">
                卦 辞
              </div>
              <p className="font-body text-ink leading-relaxed">
                {hexagram.judgement}
              </p>
            </section>
          )}
          {hexagram.tuanzhuan && (
            <section
              id="tuan"
              className="hexagram-detail__section py-6 first:pt-0 last:pb-0"
            >
              <div className="text-xs text-june-bronze font-display tracking-widest mb-2">
                彖 传
              </div>
              <p className="font-body text-ink leading-relaxed">
                {hexagram.tuanzhuan}
              </p>
            </section>
          )}
          {hexagram.xiangzhuan.daXiang && (
            <section
              id="image"
              className="hexagram-detail__section py-6 first:pt-0 last:pb-0"
            >
              <div className="text-xs text-june-bronze font-display tracking-widest mb-2">
                象 传
              </div>
              <p className="font-body text-ink leading-relaxed">
                {hexagram.xiangzhuan.daXiang}
              </p>
            </section>
          )}
          <section
            id="yao"
            className="hexagram-detail__section py-6 first:pt-0 last:pb-0"
          >
            <h2 className="text-lg font-display text-ink mb-4 tracking-widest text-center">
              六 爻 爻 辞
            </h2>
            <YaoLineScroll
              yaoLines={hexagram.yaoLines}
              xiaoXiang={hexagram.xiangzhuan.xiaoXiang}
            />
            {hexagram.specialText && (
              <div className="mt-4 p-4 bg-rice-dark border border-june-bronze rounded-sm">
                <h3 className="font-display text-lg text-ink mb-2">
                  {hexagram.specialText.label}
                </h3>
                <p className="font-body text-ink leading-relaxed">
                  {hexagram.specialText.originalText}
                </p>
                <p className="font-body text-sm text-ink-light mt-2">
                  《象》：{hexagram.specialText.xiangText}
                </p>
              </div>
            )}
          </section>
          {hexagram.modernInterpretation && (
            <section
              id="modern"
              className="hexagram-detail__section py-6 first:pt-0 last:pb-0"
            >
              <h2 className="text-lg font-display text-june-red mb-3 tracking-widest">
                现 代 解 读
              </h2>
              <p className="font-body text-ink leading-relaxed">
                {hexagram.modernInterpretation}
              </p>
            </section>
          )}
          <section
            id="relations"
            className="hexagram-detail__section py-6 first:pt-0 last:pb-0"
          >
            <h2 className="text-lg font-display text-ink mb-4 tracking-widest text-center">
              卦 象 关 系
            </h2>
            {relation.ok && relationHex ? (
              <>
                <div className="flex justify-center gap-2 mb-6">
                  {RELATIONS.map((rel) => (
                    <button
                      key={rel.key}
                      type="button"
                      onClick={() => setActiveRelation(rel.key)}
                      className={cn(
                        'px-4 py-2 rounded-sm font-display text-sm transition-colors',
                        activeRelation === rel.key
                          ? 'bg-june-red text-rice'
                          : 'bg-rice text-ink border border-june-bronze hover:bg-rice-dark',
                      )}
                      aria-pressed={activeRelation === rel.key}
                    >
                      {rel.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center">
                  <Link
                    to={`/hexagram/${relationHex.id}${suffix}`}
                    className="block"
                  >
                    <div className="p-4 bg-rice border-2 border-june-bronze rounded-md text-center hover:bg-rice-dark transition-colors">
                      <HexagramCard
                        hexagram={relationHex}
                        size="md"
                        navigateOnClick={false}
                      />
                      <div className="text-xs text-june-bronze font-display mt-2 tracking-widest">
                        查看 {relationHex.name}
                      </div>
                    </div>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-center text-ink-light font-body">
                本卦关系数据缺失
              </p>
            )}
          </section>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={handleDownload}
            variant="primary"
            loading={downloadBusy}
          >
            下载卦象卡
          </Button>
          <Link
            to="/divination"
            className="ui-button ui-button--secondary inline-flex items-center justify-center px-5 py-2.5 font-display rounded-sm"
          >
            三数起卦
          </Link>
          <Link
            to={returnTo}
            className="ui-button ui-button--ghost inline-flex items-center justify-center px-5 py-2.5 font-display rounded-sm"
          >
            返回图鉴
          </Link>
        </div>

        <nav className="hexagram-detail__sequence" aria-label="顺序阅读">
          {previous && (
            <Link to={`/hexagram/${previous.id}${suffix}`}>
              上一卦：{previous.name}
            </Link>
          )}
          {next && (
            <Link to={`/hexagram/${next.id}${suffix}`}>
              下一卦：{next.name}
            </Link>
          )}
        </nav>
        <details className="hexagram-detail__source">
          <summary className="cursor-pointer min-h-8">
            原文来源与校订说明
          </summary>
          <p>
            卦爻辞与《象传》为古文原文；“释”“今”“深意”及现代解读为现代阐释。小象据维基文库逐卦对照，保留部分通行异体字，校订于{' '}
            {sources.reviewedAt}。
          </p>
          {source && (
            <a
              href={source.revision ?? source.url}
              target="_blank"
              rel="noreferrer"
            >
              查看《周易·{hexagram.shortName}》原文对照
            </a>
          )}
          <p>
            错卦：六爻阴阳互换。综卦：六爻上下翻转。互卦：取二三四爻为下卦、三四五爻为上卦。
          </p>
        </details>

        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-ink text-rice rounded-md font-display text-sm tracking-widest shadow-lg z-50">
            {toast}
          </div>
        )}
      </motion.div>
    </PageLayout>
  )
}
