import { useState } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { HOME_VIEWS } from '@/components/appearances/registry'
import { useAppearance } from '@/contexts/AppearanceContext'
import { getTodayHexagram } from '@/lib/daily'
import { getHexagramById } from '@/lib/divination'
import { SEO } from '@/lib/seo'
import type { HexagramId } from '@/types'
import '@/styles/home.css'

const READING_THEMES = [
  { label: '万物之始', ids: [1, 2, 3, 4] },
  { label: '进退有时', ids: [5, 9, 11, 12] },
  { label: '修身处世', ids: [10, 15, 24, 61] },
] as const

export default function Home() {
  const [activeTheme, setActiveTheme] = useState(0)
  const { appearance } = useAppearance()
  const HomeView = HOME_VIEWS[appearance]

  // 今日卦境按本地日期计算：真实卦象、真实日期与真实时区
  const daily = getTodayHexagram()
  const main = getHexagramById(daily.mainHexagramId as HexagramId)
  const changed = getHexagramById(daily.changedHexagramId as HexagramId)
  const dateLabel = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : ''

  if (!main || !changed) return null

  return (
    <PageLayout rootClassName="studio-page home-page" className="home-content">
      <SEO
        title="今日卦境"
        description="于变化之中，寻一份从容。每日一卦、三数起卦、六十四卦图鉴，在易象阁读懂周易，观照日常。"
      />

      <HomeView
        main={main}
        changed={changed}
        movingLine={daily.movingLine}
        dateLabel={dateLabel}
        timeZone={timeZone}
        readingThemes={READING_THEMES}
        activeThemeIndex={activeTheme}
        onThemeChange={setActiveTheme}
      />
    </PageLayout>
  )
}
