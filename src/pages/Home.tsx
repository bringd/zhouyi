import { PageLayout } from '@/components/layout/PageLayout'
import { DailyHero } from '@/components/sections/DailyHero'
import { SEO } from '@/lib/seo'

export default function Home() {
  return (
    <PageLayout>
      <SEO title="今日卦境" description="每日一卦，启迪当下。展示今日卦象、本卦、变卦与解读。" />
      <DailyHero />
    </PageLayout>
  )
}
