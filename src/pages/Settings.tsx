import { PageLayout } from '@/components/layout/PageLayout'
import { SEO } from '@/lib/seo'

export default function Settings() {
  return (
    <PageLayout>
      <SEO title="设置" description="应用设置。" />
      <h1 className="text-display-md font-display text-center text-ink tracking-widest mb-2">设置</h1>
      <div className="text-center py-12 p-6 bg-rice border-2 border-june-bronze/30 rounded-md max-w-md mx-auto">
        <p className="text-ink-light font-body">设置功能即将推出</p>
        <p className="text-xs text-ink-light/60 font-body mt-2">当前 AI 解读由服务方统一承担，无需个人 API Key</p>
      </div>
    </PageLayout>
  )
}
