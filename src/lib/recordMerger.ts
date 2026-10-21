/**
 * Merge the two record sources the app can show on `/records`:
 *
 *   - `local`  — `UserRecord[]` from `src/lib/storage.ts` (localStorage)
 *   - `cloud`  — `CloudRecord[]` from `src/lib/records.ts` (Worker /api/records)
 *
 * This is deliberately a *concatenation*, not a de-duplication. The two
 * sources use unrelated id spaces (browser-generated UUIDs vs the
 * Worker's UUIDs), so matching "the same divination" across them would
 * require a content hash — deferred. Every row keeps its `source` so
 * the UI can route edit/delete back to the right backend.
 */

import type { UserRecord } from '@/types'
import type { CloudRecord, RecordSource, RecordType } from './records'

export interface RecordListItem {
  /** Which backend owns this row; determines where edits/deletes go. */
  source: RecordSource
  /** `UserRecord.id` for local, `CloudRecord.id` for cloud. */
  id: string
  type: RecordType
  /** epoch ms */
  createdAt: number
  mainHexagramId: number
  movingLine: number
  changedHexagramId: number
  question?: string
  userNote?: string
  /** True when a cached AI reading exists (badge in the list). */
  hasAiInterpretation: boolean
  /** The untouched origin object, so detail views can read every field. */
  raw: UserRecord | CloudRecord
}

/** Project a localStorage record into the shared list shape. */
export function toLocalListItem(record: UserRecord): RecordListItem {
  return {
    source: 'local',
    id: record.id,
    type: record.type,
    createdAt: record.createdAt,
    mainHexagramId: record.mainHexagramId,
    movingLine: record.movingLine,
    changedHexagramId: record.changedHexagramId,
    question: record.question,
    userNote: record.userNote,
    hasAiInterpretation: Boolean(record.aiInterpretation?.trim()),
    raw: record,
  }
}

/** Project a cloud record into the shared list shape. */
export function toCloudListItem(record: CloudRecord): RecordListItem {
  return {
    source: 'cloud',
    id: record.id,
    type: record.type,
    createdAt: record.createdAt,
    mainHexagramId: record.mainHexagramId,
    movingLine: record.movingLine,
    changedHexagramId: record.changedHexagramId,
    question: record.question ?? undefined,
    userNote: record.userNote ?? undefined,
    hasAiInterpretation: Boolean(record.aiInterpretation?.trim()),
    raw: record,
  }
}

/**
 * Merge both sources into a single newest-first list.
 *
 * Ties on `createdAt` are broken by `id` (ascending) so the order is
 * deterministic across renders — React list keys stay stable.
 */
export function mergeRecords(
  local: UserRecord[],
  cloud: CloudRecord[],
): RecordListItem[] {
  const merged = [
    ...local.map(toLocalListItem),
    ...cloud.map(toCloudListItem),
  ]
  merged.sort((a, b) => {
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return merged
}
