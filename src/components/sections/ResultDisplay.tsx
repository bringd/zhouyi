import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { RESULT_VIEWS } from '@/components/appearances/registry'
import { useAppearance } from '@/contexts/AppearanceContext'
import { getHexagramById } from '@/lib/divination'
import { getRecord, saveRecord } from '@/lib/storage'
import { generateInterpretation, AIError } from '@/lib/ai'
import { downloadCardPng, cardDataFromIds } from '@/lib/imageGen'
import { publishPost } from '@/lib/feed'
import { saveCloudRecord } from '@/lib/records'
import type { UserRecord, HexagramId } from '@/types'

export interface ResultDisplayProps {
  recordId: string
}

export function ResultDisplay({ recordId }: ResultDisplayProps) {
  const [record, setRecord] = useState<UserRecord | null>(() =>
    getRecord(recordId)
  )
  const [toast, setToast] = useState<string | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)
  const [savedCloudId, setSavedCloudId] = useState<string | null>(null)
  const [saveRecordBusy, setSaveRecordBusy] = useState(false)
  const [aiText, setAiText] = useState<string | null>(
    record?.aiInterpretation ?? null
  )
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSaved, setAiSaved] = useState(Boolean(record?.aiInterpretation?.trim()))
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const { appearance } = useAppearance()
  const ResultView = RESULT_VIEWS[appearance]

  if (!record) {
    return (
      <div className="result-empty">
        <BookOpen size={31} strokeWidth={1.2} aria-hidden="true" />
        <h1>未找到该起卦记录</h1>
        <p>这条记录可能已被清理，或保存在其他设备中。</p>
        <Link to="/divination">
          <Button>重新起卦</Button>
        </Link>
      </div>
    )
  }

  const main = getHexagramById(record.mainHexagramId as HexagramId)
  const changed = getHexagramById(record.changedHexagramId as HexagramId)
  if (!main || !changed) {
    return <div className="text-center py-12 text-ink-light">卦象数据缺失</div>
  }

  const timestampText = new Date(record.createdAt).toLocaleString('zh-CN')
  const aiSummarySource = record.aiInterpretation?.trim()
    ? record.aiInterpretation.trim().slice(0, 280)
    : undefined

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const handleInterpret = async () => {
    if (aiStatus === 'loading') return
    setAiError(null)
    setStorageWarning(null)
    setAiStatus('loading')
    setAiText('')
    try {
      let accumulated = ''
      const result = await generateInterpretation(
        {
          mainHexagram: main,
          changedHexagram: changed,
          movingLine: record.movingLine as 1 | 2 | 3 | 4 | 5 | 6,
          question: record.question,
        },
        null,
        (chunk) => {
          accumulated += chunk
          setAiText(accumulated)
        }
      )
      setAiText(result.text)
      setAiStatus('idle')
      const updated: UserRecord = { ...record, aiInterpretation: result.text }
      setRecord(updated)
      const saved = saveRecord(updated)
      setAiSaved(saved)
      if (!saved) {
        setStorageWarning('解读已生成，但未能保存到浏览器，请先下载卦象卡或收藏到云端。')
      }
    } catch (err) {
      let msg: string
      if (err instanceof AIError) {
        switch (err.code) {
          case 'no-api-key':
          case 'missing-api-key':
            msg = err.message || '请先在设置中填写 API Key'
            break
          case 'invalid-api-key':
          case 'unauthorized':
            msg = err.message || 'API Key 无效或已过期'
            break
          case 'rate-limit':
            msg = err.message || '请求过于频繁，请稍后再试'
            break
          case 'timeout':
            msg = '请求超时'
            break
          case 'server-error':
            msg = 'AI 服务暂时不可用，请稍后再试'
            break
          case 'content-filtered':
          case 'input-filtered':
            msg = err.message || '内容触发了安全过滤，请调整提问后重试'
            break
          case 'quota-exceeded':
            msg = err.message || 'API 配额已用完'
            break
          case 'upstream-error':
          case 'token-limit':
            msg = err.message || '上游服务返回错误，请稍后再试'
            break
          case 'network-error':
          default:
            msg = err.message || '网络错误，请检查网络后重试'
        }
        // eslint-disable-next-line no-console
        console.error('[ai]', err.code, err.message, err.cause)
      } else {
        msg =
          err instanceof Error ? err.message || '卦象详解失败' : '卦象详解失败'
      }
      setAiError(msg)
      setAiStatus('error')
    }
  }

  const handleDownload = async () => {
    setDownloadBusy(true)
    try {
      const data = cardDataFromIds({
        mainId: main.id,
        changedId: changed.id,
        movingLine: record.movingLine,
        aiSummary: aiSummarySource,
        userNote: record.userNote ?? undefined,
        timestamp: timestampText,
      })
      if (data) {
        await downloadCardPng(data, `易象阁-起卦-${main.name}.png`)
        showToast('已下载卦象卡')
      }
    } catch (err) {
      console.error('[ResultDisplay] download failed:', err)
      showToast('下载失败')
    } finally {
      setDownloadBusy(false)
    }
  }

  const handleShare = async () => {
    if (publishedId || publishBusy) return
    setPublishBusy(true)
    try {
      const res = await publishPost({
        mainHexagramId: main.id,
        changedHexagramId: changed.id,
        movingLine: record.movingLine,
        question: record.question,
        aiSummary: aiSummarySource,
      })
      setPublishedId(res.id)
      showToast('已发布到社区卦册')
    } catch (err) {
      console.error('[ResultDisplay] publish failed:', err)
      showToast(err instanceof Error ? err.message : '发布失败')
    } finally {
      setPublishBusy(false)
    }
  }

  /**
   * Explicit "save to the cloud 卦册" action.
   *
   * localStorage already holds this record (DivinationForm wrote it at
   * divination time), so this button only mirrors it to the Worker. A
   * failure therefore degrades to "local only" rather than losing data.
   */
  const handleSaveToRecords = async () => {
    if (savedCloudId || saveRecordBusy) return
    setSaveRecordBusy(true)
    try {
      const saved = await saveCloudRecord({
        type: record.type,
        question: record.question,
        numbers: record.numbers,
        region: record.region,
        timezone: record.timezone,
        mainHexagramId: record.mainHexagramId,
        movingLine: record.movingLine,
        changedHexagramId: record.changedHexagramId,
        aiInterpretation: record.aiInterpretation,
        userNote: record.userNote,
      })
      setSavedCloudId(saved.id)
      showToast('已收藏到云端卦册')
    } catch (err) {
      console.error('[ResultDisplay] save to records failed:', err)
      showToast('云端暂不可用，记录已存本地')
    } finally {
      setSaveRecordBusy(false)
    }
  }

  const hasCache = aiSaved && Boolean(record.aiInterpretation?.trim())
  const isLoading = aiStatus === 'loading'
  const isError = aiStatus === 'error'
  const hasText = Boolean(aiText?.trim())
  return (
    <ResultView
      record={record}
      main={main}
      changed={changed}
      movingLine={record.movingLine as 1 | 2 | 3 | 4 | 5 | 6}
      timestampText={timestampText}
      aiText={aiText}
      aiStatus={aiStatus}
      aiError={aiError}
      storageWarning={storageWarning}
      hasCache={hasCache}
      isLoading={isLoading}
      isError={isError}
      hasText={hasText}
      toast={toast}
      downloadBusy={downloadBusy}
      publishBusy={publishBusy}
      publishedId={publishedId}
      savedCloudId={savedCloudId}
      saveRecordBusy={saveRecordBusy}
      aiSummarySource={aiSummarySource}
      onInterpret={handleInterpret}
      onDownload={handleDownload}
      onShare={handleShare}
      onSaveToRecords={handleSaveToRecords}
    />
  )
}
