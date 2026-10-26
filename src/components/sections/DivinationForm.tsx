import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAST_VIEWS } from '@/components/appearances/registry'
import { useAppearance } from '@/contexts/AppearanceContext'
import { divination } from '@/lib/divination'
import { saveRecord } from '@/lib/storage'
import { buildNumberError } from '@/lib/validation'
import { getRandomSampleQuestion } from '@/lib/sampleQuestions'
import { useNumberBoxesState } from '@/components/ui/NumberBoxRandomizer/state'

type NumberPosition = 0 | 1 | 2

export interface DivinationFormProps {
  initialNumbers?: [number | null, number | null, number | null]
  initialQuestion?: string
  onResult?: (recordId: string) => void
}

/**
 * 三数起卦表单容器。
 *
 * 这一层是**稳定层**：切换外观时下面会换成另一套视图组件
 * （青岚 / 朱砂 / 夜航），但本组件本身不会卸载，
 * 因此原始输入文本、取数滚动状态、问题内容都活在这里，
 * 换外观只是换皮，不丢用户输入。
 */
export function DivinationForm({
  initialNumbers,
  initialQuestion = '',
  onResult,
}: DivinationFormProps) {
  const [defaultQuestion] = useState(() =>
    initialQuestion.trim() ? initialQuestion : getRandomSampleQuestion()
  )
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { appearance } = useAppearance()
  const CastView = CAST_VIEWS[appearance]

  // 灵数的原始文本与取数控制器都放在这一层，切外观不会丢
  const { fields, setText, start, stop } = useNumberBoxesState(initialNumbers)

  const numbers = fields.map((field) => field.value) as [
    number | null,
    number | null,
    number | null,
  ]
  const selectedCount = numbers.filter((number) => number !== null).length
  const isRolling = fields.some(
    (field) => field.randomState.kind === 'rolling'
  )
  const isValid = selectedCount === 3 && !isRolling

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    // 提交校验：取数未完成时不允许起卦（按钮虽已禁用，这里做第二道防线）
    if (!isValid) {
      setError(
        isRolling
          ? '请先停止取数，再启卦。'
          : (buildNumberError(numbers) ?? '起卦失败，请重试')
      )
      return
    }
    try {
      const [a, b, c] = numbers as [number, number, number]
      const result = divination(a, b, c)
      const recordId = crypto.randomUUID()
      const region =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : ''
      const saved = saveRecord({
        id: recordId,
        type: 'three-number',
        createdAt: Date.now(),
        question: question.trim() ? question : defaultQuestion,
        numbers: [a, b, c],
        region,
        timezone: region,
        mainHexagramId: result.mainHexagramId,
        movingLine: result.movingLine,
        changedHexagramId: result.changedHexagramId,
        version: 1,
      })
      if (!saved) {
        setError('本地记录保存失败，请检查浏览器存储空间或隐私设置后重试。')
        return
      }
      if (onResult) onResult(recordId)
      else navigate(`/result/${recordId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '起卦失败，请重试')
    }
  }

  return (
    <CastView
      question={question}
      onQuestionChange={setQuestion}
      questionPlaceholder={defaultQuestion}
      numberFields={fields}
      onNumberTextChange={(position: NumberPosition, text: string) =>
        setText(position, text)
      }
      onRandomStart={start}
      onRandomStop={stop}
      error={error}
      isValid={isValid}
      selectedCount={selectedCount}
      isRolling={isRolling}
      onSubmit={handleSubmit}
    />
  )
}
