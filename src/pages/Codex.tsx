import { useMemo } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageTitle } from '@/components/ui/PageTitle'
import { CodexGrid } from '@/components/sections/CodexGrid'
import { SEO } from '@/lib/seo'
import hexagramsData from '@/data/hexagrams.json'
import type { Hexagram } from '@/types'

export default function Codex() {
  const hexagrams = useMemo(() => hexagramsData as Hexagram[], [])
  return (
    <PageLayout>
      <SEO title="64 卦图鉴" description="按主题分类与八宫浏览全部 64 卦。包含卦辞、彖传、象传、爻辞。" />
      <PageTitle title="六十四卦图鉴" subtitle="主题分类 · 八宫浏览" />
      <CodexGrid hexagrams={hexagrams} defaultView="theme" />
    </PageLayout>
  )
}
