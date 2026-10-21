import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Records from '@/pages/Records'
import { clearAllRecords, saveRecord, getAllRecords } from '@/lib/storage'
import { listCloudRecords, updateCloudRecordNote, deleteCloudRecord } from '@/lib/records'
import type { CloudRecord } from '@/lib/records'
import type { UserRecord } from '@/types'

vi.mock('@/lib/records', () => ({
  listCloudRecords: vi.fn(),
  updateCloudRecordNote: vi.fn(),
  deleteCloudRecord: vi.fn(),
}))

const mockedList = listCloudRecords as unknown as ReturnType<typeof vi.fn>
const mockedUpdateNote = updateCloudRecordNote as unknown as ReturnType<
  typeof vi.fn
>
const mockedDelete = deleteCloudRecord as unknown as ReturnType<typeof vi.fn>

function localRecord(over: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'local-1',
    type: 'three-number',
    createdAt: Date.parse('2026-10-01T10:00:00.000Z'),
    question: '本地的问题',
    numbers: [111, 222, 333],
    region: 'Asia/Shanghai',
    timezone: 'Asia/Shanghai',
    mainHexagramId: 1,
    movingLine: 2,
    changedHexagramId: 2,
    version: 1,
    ...over,
  }
}

function cloudRecord(over: Partial<CloudRecord> = {}): CloudRecord {
  return {
    id: 'cloud-1',
    type: 'three-number',
    question: '云端的问题',
    numbers: [444, 555, 666],
    region: 'Asia/Shanghai',
    timezone: 'Asia/Shanghai',
    mainHexagramId: 3,
    movingLine: 4,
    changedHexagramId: 4,
    aiInterpretation: null,
    userNote: '旧云端备注',
    createdAt: Date.parse('2026-10-05T10:00:00.000Z'),
    updatedAt: Date.parse('2026-10-05T10:00:00.000Z'),
    ...over,
  }
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/records']}>
        <Records />
      </MemoryRouter>
    </HelmetProvider>,
  )
}

describe('Records page', () => {
  beforeEach(() => {
    clearAllRecords()
    mockedList.mockReset()
    mockedUpdateNote.mockReset()
    mockedDelete.mockReset()
  })

  it('shows the empty scroll when both sources are empty', async () => {
    mockedList.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('卦册尚无记录。')).toBeInTheDocument()
    expect(screen.queryByText('云端卦册加载失败', { exact: false })).not.toBeInTheDocument()
  })

  it('renders a cloud record with a 云端 badge and shows its detail on click', async () => {
    mockedList.mockResolvedValue([cloudRecord()])
    renderPage()

    expect(await screen.findByText('水雷屯')).toBeInTheDocument()
    // Left rail short name for the main hexagram.
    expect(screen.getByText('屯')).toBeInTheDocument()
    expect(screen.getByText('云端')).toBeInTheDocument()

    fireEvent.click(screen.getByText('水雷屯').closest('button')!)

    expect(await screen.findByText('← 返回卦册')).toBeInTheDocument()
    expect(screen.getByText('云端记录')).toBeInTheDocument()
    expect(screen.getByText('「云端的问题」')).toBeInTheDocument()
  })

  it('renders local records from localStorage with a 本地 badge', async () => {
    saveRecord(localRecord())
    mockedList.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('乾为天')).toBeInTheDocument()
    expect(screen.getByText('本地')).toBeInTheDocument()
    expect(screen.getByText('「本地的问题」')).toBeInTheDocument()
  })

  it('keeps the local half usable when the cloud request fails', async () => {
    saveRecord(localRecord())
    mockedList.mockRejectedValue(new Error('HTTP 500 Internal Server Error'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500')
    expect(await screen.findByText('乾为天')).toBeInTheDocument()
    expect(screen.getByText('云端暂不可用')).toBeInTheDocument()
  })

  it('displays the cached AI interpretation in the detail view', async () => {
    mockedList.mockResolvedValue([
      cloudRecord({ aiInterpretation: '## 卦象概要\n草木初生' }),
    ])
    renderPage()

    fireEvent.click((await screen.findByText('水雷屯')).closest('button')!)

    expect(await screen.findByText('AI 解 读')).toBeInTheDocument()
    expect(screen.getByText(/草木初生/)).toBeInTheDocument()
  })

  it('saves a note on a cloud record through the Worker API', async () => {
    mockedList.mockResolvedValue([cloudRecord()])
    mockedUpdateNote.mockResolvedValue(cloudRecord({ userNote: '新的云端备注' }))
    renderPage()

    fireEvent.click((await screen.findByText('水雷屯')).closest('button')!)

    const textarea = await screen.findByLabelText('我 的 备 注')
    fireEvent.change(textarea, { target: { value: '新的云端备注' } })
    fireEvent.click(screen.getByRole('button', { name: '保存备注' }))

    await waitFor(() => {
      expect(mockedUpdateNote).toHaveBeenCalledWith('cloud-1', '新的云端备注')
    })
    expect(await screen.findByText('备注已保存')).toBeInTheDocument()
  })

  it('surfaces a cloud note-save failure without losing the page', async () => {
    mockedList.mockResolvedValue([cloudRecord()])
    mockedUpdateNote.mockRejectedValue(new Error('HTTP 404 Not Found'))
    renderPage()

    fireEvent.click((await screen.findByText('水雷屯')).closest('button')!)
    fireEvent.change(await screen.findByLabelText('我 的 备 注'), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存备注' }))

    expect(await screen.findByText('HTTP 404 Not Found')).toBeInTheDocument()
    expect(screen.getByText('← 返回卦册')).toBeInTheDocument()
  })

  it('saves a note on a local record into localStorage', async () => {
    saveRecord(localRecord())
    mockedList.mockResolvedValue([])
    renderPage()

    fireEvent.click((await screen.findByText('乾为天')).closest('button')!)
    fireEvent.change(await screen.findByLabelText('我 的 备 注'), {
      target: { value: '本地备注改过了' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存备注' }))

    await waitFor(() => {
      expect(getAllRecords()[0].userNote).toBe('本地备注改过了')
    })
    expect(mockedUpdateNote).not.toHaveBeenCalled()
  })

  it('deletes a cloud record after an inline confirmation', async () => {
    mockedList.mockResolvedValue([cloudRecord()])
    mockedDelete.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click((await screen.findByText('水雷屯')).closest('button')!)

    fireEvent.click(await screen.findByRole('button', { name: '删除记录' }))
    // First click only arms the confirmation; nothing is deleted yet.
    expect(mockedDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认删除？' }))

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('cloud-1'))
    // Back to the list, and the row is gone.
    await waitFor(() => {
      expect(screen.queryByText('← 返回卦册')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('水雷屯')).not.toBeInTheDocument()
  })

  it('deletes a local record from localStorage', async () => {
    saveRecord(localRecord())
    mockedList.mockResolvedValue([])
    renderPage()

    fireEvent.click((await screen.findByText('乾为天')).closest('button')!)
    fireEvent.click(await screen.findByRole('button', { name: '删除记录' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除？' }))

    await waitFor(() => expect(getAllRecords()).toHaveLength(0))
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('cancels a pending delete without removing anything', async () => {
    mockedList.mockResolvedValue([cloudRecord()])
    renderPage()

    fireEvent.click((await screen.findByText('水雷屯')).closest('button')!)
    fireEvent.click(await screen.findByRole('button', { name: '删除记录' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByRole('button', { name: '确认删除？' })).not.toBeInTheDocument()
    expect(mockedDelete).not.toHaveBeenCalled()
  })
})
