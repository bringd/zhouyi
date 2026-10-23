/**
 * 测试支架：把受控的灵数输入框接到真实的稳定层（`useNumberBoxesState`）上，
 * 让用例与生产代码走同一条数据流——
 * 「原始文本 / 合法值 / 取数器状态」都由稳定层持有。
 */
import { useState } from 'react'
import { NumberBox } from '@/components/ui/NumberBox'
import { NumberBoxWithRandomizer } from '@/components/ui/NumberBoxRandomizer'
import { useNumberBoxesState } from '@/components/ui/NumberBoxRandomizer/state'

export function NumberBoxHarness({
  initial = '',
  text: controlled,
  label = 'test',
  description,
  onTextChange,
}: {
  initial?: string
  /** 传入时走受控模式（父组件可以随时把文本改回去） */
  text?: string
  label?: string
  description?: string
  onTextChange?: (text: string) => void
}) {
  const [local, setLocal] = useState(initial)
  const text = controlled ?? local
  return (
    <NumberBox
      text={text}
      onTextChange={(next) => {
        setLocal(next)
        onTextChange?.(next)
      }}
      label={label}
      description={description}
    />
  )
}

export function RandomizerHarness({
  label = '第一灵数',
  initial,
}: {
  label?: string
  initial?: number | null
}) {
  const { fields, setText, start, stop } = useNumberBoxesState(
    initial === undefined ? undefined : [initial, null, null]
  )
  const field = fields[0]
  return (
    <div>
      <NumberBoxWithRandomizer
        field={field}
        onTextChange={(text) => setText(0, text)}
        onStart={() => start(0)}
        onStop={() => stop(0)}
        label={label}
      />
      <span data-testid="value">
        {field.value === null ? 'null' : field.value}
      </span>
      <span data-testid="text">{field.text}</span>
    </div>
  )
}
