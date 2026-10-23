import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppearanceProvider } from '@/contexts/AppearanceContext'
import { AppearanceSwitcher } from '@/components/layout/AppearanceSwitcher'
import { DivinationForm } from '@/components/sections/DivinationForm'
import { ResultDisplay } from '@/components/sections/ResultDisplay'
import {
  saveRecord,
  getAllRecords,
  clearAllRecords,
  getAppearance,
} from '@/lib/storage'
import type { UserRecord } from '@/types'

vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai')
  return { ...actual, generateInterpretation: vi.fn() }
})
vi.mock('@/lib/records', () => ({ saveCloudRecord: vi.fn() }))
vi.mock('@/lib/feed', () => ({ publishPost: vi.fn() }))
vi.mock('@/lib/imageGen', async () => {
  const actual = await vi.importActual<typeof import('@/lib/imageGen')>(
    '@/lib/imageGen'
  )
  return { ...actual, downloadCardPng: vi.fn() }
})

import { generateInterpretation } from '@/lib/ai'
const mockedGenerate = vi.mocked(generateInterpretation)

const record: UserRecord = {
  id: 'switch-record-1',
  type: 'three-number',
  createdAt: 1_700_000_000_000,
  question: '该不该换一份工作？',
  numbers: [123, 456, 789],
  region: 'Asia/Shanghai',
  timezone: 'Asia/Shanghai',
  mainHexagramId: 1,
  movingLine: 1,
  changedHexagramId: 2,
  version: 1,
}

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AppearanceProvider>
        <AppearanceSwitcher />
        {ui}
      </AppearanceProvider>
    </MemoryRouter>
  )
}

/** 通过顶栏入口切到指定外观 */
function switchTo(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: /外观/ }))
  fireEvent.click(screen.getByRole('menuitemradio', { name }))
}

describe('切换外观不打断业务状态', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAllRecords()
    mockedGenerate.mockReset()
  })

  it('起卦页：已填的问题与数字在切换后仍在', () => {
    renderWithProvider(
      <DivinationForm initialNumbers={[123, 456, 789]} initialQuestion="示例问题" />
    )
    const textarea = screen.getByPlaceholderText('示例问题') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '今年要不要换工作' } })

    const first = screen.getByDisplayValue('123') as HTMLInputElement
    fireEvent.change(first, { target: { value: '234' } })

    switchTo(/朱砂档案/)

    expect(
      (screen.getByPlaceholderText('示例问题') as HTMLTextAreaElement).value
    ).toBe('今年要不要换工作')
    expect((screen.getByDisplayValue('234') as HTMLInputElement).value).toBe('234')
    expect(getAppearance()).toBe('zhusha')
  })

  it('起卦页：切换外观不新建记录，也不清空校验状态', () => {
    renderWithProvider(<DivinationForm initialNumbers={[123, null, 789]} />)
    expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()

    switchTo(/夜航观象/)

    expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()
    expect(getAllRecords()).toHaveLength(0)
  })

  it('结果页：切换外观保留卦象与记录，不重发 AI 请求', async () => {
    saveRecord(record)
    mockedGenerate.mockResolvedValue({ text: '乾为天，刚健之象。', chunks: [] })

    renderWithProvider(<ResultDisplay recordId="switch-record-1" />)
    fireEvent.click(screen.getByRole('button', { name: '卦象详解' }))
    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1))

    switchTo(/夜航观象/)

    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    expect(screen.getByText('本卦')).toBeInTheDocument()
    expect(screen.getByText('变卦')).toBeInTheDocument()
    expect(await screen.findByText(/刚健之象/)).toBeInTheDocument()
  })

  it('结果页：AI 流式进行中切换外观，内容继续累积且不重发请求', async () => {
    saveRecord(record)
    let resolveStream: ((value: { text: string; chunks: string[] }) => void) | null =
      null
    mockedGenerate.mockImplementation(
      (_input, _signal, onChunk?: (chunk: string) => void) => {
        onChunk?.('第一段：')
        return new Promise((resolve) => {
          resolveStream = resolve
        })
      }
    )

    renderWithProvider(<ResultDisplay recordId="switch-record-1" />)
    fireEvent.click(screen.getByRole('button', { name: '卦象详解' }))
    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/第一段/)).toBeInTheDocument()

    switchTo(/朱砂档案/)

    // 切换没有打断流式内容，也没有再发一次请求
    expect(screen.getByText(/第一段/)).toBeInTheDocument()
    expect(mockedGenerate).toHaveBeenCalledTimes(1)

    // 流式继续：把后续片段吐出来，内容仍然显示
    await act(async () => {
      resolveStream?.({ text: '第一段：第二段。', chunks: [] })
    })
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
  })

  it('结果页：切换外观保留「已发布到社区」状态', async () => {
    saveRecord(record)
    const { publishPost } = await import('@/lib/feed')
    const mockedPublish = vi.mocked(publishPost)
    mockedPublish.mockResolvedValue({ id: 'post-1' } as never)

    renderWithProvider(<ResultDisplay recordId="switch-record-1" />)
    fireEvent.click(screen.getByRole('button', { name: /发布到社区/i }))
    await waitFor(() => expect(mockedPublish).toHaveBeenCalledTimes(1))

    switchTo(/夜航观象/)

    // 已发布状态不因换外观而丢失，也不会重复发布
    expect(mockedPublish).toHaveBeenCalledTimes(1)
  })
})
