'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { CorrelationResults } from '@/lib/types'
import { BoldTimeSeries } from '@/components/charts/BoldTimeSeries'
import { AnalysisSelector } from '@/components/analysis/AnalysisSelector'

const CorrelationMatrix = dynamic(() => import('@/components/CorrelationMatrix'), {
  ssr: false,
  loading: () => (
    <div className='surface-card text-center py-12'>
      <div className='loading-spinner mx-auto mb-3' />
      <p className='text-ink-800'>Loading chart...</p>
    </div>
  ),
})

interface AnalysisResponse {
  status: string
  execution_id: string
  results?: CorrelationResults
}

interface MatrixSummary {
  mean: number
  median: number
  min: number
  max: number
  positiveRatio: number
}

const summarizeMatrix = (matrix: number[][]): MatrixSummary | null => {
  const values: number[] = []
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex]
    for (let columnIndex = rowIndex + 1; columnIndex < row.length; columnIndex += 1) {
      const value = row[columnIndex]
      if (Number.isFinite(value)) {
        values.push(value)
      }
    }
  }

  if (!values.length) return null

  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint]

  const sum = values.reduce((total, current) => total + current, 0)
  const positiveCount = values.filter((value) => value > 0).length

  return {
    mean: sum / values.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    positiveRatio: (positiveCount / values.length) * 100,
  }
}

function StatisticsContent() {
  const searchParams = useSearchParams()
  const executionId = searchParams.get('executionId')
  const router = useRouter()

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!executionId) {
      setLoading(false)
      return
    }

    const fetchAnalysis = async () => {
      try {
        const response = await api.getAnalysis(executionId)
        setAnalysis(response.data)
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.push('/login')
          return
        }
        setError('Failed to load analysis results.')
      } finally {
        setLoading(false)
      }
    }

    void fetchAnalysis()
  }, [executionId, router])

  const summary = useMemo(() => {
    if (!analysis?.results?.correlation_matrix) return null
    return summarizeMatrix(analysis.results.correlation_matrix)
  }, [analysis])

  if (!executionId) {
    return (
      <AnalysisSelector
        title='Statistics'
        subtitle='Select a completed analysis to view its statistics.'
        routePath='/statistics'
      />
    )
  }

  return (
    <div className='page-container'>
      <header>
        <h1 className='section-title'>Statistics</h1>
        <p className='section-subtitle'>
          Execution ID: <span className='mono-data'>{executionId}</span>
        </p>
      </header>

      {error && (
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className='text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading statistics...</p>
        </div>
      ) : !analysis ? null : analysis.status !== 'completed' ? (
        <div className='status-banner status-banner-warning'>
          <p>This execution is currently {analysis.status}. Return when processing is complete.</p>
        </div>
      ) : !analysis.results ? (
        <div className='status-banner status-banner-warning'>
          <p>Execution completed but no statistics were returned.</p>
        </div>
      ) : (
        <>
          {summary && (
            <div>
              <p className='font-semibold text-ink-950 mb-4'>Summary Statistics</p>
              <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4'>
                <article className='metric-card'>
                  <p className='metric-label'>Mean correlation</p>
                  <p className='metric-value'>{summary.mean.toFixed(3)}</p>
                </article>
                <article className='metric-card'>
                  <p className='metric-label'>Median correlation</p>
                  <p className='metric-value'>{summary.median.toFixed(3)}</p>
                </article>
                <article className='metric-card'>
                  <p className='metric-label'>Minimum</p>
                  <p className='metric-value'>{summary.min.toFixed(3)}</p>
                </article>
                <article className='metric-card'>
                  <p className='metric-label'>Maximum</p>
                  <p className='metric-value'>{summary.max.toFixed(3)}</p>
                </article>
                <article className='metric-card'>
                  <p className='metric-label'>Positive ratio</p>
                  <p className='metric-value'>{summary.positiveRatio.toFixed(1)}%</p>
                </article>
              </div>
            </div>
          )}

          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-white/40'>
            <div>
              <p className='font-semibold text-ink-950'>Predicted Scores</p>
              <p className='text-sm text-ink-700'>
                View cognitive and emotional score predictions derived from this connectivity data.
              </p>
            </div>
            <Link href={`/predictions?executionId=${executionId}`} className='btn-primary shrink-0'>
              View predictions
            </Link>
          </div>

          <div>
            <p className='font-semibold text-ink-950 mb-3'>BOLD Time Series</p>
            <p className='text-sm text-ink-700 mb-3'>
              Simulated fMRI BOLD signal fluctuations for 5 representative ROIs over {Math.max(analysis.results.n_timepoints, 100)} timepoints (TR = 2 s).
            </p>
            <BoldTimeSeries nTimepoints={analysis.results.n_timepoints} />
          </div>

          <div>
            <p className='font-semibold text-ink-950 mb-3'>Correlation Matrix</p>
            <CorrelationMatrix data={analysis.results} fileName={analysis.results.file_name} />
          </div>
        </>
      )}
    </div>
  )
}

export default function StatisticsPage() {
  return (
    <Suspense
      fallback={
        <div className='surface-card text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading statistics page...</p>
        </div>
      }
    >
      <StatisticsContent />
    </Suspense>
  )
}
