'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { AnalysisResponse, HistoryItem } from '@/lib/types'
import { useAnalysisStore } from '@/lib/store'
import { PredictionReport } from '@/components/analysis/PredictionReport'

export default function PredictionsPage() {
  const router = useRouter()
  const activeAnalysis = useAnalysisStore((state) => state.active_analysis)
  const latestAnalysis = useAnalysisStore((state) => state.latest_analysis)
  const setActiveAnalysis = useAnalysisStore((state) => state.setActiveAnalysis)
  const setLatestAnalysis = useAnalysisStore((state) => state.setLatestAnalysis)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchLatestAnalysis = async () => {
      try {
        if (activeAnalysis?.status === 'completed' && activeAnalysis.results) {
          return
        }

        const historyResponse = await api.getHistory()
        const latestCompleted = (historyResponse.data as HistoryItem[])
          .filter((item) => item.status === 'completed' && item.execution_id)
          .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0]

        if (!latestCompleted?.execution_id) {
          setLatestAnalysis(null)
          return
        }

        if (
          latestAnalysis?.execution_id === latestCompleted.execution_id &&
          latestAnalysis.status === 'completed' &&
          latestAnalysis.results
        ) {
          setActiveAnalysis(latestAnalysis)
          return
        }

        const analysisResponse = await api.getAnalysis(latestCompleted.execution_id)
        const analysis = analysisResponse.data as AnalysisResponse
        setLatestAnalysis(analysis)
        setActiveAnalysis(analysis)
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.push('/login')
          return
        }
        setError('Failed to load the latest prediction results.')
      } finally {
        setLoading(false)
      }
    }

    void fetchLatestAnalysis()
  }, [activeAnalysis, latestAnalysis, router, setActiveAnalysis, setLatestAnalysis])

  return (
    <div className='page-container'>
      {error && (
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className='text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading latest prediction results...</p>
        </div>
      ) : !activeAnalysis ? (
        <div className='text-center py-12'>
          <h1 className='section-title'>Predictions</h1>
          <p className='section-subtitle mt-2'>This tab shows the current active analysis.</p>
          <p className='text-sm text-ink-700 mt-4'>No completed analyses are available yet.</p>
          <div className='mt-5 flex justify-center gap-3'>
            <Link href='/upload' className='btn-primary'>
              Upload data
            </Link>
            <Link href='/history' className='btn-secondary'>
              Open history
            </Link>
          </div>
        </div>
      ) : (
        <PredictionReport analysis={activeAnalysis} heading='Predictions' />
      )}
    </div>
  )
}
