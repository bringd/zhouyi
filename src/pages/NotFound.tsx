import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { SEO } from '@/lib/seo'

export default function NotFound() {
  return (
    <PageLayout>
      <SEO title="未找到页面" description="您访问的页面不存在。" />
      <div className="text-center py-16">
        <div className="text-6xl font-display text-june-bronze mb-4">四〇四</div>
        <h1 className="text-2xl font-display text-ink mb-4 tracking-widest">此路不通</h1>
        <p className="text-ink-light font-body mb-8">所寻之页面，似已不在易象之中。</p>
        <Link to="/">
          <Button>返回首页</Button>
        </Link>
      </div>
    </PageLayout>
  )
}
