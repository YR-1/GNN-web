'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ArchiveRestore,
  Check,
  ChevronDown,
  Download,
  FolderArchive,
  MoreVertical,
  Search,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { AnalysisResponse, HistoryItem, UploadContentPreview } from '@/lib/types'
import { useAnalysisStore } from '@/lib/store'

type HistoryStatus = 'completed' | 'processing' | 'queued' | 'failed'
type StatusFilter = 'all' | HistoryStatus
type ShareModalState = {
  open: boolean
  email: string
  copied: boolean
  sent: boolean
}
type ToastState = {
  message: string
  tone: 'success' | 'error'
}

type HistoryRow = HistoryItem & {
  isSample?: boolean
  isArchived?: boolean
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
  { value: 'queued', label: 'Queued' },
]

const SAMPLE_HISTORY: HistoryRow[] = [
  {
    upload_id: 'sample-01',
    file_name: 'resting_state_subject_018.nii.gz',
    uploaded_at: '2026-05-11T08:45:00.000Z',
    status: 'completed',
    isSample: true,
  },
  {
    upload_id: 'sample-02',
    file_name: 'shen268_timeseries_session_a.txt',
    uploaded_at: '2026-05-10T15:30:00.000Z',
    status: 'completed',
    isSample: true,
  },
  {
    upload_id: 'sample-03',
    file_name: 'functional_connectivity_batch_07.csv',
    uploaded_at: '2026-05-09T11:20:00.000Z',
    status: 'completed',
    isSample: true,
  },
  {
    upload_id: 'sample-04',
    file_name: 'subject_memory_network.mat',
    uploaded_at: '2026-05-08T06:10:00.000Z',
    status: 'processing',
    isSample: true,
  },
]

const statusDotClass: Record<HistoryStatus, string> = {
  completed: 'bg-emerald-500',
  processing: 'bg-amber-500',
  queued: 'bg-sky-500',
  failed: 'bg-rose-500',
}

const statusBadgeClass: Record<HistoryStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
  processing: 'bg-amber-50 text-amber-700 border-amber-200/90',
  queued: 'bg-sky-50 text-sky-700 border-sky-200/90',
  failed: 'bg-rose-50 text-rose-700 border-rose-200/90',
}

