'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { CorrelationResults } from '@/lib/types'

interface HistoryItem {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

interface AnalysisResponse {
  execution_id: string
  status: string
  results?: CorrelationResults & { error?: string }
}

interface UploadContentPreview {
  upload_id: string
  file_name: string
  content: string
  truncated: boolean
  lines_returned: number
}

const statusPillClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'status-pill-completed'
    case 'processing':
      return 'status-pill-processing'
    case 'queued':
      return 'status-pill-queued'
    case 'failed':
      return 'status-pill-failed'
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-300/70'
  }
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysisByExecution, setAnalysisByExecution] = useState<Record<string, AnalysisResponse>>({})
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({})
  const [contentByUpload, setContentByUpload] = useState<Record<string, UploadContentPreview>>({})
  const [contentLoading, setContentLoading] = useState<Record<string, boolean>>({})
  const [contentError, setContentError] = useState<Record<string, string>>({})
  const [showContent, setShowContent] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortNewest, setSortNewest] = useState(true)
  const router = useRouter()

  const STATUS_FILTERS = ['all', 'completed', 'processing', 'queued', 'failed'] as const

  const filteredHistory = useMemo(() => {
    let items = history
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter((item) => item.file_name.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      items = items.filter((item) => item.status === statusFilter)
    }
    const sorted = [...items].sort((a, b) => {
      const da = new Date(a.uploaded_at).getTime()
      const db = new Date(b.uploaded_at).getTime()
      return sortNewest ? db - da : da - db
    })
    return sorted
  }, [history, searchQuery, statusFilter, sortNewest])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.getHistory()
        setHistory(response.data)
      } catch (err: any) {
        if (err?.response?.status === 403 || err?.response?.status === 401) {
          router.push('/login')
          return
        }
        setError('Failed to load upload history.')
      } finally {
        setLoading(false)
      }
    }

    void fetchHistory()
  }, [router])

  const fetchAnalysis = async (executionId: string) => {
    if (analysisByExecution[executionId]) return

    setAnalysisLoading((previous) => ({ ...previous, [executionId]: true }))
    try {
      const response = await api.getAnalysis(executionId)
      setAnalysisByExecution((previous) => ({
        ...previous,
        [executionId]: response.data as AnalysisResponse,
      }))
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        router.push('/login')
      }
    } finally {
      setAnalysisLoading((previous) => ({ ...previous, [executionId]: false }))
    }
  }

  const fetchUploadContent = async (uploadId: string) => {
    if (contentByUpload[uploadId]) return

    setContentLoading((previous) => ({ ...previous, [uploadId]: true }))
    setContentError((previous) => ({ ...previous, [uploadId]: '' }))
    try {
      const response = await api.getUploadContent(uploadId, { max_lines: 200, max_chars: 20000 })
      setContentByUpload((previous) => ({
        ...previous,
        [uploadId]: response.data,
      }))
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        router.push('/login')
        return
      }
      setContentError((previous) => ({ ...previous, [uploadId]: 'Failed to load file preview.' }))
    } finally {
      setContentLoading((previous) => ({ ...previous, [uploadId]: false }))
    }
  }

  const toggleExpanded = (uploadId: string, executionId?: string) => {
    const nextExpanded = expandedId === uploadId ? null : uploadId
    setExpandedId(nextExpanded)

    if (nextExpanded && executionId) {
      void fetchAnalysis(executionId)
    }
  }

  const toggleContent = (uploadId: string) => {
    setShowContent((previous) => {
      const nextVisible = !previous[uploadId]
      if (nextVisible && !contentByUpload[uploadId]) {
        void fetchUploadContent(uploadId)
      }
      return { ...previous, [uploadId]: nextVisible }
    })
  }

  return (
    <div className='page-container'>
      <header>
        <h1 className='section-title'>Upload History</h1>
        <p className='section-subtitle'>Review each upload, execution status, and analysis output.</p>
      </header>

      {!loading && history.length > 0 && (
        <div className='grid grid-cols-1 sm:grid-cols-[minmax(220px,1fr)_180px_170px] gap-3 items-end'>
          <div className='space-y-1'>
            <label htmlFor='history-search' className='text-xs text-ink-700'>Search</label>
            <input
              id='history-search'
              type='text'
              placeholder='Search by file name...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='input-field'
            />
          </div>

          <div className='space-y-1'>
            <label htmlFor='history-status-filter' className='text-xs text-ink-700'>Status</label>
            <select
              id='history-status-filter'
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='input-field appearance-none'
            >
              {STATUS_FILTERS.map((sf) => (
                <option key={sf} value={sf}>
                  {sf === 'all' ? 'All statuses' : sf.charAt(0).toUpperCase() + sf.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className='space-y-1'>
            <label htmlFor='history-sort-order' className='text-xs text-ink-700'>Sort</label>
            <select
              id='history-sort-order'
              value={sortNewest ? 'newest' : 'oldest'}
              onChange={(e) => setSortNewest(e.target.value === 'newest')}
              className='input-field appearance-none'
            >
              <option value='newest'>Newest first</option>
              <option value='oldest'>Oldest first</option>
            </select>
          </div>
        </div>
      )}

      {error && (
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className='text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading history...</p>
        </div>
      ) : history.length === 0 ? (
        <div className='text-center py-12'>
          <p className='text-ink-900 font-semibold'>No uploads yet.</p>
          <p className='text-sm text-ink-700 mt-2'>Upload your first file to start analysis.</p>
          <Link href='/upload' className='btn-primary mt-5'>
            Go to upload
          </Link>
        </div>
      ) : (
        <div className='space-y-4'>
          {filteredHistory.length === 0 && (
            <div className='text-center py-8'>
              <p className='text-ink-700 text-sm'>No uploads match your filters.</p>
            </div>
          )}
          {filteredHistory.map((item) => {
            const isExpanded = expandedId === item.upload_id
            const analysis = item.execution_id ? analysisByExecution[item.execution_id] : undefined
            const result = analysis?.results
            const isAnalysisLoading = item.execution_id ? analysisLoading[item.execution_id] : false
            const isPreviewVisible = showContent[item.upload_id]
            const preview = contentByUpload[item.upload_id]

            return (
              <article key={item.upload_id} className='rounded-xl border border-brand-400/20 bg-white/50 p-4 overflow-hidden'>
                <button
                  type='button'
                  onClick={() => toggleExpanded(item.upload_id, item.execution_id)}
                  className='w-full text-left'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='font-semibold text-ink-950 truncate'>{item.file_name}</p>
                      <p className='text-xs text-ink-700 mt-1'>
                        Uploaded {new Date(item.uploaded_at).toLocaleDateString()} at{' '}
                        {new Date(item.uploaded_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(item.status)}`}>
                        {item.status}
                      </span>
                      <span className='text-ink-700 text-sm'>{isExpanded ? 'Hide' : 'View'}</span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className='mt-4 border-t border-brand-400/20 pt-4 space-y-4'>
                    {item.status === 'completed' && item.execution_id ? (
                      isAnalysisLoading ? (
                        <div className='status-banner status-banner-info'>
                          <p>Loading analysis details...</p>
                        </div>
                      ) : result ? (
                        <div className='space-y-4'>
                          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                            <div className='metric-card'>
                              <p className='metric-label'>ROIs</p>
                              <p className='metric-value'>{result.n_rois}</p>
                            </div>
                            <div className='metric-card'>
                              <p className='metric-label'>Timepoints</p>
                              <p className='metric-value'>{result.n_timepoints}</p>
                            </div>
                          </div>

                          <div className='flex flex-wrap gap-2'>
                            <Link href={`/analysis/${item.execution_id}`} className='btn-primary'>
                              Open analysis output
                            </Link>
                            <Link href={`/statistics?executionId=${item.execution_id}`} className='btn-secondary'>
                              View statistics
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className='status-banner status-banner-warning'>
                          <p>Completed run has no analysis payload.</p>
                        </div>
                      )
                    ) : item.status === 'processing' || item.status === 'queued' ? (
                      <div className='status-banner status-banner-info'>
                        <p>{item.status === 'processing' ? 'Analysis is currently running.' : 'Analysis is queued.'}</p>
                      </div>
                    ) : (
                      <div className='space-y-3'>
                        <div className='status-banner status-banner-error'>
                          <p>{analysis?.results?.error ?? 'Analysis failed for this upload.'}</p>
                        </div>
                        {item.execution_id && (
                          <button
                            type='button'
                            className='btn-secondary'
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await api.retryAnalysis(item.execution_id!)
                                router.push(`/analysis/${item.execution_id}/loading`)
                              } catch (retryErr: any) {
                                setError(retryErr?.response?.data?.detail || 'Retry failed.')
                              }
                            }}
                          >
                            Retry analysis
                          </button>
                        )}
                      </div>
                    )}

                    <div className='rounded-xl border border-brand-400/20 bg-white/75 p-4'>
                      <div className='flex items-center justify-between gap-2'>
                        <p className='font-semibold text-ink-900'>Input file preview</p>
                        <button type='button' className='btn-secondary' onClick={() => toggleContent(item.upload_id)}>
                          {isPreviewVisible ? 'Hide preview' : 'Show preview'}
                        </button>
                      </div>

                      {isPreviewVisible && (
                        <div className='mt-3'>
                          {contentLoading[item.upload_id] && (
                            <div className='status-banner status-banner-info'>
                              <p>Loading file preview...</p>
                            </div>
                          )}

                          {!contentLoading[item.upload_id] && contentError[item.upload_id] && (
                            <div className='status-banner status-banner-error'>
                              <p>{contentError[item.upload_id]}</p>
                            </div>
                          )}

                          {!contentLoading[item.upload_id] && preview && (
                            <div>
                              <pre className='mono-data whitespace-pre-wrap rounded-xl border border-brand-400/20 bg-white p-3 max-h-72 overflow-auto text-ink-900'>
                                {preview.content}
                              </pre>
                              {preview.truncated && (
                                <p className='mt-2 text-xs text-ink-700'>
                                  Preview truncated to {preview.lines_returned} lines.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
