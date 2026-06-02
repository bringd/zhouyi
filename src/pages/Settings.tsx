import { PageLayout } from '@/components/layout/PageLayout'

export default function Settings() {
  return (
    <PageLayout>
      <h1 className="text-display-md font-display text-center text-ink tracking-widest mb-2">设置</h1>
      <div className="text-center py-12 p-6 bg-rice border-2 border-june-bronze/30 rounded-md">
        <p className="text-ink-light font-body">AI Key 管理功能将在后续任务中实现（Task 39）</p>
      </div>
    </PageLayout>
  )
}
