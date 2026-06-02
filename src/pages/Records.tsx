import { PageLayout } from '@/components/layout/PageLayout'

export default function Records() {
  return (
    <PageLayout>
      <h1 className="text-display-md font-display text-center text-ink tracking-widest mb-2">我的卦册</h1>
      <p className="text-center text-ink-light font-body mb-8">保存你的每一次起卦</p>
      <div className="text-center py-12 p-6 bg-rice border-2 border-june-bronze/30 rounded-md">
        <p className="text-ink-light font-body">记录列表功能将在后续任务中实现（Task 38）</p>
      </div>
    </PageLayout>
  )
}
