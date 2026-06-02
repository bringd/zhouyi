import { useParams } from 'react-router-dom'
import { ResultDisplay } from '@/components/sections/ResultDisplay'

export default function Result() {
  const { id } = useParams<{ id: string }>()
  if (!id) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-light font-body">无效的起卦记录</p>
      </div>
    )
  }
  return <ResultDisplay recordId={id} />
}