function formatUploadDate(value: string): string {
  const date = new Date(value)
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeStatus(status: string): HistoryStatus {
  return ['completed', 'processing', 'queued', 'failed'].includes(status)
    ? (status as HistoryStatus)
    : 'queued'
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatExportDate(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff
  buffer[offset + 1] = (value >>> 8) & 0xff
}

function writeUint32(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff
  buffer[offset + 1] = (value >>> 8) & 0xff
  buffer[offset + 2] = (value >>> 16) & 0xff
  buffer[offset + 3] = (value >>> 24) & 0xff
}

function createZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const fileEntries = files.map((file) => {
    const nameBytes = textToBytes(file.name)
    const contentBytes = textToBytes(file.content)
    return {
      nameBytes,
      contentBytes,
      crc: crc32(contentBytes),
    }
  })

  let localSize = 0
  let centralSize = 0
  for (const entry of fileEntries) {
    localSize += 30 + entry.nameBytes.length + entry.contentBytes.length
    centralSize += 46 + entry.nameBytes.length
  }

  const endSize = 22
  const zip = new Uint8Array(localSize + centralSize + endSize)
  const centralDirectory: Array<{
    nameBytes: Uint8Array
    contentBytes: Uint8Array
    crc: number
    localOffset: number
  }> = []

  let offset = 0
  for (const entry of fileEntries) {
    const localOffset = offset
    writeUint32(zip, offset, 0x04034b50)
    writeUint16(zip, offset + 4, 20)
    writeUint16(zip, offset + 6, 0)
    writeUint16(zip, offset + 8, 0)
    writeUint16(zip, offset + 10, 0)
    writeUint16(zip, offset + 12, 0)
    writeUint32(zip, offset + 14, entry.crc)
    writeUint32(zip, offset + 18, entry.contentBytes.length)
    writeUint32(zip, offset + 22, entry.contentBytes.length)
    writeUint16(zip, offset + 26, entry.nameBytes.length)
    writeUint16(zip, offset + 28, 0)
    zip.set(entry.nameBytes, offset + 30)
    zip.set(entry.contentBytes, offset + 30 + entry.nameBytes.length)
    offset += 30 + entry.nameBytes.length + entry.contentBytes.length

    centralDirectory.push({ ...entry, localOffset })
  }

  const centralStart = offset
  for (const entry of centralDirectory) {
    writeUint32(zip, offset, 0x02014b50)
    writeUint16(zip, offset + 4, 20)
    writeUint16(zip, offset + 6, 20)
    writeUint16(zip, offset + 8, 0)
    writeUint16(zip, offset + 10, 0)
    writeUint16(zip, offset + 12, 0)
    writeUint16(zip, offset + 14, 0)
    writeUint32(zip, offset + 16, entry.crc)
    writeUint32(zip, offset + 20, entry.contentBytes.length)
    writeUint32(zip, offset + 24, entry.contentBytes.length)
    writeUint16(zip, offset + 28, entry.nameBytes.length)
    writeUint16(zip, offset + 30, 0)
    writeUint16(zip, offset + 32, 0)
    writeUint16(zip, offset + 34, 0)
    writeUint16(zip, offset + 36, 0)
    writeUint32(zip, offset + 38, 0)
    writeUint32(zip, offset + 42, entry.localOffset)
    zip.set(entry.nameBytes, offset + 46)
    offset += 46 + entry.nameBytes.length
  }

  const centralLength = offset - centralStart
  writeUint32(zip, offset, 0x06054b50)
  writeUint16(zip, offset + 4, 0)
  writeUint16(zip, offset + 6, 0)
  writeUint16(zip, offset + 8, fileEntries.length)
  writeUint16(zip, offset + 10, fileEntries.length)
  writeUint32(zip, offset + 12, centralLength)
  writeUint32(zip, offset + 16, centralStart)
  writeUint16(zip, offset + 20, 0)

  return new Blob([zip], { type: 'application/zip' })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildShareLink(uploadIds: string[]): string {
  const params = new URLSearchParams()
  params.set('uploads', uploadIds.join(','))
  return `${window.location.origin}/history/share?${params.toString()}`
}

function renderExportContent(item: HistoryRow, preview?: UploadContentPreview | null): string {
  return [
    `MindPulse Neural Data Export`,
    `File Name: ${item.file_name}`,
    `Upload ID: ${item.upload_id}`,
    `Execution ID: ${item.execution_id ?? 'N/A'}`,
    `Status: ${statusLabel(item.status)}`,
    `Uploaded At: ${item.uploaded_at}`,
    '',
    'Preview:',
    preview?.content || 'Preview unavailable. This export contains metadata only.',
  ].join('\n')
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className='fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 px-4'>
      <div className='w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl'>
        <div className='mb-5 flex items-start justify-between gap-4'>
          <h2 className='text-xl font-semibold text-slate-950'>{title}</h2>
          <button
            type='button'
            onClick={onClose}
            className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const setActiveAnalysis = useAnalysisStore((state) => state.setActiveAnalysis)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [archivedIds, setArchivedIds] = useState<string[]>([])
  const [analysisByExecution, setAnalysisByExecution] = useState<Record<string, AnalysisResponse>>({})
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [sortNewest, setSortNewest] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shareModal, setShareModal] = useState<ShareModalState>({
    open: false,
    email: '',
    copied: false,
    sent: false,
  })
  const [toast, setToast] = useState<ToastState | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [showArchivedOnly, setShowArchivedOnly] = useState(false)
  const [showSampleRows, setShowSampleRows] = useState(false)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.getHistory()
        const rows = response.data as HistoryItem[]
        setHistory(rows)
        setShowSampleRows(rows.length === 0)
      } catch (err: any) {
        if (err?.response?.status === 403 || err?.response?.status === 401) {
          router.push('/login')
          return
        }
        setError('Failed to load neural data history.')
      } finally {
        setLoading(false)
      }
    }

    void fetchHistory()
  }, [router])

  const rows = useMemo<HistoryRow[]>(() => {
    const baseRows = history.length > 0 ? history : showSampleRows ? SAMPLE_HISTORY : []
    return baseRows.map((item) => ({
      ...item,
      isArchived: archivedIds.includes(item.upload_id),
    }))
  }, [archivedIds, history, showSampleRows])

  const filteredHistory = useMemo(() => {
    let items = rows.filter((item) => Boolean(item.isArchived) === showArchivedOnly)

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter((item) => item.file_name.toLowerCase().includes(q))
    }

    if (statusFilter !== 'all') {
      items = items.filter((item) => item.status === statusFilter)
    }

    return [...items].sort((a, b) => {
      const da = new Date(a.uploaded_at).getTime()
      const db = new Date(b.uploaded_at).getTime()
      return sortNewest ? db - da : da - db
    })
  }, [rows, searchQuery, sortNewest, statusFilter])

  const selectedRows = useMemo(
    () => filteredHistory.filter((item) => selectedIds.includes(item.upload_id)),
    [filteredHistory, selectedIds]
  )

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredHistory.some((item) => item.upload_id === id)))
  }, [filteredHistory])

  const allVisibleSelected =
    filteredHistory.length > 0 && filteredHistory.every((item) => selectedIds.includes(item.upload_id))

  const shareLink = useMemo(() => {
    if (typeof window === 'undefined' || selectedIds.length === 0) return ''
    return buildShareLink(selectedIds)
  }, [selectedIds])

  const activateAnalysis = async (executionId: string) => {
    if (analysisByExecution[executionId]) {
      setActiveAnalysis(analysisByExecution[executionId])
      router.push('/predictions')
      return
    }

    setAnalysisLoading((previous) => ({ ...previous, [executionId]: true }))
    try {
      const response = await api.getAnalysis(executionId)
      const analysis = response.data as AnalysisResponse
      setAnalysisByExecution((previous) => ({ ...previous, [executionId]: analysis }))
      setActiveAnalysis(analysis)
      router.push('/predictions')
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        router.push('/login')
        return
      }
      setError('Failed to load analysis details.')
    } finally {
      setAnalysisLoading((previous) => ({ ...previous, [executionId]: false }))
    }
  }

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? [] : filteredHistory.map((item) => item.upload_id))
  }

  const toggleSelected = (uploadId: string) => {
    setSelectedIds((current) =>
      current.includes(uploadId) ? current.filter((id) => id !== uploadId) : [...current, uploadId]
    )
  }

  const handleArchiveSelected = () => {
    if (selectedRows.length === 0) return
    setArchivedIds((current) => [...new Set([...current, ...selectedRows.map((item) => item.upload_id)])])
    setSelectedIds([])
    setToast({ message: 'Items moved to archive.', tone: 'success' })
  }

  const handleRestoreSelected = () => {
    if (selectedRows.length === 0) return
    setArchivedIds((current) => current.filter((id) => !selectedRows.some((item) => item.upload_id === id)))
    setSelectedIds([])
    setToast({
      message: `${selectedRows.length} item${selectedRows.length === 1 ? '' : 's'} restored to active files.`,
      tone: 'success',
    })
  }

  const handleDeleteSelected = () => {
    if (selectedRows.length === 0) return
    const confirmed = window.confirm(
      `Delete ${selectedRows.length} neural file${selectedRows.length === 1 ? '' : 's'}? This cannot be undone.`
    )
    if (!confirmed) return

    const idsToDelete = [...selectedIds]
    const previousHistory = history
    const previousArchivedIds = archivedIds

    setError('')
    setToast(null)
    setHistory((current) => current.filter((item) => !idsToDelete.includes(item.upload_id)))
    setArchivedIds((current) => current.filter((id) => !idsToDelete.includes(id)))
    setSelectedIds([])

    const realIds = selectedRows.filter((item) => !item.isSample).map((item) => item.upload_id)
    if (realIds.length === 0) {
      setToast({
        message: `${idsToDelete.length} neural file${idsToDelete.length === 1 ? '' : 's'} removed from system.`,
        tone: 'success',
      })
      return
    }

    void api.deleteHistoryItems(realIds)
      .then(() => {
        setToast({
          message: `${idsToDelete.length} neural file${idsToDelete.length === 1 ? '' : 's'} removed from system.`,
          tone: 'success',
        })
      })
      .catch(() => {
        setHistory(previousHistory)
        setArchivedIds(previousArchivedIds)
        setToast({
          message: 'Delete failed. Restoring items to list.',
          tone: 'error',
        })
      })
  }

  const handleOpenShareModal = () => {
    if (selectedRows.length === 0) return
    setShareModal({ open: true, email: '', copied: false, sent: false })
  }

  const handleCopyShareLink = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setShareModal((current) => ({ ...current, copied: true }))
    } catch {
      setError('Unable to copy the shareable link.')
    }
  }

  const handleSendShare = () => {
    if (!shareModal.email.trim()) return
    setShareModal((current) => ({ ...current, sent: true }))
  }

  const handleDownloadSelected = async () => {
    if (selectedRows.length === 0) return
    setDownloading(true)
    setToast(null)
    setError('')

    try {
      const exportFiles = await Promise.all(
        selectedRows.map(async (item) => {
          let preview: UploadContentPreview | null = null
          if (!item.isSample) {
            try {
              const response = await api.getUploadContent(item.upload_id, { max_lines: 120, max_chars: 12000 })
              preview = response.data as UploadContentPreview
            } catch {
              preview = null
            }
          }

          return {
            name: `${sanitizeFileName(item.file_name)}.report.txt`,
            content: renderExportContent(item, preview),
          }
        })
      )

      if (exportFiles.length === 1) {
        downloadBlob(new Blob([exportFiles[0].content], { type: 'text/plain;charset=utf-8' }), exportFiles[0].name)
      } else {
        const zipBlob = createZipBlob(exportFiles)
        downloadBlob(zipBlob, `mindpulse_export_${formatExportDate()}.zip`)
      }

      setToast({
        message:
          exportFiles.length === 1
            ? 'Report downloaded.'
            : `${exportFiles.length} reports exported as a ZIP archive.`,
        tone: 'success',
      })
    } catch {
      setError('Failed to prepare the selected downloads.')
    } finally {
      setDownloading(false)
    }
  }

  const selectedCount = selectedIds.length

  return (
    <div className='surface-card-strong space-y-6'>
      <header className='space-y-2'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-semibold text-slate-950'>History</h1>
            <p className='text-sm text-slate-500'>Manage and review your neural data processing history.</p>
          </div>
          <button
            type='button'
            onClick={() => {
              setShowArchivedOnly((current) => !current)
              setSelectedIds([])
              setToast(null)
            }}
            className='inline-flex h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100'
          >
            <FolderArchive className='h-4 w-4' />
            <span>{showArchivedOnly ? 'View Active Files' : 'View Archive'}</span>
          </button>
        </div>
      </header>

      <section className='flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
        <div className='relative w-full max-w-xl'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
          <input
            type='text'
            placeholder='Search neural files...'
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className='h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
          />
        </div>

        <div className='flex items-center gap-2 self-end sm:self-auto'>
          <div className='relative'>
            <button
              type='button'
              onClick={() => setStatusMenuOpen((current) => !current)}
              className='inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100'
            >
              <SlidersHorizontal className='h-4 w-4' />
              <span>Status</span>
              {statusFilter !== 'all' ? (
                <span className='rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700'>
                  {statusLabel(statusFilter)}
                </span>
              ) : null}
              <ChevronDown className='h-4 w-4' />
            </button>

            {statusMenuOpen ? (
              <div className='absolute right-0 top-10 z-20 min-w-[190px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl'>
                {STATUS_OPTIONS.map((option) => {
                  const active = statusFilter === option.value
                  return (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => {
                        setStatusFilter(option.value)
                        setStatusMenuOpen(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        active
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{option.label}</span>
                      {active ? <Check className='h-4 w-4' /> : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <button
            type='button'
            onClick={() => setSortNewest((current) => !current)}
            className='inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100'
            title={`Current sort: ${sortNewest ? 'Newest first' : 'Oldest first'}`}
          >
            <ArrowUpDown className='h-4 w-4' />
            <span>Sort</span>
          </button>
        </div>
      </section>

      {!loading && history.length === 0 ? (
        <div className='rounded-2xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900'>
          Showing sample neural files until your first upload arrives.
        </div>
      ) : null}

      {toast ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50 text-emerald-800'
              : 'border-rose-200/80 bg-rose-50 text-rose-800'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <section className='flex flex-col gap-3 rounded-2xl border border-purple-200/80 bg-purple-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-3 text-sm font-medium text-slate-800'>
            <input
              type='checkbox'
              checked
              readOnly
              className='h-4 w-4 rounded border-slate-300 accent-indigo-600'
            />
            <span>{selectedCount} items selected</span>
          </div>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={showArchivedOnly ? handleRestoreSelected : handleArchiveSelected}
              className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-purple-200 bg-white/80 text-slate-700 transition hover:bg-slate-100'
              title={showArchivedOnly ? 'Restore selected items' : 'Archive selected items'}
            >
              {showArchivedOnly ? <ArchiveRestore className='h-4 w-4' /> : <FolderArchive className='h-4 w-4' />}
            </button>
            <button
              type='button'
              onClick={() => void handleDownloadSelected()}
              disabled={downloading}
              className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-purple-200 bg-white/80 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60'
              title='Download selected items'
            >
              <Download className='h-4 w-4' />
            </button>
            <button
              type='button'
              onClick={handleOpenShareModal}
              className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-purple-200 bg-white/80 text-slate-700 transition hover:bg-slate-100'
              title='Share selected items'
            >
              <Share2 className='h-4 w-4' />
            </button>
            <button
              type='button'
              onClick={handleDeleteSelected}
              className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white/80 text-rose-600 transition hover:bg-rose-50'
              title='Delete selected items'
            >
              <Trash2 className='h-4 w-4' />
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <div className='text-center'>
            <div className='loading-spinner mx-auto mb-3' />
            <p className='text-sm text-ink-800'>Loading neural data history...</p>
          </div>
        </div>
      ) : (
        <section className={`overflow-hidden rounded-2xl border shadow-sm ${
          showArchivedOnly
            ? 'border-purple-200/80 bg-purple-50/35'
            : 'border-slate-200/80 bg-white'
        }`}>
          {showArchivedOnly ? (
            <div className='border-b border-purple-200/70 bg-purple-50/90 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700'>
              Archived View
            </div>
          ) : null}
          <div className='overflow-x-auto'>
            <table className='min-w-full border-separate border-spacing-0'>
              <thead className={showArchivedOnly ? 'bg-purple-50/80' : 'bg-slate-50/90'}>
                <tr>
                  <th className='border-b border-slate-200 px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
                    <div className='flex items-center gap-3'>
                      <input
                        type='checkbox'
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className='h-4 w-4 rounded border-slate-300 accent-indigo-600'
                      />
                      <span>{showArchivedOnly ? 'File Name / Archived' : 'File Name'}</span>
                    </div>
                  </th>
                  <th className='border-b border-slate-200 px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
                    Upload Date
                  </th>
                  <th className='border-b border-slate-200 px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
                    Status
                  </th>
                  <th className='border-b border-slate-200 px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='px-6 py-14 text-center text-sm text-slate-500'>
                      No neural files match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => {
                    const itemStatus = normalizeStatus(item.status)
                    const isSelected = selectedIds.includes(item.upload_id)
                    const canOpenAnalysis = item.status === 'completed' && Boolean(item.execution_id) && !item.isSample
                    const isAnalysisLoading = item.execution_id ? analysisLoading[item.execution_id] : false

                    return (
                      <tr key={item.upload_id} className={item.isArchived ? 'bg-purple-50/35' : ''}>
                        <td className={`px-6 py-5 ${item.isArchived ? 'border-b border-purple-100' : 'border-b border-slate-100'}`}>
                          <div className='flex items-center gap-3'>
                            <input
                              type='checkbox'
                              checked={isSelected}
                              onChange={() => toggleSelected(item.upload_id)}
                              className='h-4 w-4 rounded border-slate-300 accent-indigo-600'
                            />

                            <div className='min-w-0'>
                              {canOpenAnalysis ? (
                                <button
                                  type='button'
                                  onClick={() => void activateAnalysis(item.execution_id!)}
                                  disabled={isAnalysisLoading}
                                  className='truncate text-left text-sm font-semibold text-slate-900 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-400'
                                >
                                  {isAnalysisLoading ? 'Opening analysis...' : item.file_name}
                                </button>
                              ) : (
                                <p className='truncate text-sm font-semibold text-slate-900'>{item.file_name}</p>
                              )}

                              <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500'>
                                {item.execution_id ? <span className='mono-data'>ID: {item.execution_id}</span> : null}
                                {item.isSample ? <span>Sample dataset</span> : null}
                                {item.isArchived ? (
                                  <span className='rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-700'>
                                    Archived
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className={`px-6 py-5 text-sm text-slate-600 ${item.isArchived ? 'border-b border-purple-100' : 'border-b border-slate-100'}`}>
                          {formatUploadDate(item.uploaded_at)}
                        </td>

                        <td className={`px-6 py-5 ${item.isArchived ? 'border-b border-purple-100' : 'border-b border-slate-100'}`}>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusBadgeClass[itemStatus]}`}>
                            <span className={`h-2 w-2 rounded-full ${statusDotClass[itemStatus]}`} />
                            {statusLabel(item.status)}
                          </span>
                        </td>

                        <td className={`px-6 py-5 text-right ${item.isArchived ? 'border-b border-purple-100' : 'border-b border-slate-100'}`}>
                          <button
                            type='button'
                            onClick={() => {
                              if (item.status === 'completed' && item.execution_id && !item.isSample) {
                                void activateAnalysis(item.execution_id)
                                return
                              }
                              if (item.status === 'failed' && item.execution_id) {
                                void api.retryAnalysis(item.execution_id)
                                  .then(() => router.push(`/analysis/${item.execution_id}/loading`))
                                  .catch((retryErr: any) => {
                                    setError(retryErr?.response?.data?.detail || 'Retry failed.')
                                  })
                              }
                            }}
                            className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                            title={
                              item.status === 'completed' && item.execution_id && !item.isSample
                                ? 'Open analysis'
                                : item.status === 'failed' && item.execution_id
                                  ? 'Retry analysis'
                                  : 'More actions'
                            }
                          >
                            <MoreVertical className='h-4 w-4' />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && history.length === 0 ? (
            <div className='border-t border-slate-100 bg-slate-50/80 px-6 py-4 text-sm text-slate-600'>
              Upload your first dataset from the{' '}
              <Link href='/upload' className='font-semibold text-indigo-700 hover:text-indigo-800'>
                upload page
              </Link>{' '}
              to replace the sample records with your own history.
            </div>
          ) : null}
        </section>
      )}

      {shareModal.open ? (
        <ModalShell title='Share selected reports' onClose={() => setShareModal((current) => ({ ...current, open: false }))}>
          <div className='space-y-4'>
            <p className='text-sm text-slate-600'>
              Generate a shareable link and optionally notify a collaborator by email.
            </p>

            <div className='rounded-2xl border border-slate-200 bg-slate-50 p-3'>
              <p className='mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'>Share Link</p>
              <p className='break-all text-sm text-slate-800'>{shareLink}</p>
            </div>

            <div className='space-y-2'>
              <label htmlFor='share-email' className='text-sm font-medium text-slate-700'>
                Collaborator Email
              </label>
              <input
                id='share-email'
                type='email'
                value={shareModal.email}
                onChange={(event) =>
                  setShareModal((current) => ({ ...current, email: event.target.value, sent: false }))
                }
                placeholder='researcher@lab.org'
                className='h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
              />
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <button
                type='button'
                onClick={() => void handleCopyShareLink()}
                className='inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100'
              >
                {shareModal.copied ? 'Copied' : 'Copy link'}
              </button>
              <button
                type='button'
                onClick={handleSendShare}
                className='inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100'
              >
                Send invite
              </button>
            </div>

            {shareModal.sent ? (
              <p className='text-sm text-emerald-700'>
                Share invitation prepared for {shareModal.email}.
              </p>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

    </div>
  )
}
