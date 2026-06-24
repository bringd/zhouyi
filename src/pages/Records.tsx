import { PageLayout } from '@/components/layout/PageLayout'
import { PageTitle } from '@/components/ui/PageTitle'
import { SEO } from '@/lib/seo'
import { EmptyScroll } from '@/components/ui/EmptyScroll'

export default function Records() {
  return (
    <PageLayout>
      <SEO title="我的卦册" description="查看你的历史起卦记录。" />
      <PageTitle title="我的卦册" subtitle="保存你的每一次起卦" />
      <EmptyScroll
        message="卦册尚无记录。"
        hint="在「三数起卦」问一卦，所得之卦将自动收录于此。"
        cta={{ to: '/divination', label: '前往起卦' }}
      />
    </PageLayout>
  )
}
