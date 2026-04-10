'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { AnalysisResponse, HistoryItem } from '@/lib/types'
import { useAnalysisStore } from '@/lib/store'

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
  const router = useRouter()
  const setActiveAnalysis = useAnalysisStore((state) => state.setActiveAnalysis)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [analysisByExecution, setAnalysisByExecution] = useState<Record<string, AnalysisResponse>>({})
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortNewest, setSortNewest] = useState(true)

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
    return [...items].sort((a, b) => {
      const da = new Date(a.uploaded_at).getTime()
      const db = new Date(b.uploaded_at).getTime()
      return sortNewest ? db - da : da - db
    })
  }, [history, searchQuery, sortNewest, statusFilter])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.getHistory()
        setHistory(response.data as HistoryItem[])
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

  return (
    <div className='page-container'>
      <header>
        <h1 className='section-title'>Upload History</h1>
        <p className='section-subtitle'>Browse all current and previous uploads, then open any completed run in the Prediction tab.</p>
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
            const isAnalysisLoading = item.execution_id ? analysisLoading[item.execution_id] : false

            return (
              <article key={item.upload_id} className='rounded-xl border border-brand-400/20 bg-white/50 p-4 overflow-hidden'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='font-semibold text-ink-950 truncate'>{item.file_name}</p>
                    <p className='text-xs text-ink-700 mt-1'>
                      Uploaded {new Date(item.uploaded_at).toLocaleDateString()} at{' '}
                      {new Date(item.uploaded_at).toLocaleTimeString()}
                    </p>
                    {item.execution_id && (
                      <p className='text-xs text-ink-700 mt-1'>
                        Execution ID: <span className='mono-data'>{item.execution_id}</span>
                      </p>
                    )}
                  </div>

                  <div className='flex flex-col items-end gap-2 shrink-0'>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(item.status)}`}>
                      {item.status}
                    </span>

                    {item.status === 'completed' && item.execution_id ? (
                      <button
                        type='button'
                        className='btn-primary'
                        disabled={isAnalysisLoading}
                        onClick={() => void activateAnalysis(item.execution_id!)}
                      >
                        {isAnalysisLoading ? 'Loading...' : 'View Analysis'}
                      </button>
                    ) : item.status === 'failed' && item.execution_id ? (
                      <button
                        type='button'
                        className='btn-secondary'
                        onClick={async () => {
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
                    ) : (
                      <span className='text-xs text-ink-700'>
                        {item.status === 'processing' ? 'Processing...' : item.status === 'queued' ? 'Queued' : 'Unavailable'}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
