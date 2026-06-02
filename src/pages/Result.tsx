import { useParams } from 'react-router-dom'
import { ResultDisplay } from '@/components/sections/ResultDisplay'
import { SEO } from '@/lib/seo'

export default function Result() {
  const { id } = useParams<{ id: string }>()
  if (!id) {
    return (
      <div className="text-center py-12">
        <SEO title="起卦结果" description="查看你的起卦结果与 AI 解读。" />
        <p className="text-ink-light font-body">无效的起卦记录</p>
      </div>
    )
  }
  return (
    <>
      <SEO title="起卦结果" description="查看你的起卦结果与 AI 解读。" />
      <ResultDisplay recordId={id} />
    </>
  )
}
