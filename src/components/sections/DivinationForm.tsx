import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { QuestionInput } from '@/components/ui/QuestionInput'
import { NumberBox } from '@/components/ui/NumberBox'
import { divination } from '@/lib/divination'
import { saveRecord } from '@/lib/storage'
import { readQuota, consumeQuota, resetQuota } from '@/lib/quota'
import { markRegistered } from '@/lib/auth'
import { SmsModal } from '@/components/auth/SmsModal'
import { cn } from '@/utils/cn'

export interface DivinationFormProps {
  initialNumbers?: [number | null, number | null, number | null]
  initialQuestion?: string
  onResult?: (recordId: string) => void
  className?: string
}

export function DivinationForm({ initialNumbers, initialQuestion = '', onResult, className }: DivinationFormProps) {
  const [question, setQuestion] = useState(initialQuestion)
  const [numbers, setNumbers] = useState<[number | null, number | null, number | null]>(initialNumbers ?? [null, null, null])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSmsModal, setShowSmsModal] = useState(false)
  const navigate = useNavigate()
  const isValid = numbers.every((n) => n !== null && n >= 100 && n <= 999)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValid) {
      setError('请输入三个有效的三位数（100-999）')
      return
    }
    const quota = readQuota()
    if (quota.mode === 'guest' && quota.remaining === 0) {
      setShowSmsModal(true)
      return
    }
    setSubmitting(true)
    try {
      const [a, b, c] = numbers as [number, number, number]
      const result = divination(a, b, c)
      const recordId = crypto.randomUUID()
      const region = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
      saveRecord({
        id: recordId, type: 'three-number', createdAt: Date.now(), question: question || undefined,
        numbers: [a, b, c], region, timezone: region, mainHexagramId: result.mainHexagramId,
        movingLine: result.movingLine, changedHexagramId: result.changedHexagramId, version: 1,
      })
      consumeQuota()
      if (onResult) onResult(recordId)
      else navigate(`/result/${recordId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '起卦失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.form onSubmit={handleSubmit} className={cn('max-w-2xl mx-auto p-6 bg-rice border-2 border-june-bronze rounded-md', className)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-center font-display text-2xl text-ink tracking-widest mb-2">三 数 起 卦</h2>
        <p className="text-center text-sm text-ink-light font-body mb-6">问于心，发于数，止于卦</p>
        <QuestionInput value={question} onChange={setQuestion} className="mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          <NumberBox value={numbers[0]} onChange={(v) => setNumbers([v, numbers[1], numbers[2]])} label="第一灵数" description="下卦" />
          <NumberBox value={numbers[1]} onChange={(v) => setNumbers([numbers[0], v, numbers[2]])} label="第二灵数" description="上卦" />
          <NumberBox value={numbers[2]} onChange={(v) => setNumbers([numbers[0], numbers[1], v])} label="第三灵数" description="动爻" />
        </div>
        {error && <div className="text-june-red text-sm text-center font-body mb-4">{error}</div>}
        <div className="flex justify-center">
          <Button type="submit" size="lg" loading={submitting} disabled={!isValid}>
            {submitting ? '起卦中…' : '启 卦'}
          </Button>
        </div>
        <p className="text-xs text-ink-light/60 text-center font-body mt-6 max-w-md mx-auto">本结果用于周易文化研究与自我反思，不作为现实决策的唯一依据。</p>
      </motion.form>
      {showSmsModal && <SmsModal onClose={() => setShowSmsModal(false)} onSuccess={(phone) => { markRegistered(phone); resetQuota(); setShowSmsModal(false) }} />}
    </>
  )
}
