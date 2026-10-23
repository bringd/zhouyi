import { useParams, Link } from 'react-router-dom'
import { ResultDisplay } from '@/components/sections/ResultDisplay'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { SEO } from '@/lib/seo'
import '@/styles/result.css'

export default function Result() {
  const { id } = useParams<{ id: string }>()
  if (!id) {
    return (
      <PageLayout
        rootClassName="studio-page result-page"
        className="studio-content"
      >
        <SEO title="起卦结果" description="查看你的起卦结果与卦象详解。" />
        <div className="result-empty">
          <h1>无效的起卦记录</h1>
          <Link to="/divination">
            <Button>前往起卦</Button>
          </Link>
        </div>
      </PageLayout>
    )
  }
  return (
    <PageLayout
      rootClassName="studio-page result-page"
      className="studio-content"
    >
      <SEO title="起卦结果" description="查看你的起卦结果与卦象详解。" />
      <ResultDisplay key={id} recordId={id} />
    </PageLayout>
  )
}
