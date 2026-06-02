import { useMemo } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { CodexGrid } from '@/components/sections/CodexGrid'
import hexagramsData from '@/data/hexagrams.json'
import type { Hexagram } from '@/types'

export default function Codex() {
  const hexagrams = useMemo(() => hexagramsData as Hexagram[], [])
  return (
    <PageLayout>
      <h1 className="text-display-md font-display text-center text-ink tracking-widest mb-2">六十四卦图鉴</h1>
      <p className="text-center text-sm text-ink-light font-body mb-8">主题分类 · 八宫浏览</p>
      <CodexGrid hexagrams={hexagrams} defaultView="theme" />
    </PageLayout>
  )
}
