import { useParams, Link } from 'react-router-dom'
import { ResultDisplay } from '@/components/sections/ResultDisplay'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { SEO } from '@/lib/seo'

export default function Result() {
  const { id } = useParams<{ id: string }>()
  if (!id) {
    return (
      <PageLayout>
        <SEO title="起卦结果" description="查看你的起卦结果与 AI 解读。" />
        <div className="text-center py-12">
          <p className="text-ink-light font-body mb-4">无效的起卦记录</p>
          <Link to="/divination">
            <Button>前往起卦</Button>
          </Link>
        </div>
      </PageLayout>
    )
  }
  return (
    <PageLayout>
      <SEO title="起卦结果" description="查看你的起卦结果与 AI 解读。" />
      <ResultDisplay recordId={id} />
    </PageLayout>
  )
}
