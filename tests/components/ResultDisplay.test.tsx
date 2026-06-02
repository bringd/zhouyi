import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResultDisplay } from '@/components/sections/ResultDisplay'
import { saveRecord, clearAllRecords } from '@/lib/storage'
import type { UserRecord } from '@/types'

// Mock the AI module to avoid actual network calls
vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai')
  return {
    ...actual,
    generateInterpretation: vi.fn(),
  }
})

import { generateInterpretation } from '@/lib/ai'
const mockedGenerate = generateInterpretation as unknown as ReturnType<typeof vi.fn>

const baseRecord: UserRecord = {
  id: 'test-record-1',
  type: 'three-number',
  createdAt: 1_700_000_000_000,
  question: 'Should I make this decision?',
  numbers: [123, 456, 789],
  region: 'Asia/Shanghai',
  timezone: 'Asia/Shanghai',
  mainHexagramId: 1,
  movingLine: 1,
  changedHexagramId: 2,
}

describe('ResultDisplay', () => {
  beforeEach(() => {
    clearAllRecords()
    mockedGenerate.mockReset()
  })

  it('renders not-found message when record does not exist', () => {
    render(
      <MemoryRouter>
        <ResultDisplay recordId="non-existent-id" />
      </MemoryRouter>
    )
    expect(screen.getByText('未找到该起卦记录')).toBeInTheDocument()
    expect(screen.getByText('重新起卦')).toBeInTheDocument()
  })

  it('renders the question, header, and main hexagram name', () => {
    saveRecord(baseRecord)
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>
    )
    expect(screen.getByText('卦 象 已 成')).toBeInTheDocument()
    expect(screen.getByText('Should I make this decision?')).toBeInTheDocument()
    // 乾为天 should appear (from id=1, which is 乾为天)
    expect(screen.getAllByText('乾为天').length).toBeGreaterThan(0)
  })

  it('renders the AI 解读 button initially', () => {
    saveRecord(baseRecord)
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: '开始 AI 解读' })).toBeInTheDocument()
  })

  it('shows error when API key is missing', async () => {
    saveRecord(baseRecord)
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 解读' }))
    expect(await screen.findByText('请先在设置中配置 Claude API Key')).toBeInTheDocument()
  })

  it('renders twin spread with 本卦/变卦 labels', () => {
    saveRecord(baseRecord)
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>
    )
    expect(screen.getByText('本卦')).toBeInTheDocument()
    expect(screen.getByText('变卦')).toBeInTheDocument()
  })

  it('renders the action buttons', () => {
    saveRecord(baseRecord)
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: '再起一卦' })).toBeInTheDocument()
    expect(screen.getByText('回到首页')).toBeInTheDocument()
    expect(screen.getByText('查看本卦详情')).toBeInTheDocument()
  })

  it('renders existing AI interpretation if present on record', () => {
    saveRecord({ ...baseRecord, aiInterpretation: 'pre-cached interpretation' })
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>
    )
    expect(screen.getByText('pre-cached interpretation')).toBeInTheDocument()
    // AI button should NOT be present since aiText is set
    expect(screen.queryByRole('button', { name: '开始 AI 解读' })).not.toBeInTheDocument()
  })
})
