import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import Result from '@/pages/Result'
import { clearAllRecords, saveRecord } from '@/lib/storage'
import type { UserRecord } from '@/types'

const firstRecord: UserRecord = {
  id: 'first-result',
  type: 'three-number',
  createdAt: 1792627200000,
  question: '第一条记录的问题',
  numbers: [129, 257, 601],
  region: 'Asia/Shanghai',
  timezone: 'Asia/Shanghai',
  mainHexagramId: 1,
  movingLine: 1,
  changedHexagramId: 44,
  aiInterpretation: '## 卦象概要\n第一条记录的解读',
  version: 1,
}

beforeEach(() => clearAllRecords())

describe('Result page', () => {
  it('opens another result with its own question and interpretation state', async () => {
    saveRecord(firstRecord)
    saveRecord({
      ...firstRecord,
      id: 'second-result',
      question: '第二条记录的问题',
      mainHexagramId: 2,
      changedHexagramId: 24,
      aiInterpretation: undefined,
    })
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/result/first-result']}>
          <Link to="/result/second-result">打开另一条记录</Link>
          <Routes>
            <Route path="/result/:id" element={<Result />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    )
    expect(screen.getByText('第一条记录的问题')).toBeInTheDocument()
    expect(screen.getByText('第一条记录的解读')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '打开另一条记录' }))
    expect(await screen.findByText('第二条记录的问题')).toBeInTheDocument()
    expect(screen.queryByText('第一条记录的问题')).not.toBeInTheDocument()
    expect(screen.queryByText('第一条记录的解读')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '卦象详解' })).toBeInTheDocument()
  })
})
