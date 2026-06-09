import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { PageLayout } from '@/components/layout/PageLayout'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { YaoLineScroll } from '@/components/hexagram/YaoLineScroll'
import { Seal } from '@/components/ui/Seal'
import { Button } from '@/components/ui/Button'
import { BreathEffect } from '@/components/motion/BreathEffect'
import { getHexagramById } from '@/lib/divination'
import { getOpposite, getInverse, getNuclear } from '@/lib/relations'
import { SEO } from '@/lib/seo'
import { cn } from '@/utils/cn'
import type { HexagramId } from '@/types'

const RELATIONS = [
  { key: 'opposite', label: '错卦' },
  { key: 'inverse', label: '综卦' },
  { key: 'nuclear', label: '互卦' },
] as const

type RelationKey = typeof RELATIONS[number]['key']

export default function HexagramDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeRelation, setActiveRelation] = useState<RelationKey>('opposite')

  const hexagram = id ? getHexagramById(parseInt(id, 10) as HexagramId) : null

  if (!hexagram) {
    return (
      <PageLayout>
        <div className="text-center py-12">
          <p className="text-ink-light font-body mb-4">未找到该卦象</p>
          <Button onClick={() => navigate('/codex')}>返回图鉴</Button>
        </div>
      </PageLayout>
    )
  }

  const relationId = activeRelation === 'opposite' ? getOpposite(hexagram.id)
    : activeRelation === 'inverse' ? getInverse(hexagram.id)
    : getNuclear(hexagram.id)
  const relationHex = getHexagramById(relationId as HexagramId)

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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-sm text-june-bronze font-display tracking-widest mb-2">第 {hexagram.number} 卦</div>
          <h1 className="text-display-lg font-display text-ink tracking-widest mb-3">{hexagram.name}</h1>
          <div className="flex flex-wrap gap-2 justify-center">
            {hexagram.keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 bg-june-red/10 text-june-red rounded-pill text-xs font-display">
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Hero card (V5: dropped redundant shadow-lg — BreathEffect provides the glow) */}
        <div className="flex justify-center mb-10">
          <BreathEffect className="rounded-md" duration={4500}>
            <div
              data-testid="hero-card"
              className="bg-rice border-2 border-june-bronze p-6 rounded-md w-fit relative"
            >
              <div className="absolute top-3 right-3">
                <Seal text={hexagram.shortName} size={38} rotation={-3} compact />
              </div>
              <HexagramCard hexagram={hexagram} size="lg" navigateOnClick={false} showStamp={false} />
            </div>
          </BreathEffect>
        </div>

        {/* 6-section rhythm (D1): each <section> separated by 1px june-red/20 divider */}
        <div className="divide-y divide-june-red/20">
          {/* 1. 卦辞 */}
          {hexagram.judgement && (
            <section className="py-5 first:pt-0">
              <div className="text-xs text-june-bronze font-display tracking-widest mb-2">卦 辞</div>
              <p className="font-body text-ink leading-relaxed">{hexagram.judgement}</p>
            </section>
          )}

          {/* 2. 彖传 */}
          {hexagram.tuanzhuan && (
            <section className="py-5">
              <div className="text-xs text-june-bronze font-display tracking-widest mb-2">彖 传</div>
              <p className="font-body text-ink leading-relaxed">{hexagram.tuanzhuan}</p>
            </section>
          )}

          {/* 3. 象传 */}
          {hexagram.xiangzhuan.daXiang && (
            <section className="py-5">
              <div className="text-xs text-june-bronze font-display tracking-widest mb-2">象 传</div>
              <p className="font-body text-ink leading-relaxed">{hexagram.xiangzhuan.daXiang}</p>
            </section>
          )}

          {/* 4. 六爻爻辞 — 卷轴式卡片（始终渲染，空卦显示 6 张占位卡） */}
          <section className="py-5">
            <h2 className="text-lg font-display text-ink mb-4 tracking-widest text-center">六 爻 爻 辞</h2>
            <YaoLineScroll yaoLines={hexagram.yaoLines} />
          </section>

          {/* 5. 现代解读 */}
          {hexagram.modernInterpretation && (
            <section className="py-5">
              <h2 className="text-lg font-display text-june-red mb-3 tracking-widest">现 代 解 读</h2>
              <p className="font-body text-ink leading-relaxed">{hexagram.modernInterpretation}</p>
            </section>
          )}

          {/* 6. 卦象关系 */}
          {relationHex && (
            <section className="py-5">
              <h2 className="text-lg font-display text-ink mb-4 tracking-widest text-center">卦 象 关 系</h2>
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
                        : 'bg-rice text-ink border border-june-bronze hover:bg-rice-dark'
                    )}
                    aria-pressed={activeRelation === rel.key}
                  >
                    {rel.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-center">
                <Link to={`/hexagram/${relationHex.id}`} className="block">
                  <div className="p-4 bg-rice border-2 border-june-bronze rounded-md text-center hover:bg-rice-dark transition-colors">
                    <HexagramCard hexagram={relationHex} size="md" navigateOnClick={false} />
                    <div className="text-xs text-june-bronze font-display mt-2 tracking-widest">
                      查看 {relationHex.name}
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/divination">
            <Button variant="primary">三数起卦</Button>
          </Link>
          <Link to="/codex">
            <Button variant="secondary">返回图鉴</Button>
          </Link>
        </div>
      </motion.div>
    </PageLayout>
  )
}
