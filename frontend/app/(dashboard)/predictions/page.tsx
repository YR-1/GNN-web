'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { CorrelationResults } from '@/lib/types'
import { SCORE_REGISTRY } from '@/lib/score-registry'
import { simulateScore, SimulatedScoreResult } from '@/lib/score-simulator'
import { BoldTimeSeries } from '@/components/charts/BoldTimeSeries'
import { AnalysisSelector } from '@/components/analysis/AnalysisSelector'

const BrainVisualizationPanel = dynamic(() => import('@/components/BrainVisualizationPanel'), { ssr: false })
const StaticBrainViews = dynamic(() => import('@/components/StaticBrainViews'), { ssr: false })
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

interface AnalysisResponse {
  status: string
  execution_id: string
  results?: CorrelationResults
}

/* ---------- Main Content ---------- */

function PredictionsContent() {
  const searchParams = useSearchParams()
  const executionId = searchParams.get('executionId')
  const initialScore = searchParams.get('score')
  const router = useRouter()

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(
    initialScore ?? SCORE_REGISTRY[0]?.id ?? null
  )

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

  const modelPredictions = useMemo(() => {
    const byId: Record<string, SimulatedScoreResult> = {}
    const predictions = analysis?.results?.predicted_scores ?? []

    const normalizeScoreId = (value: string) =>
      value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

    const alias: Record<string, string> = { emotion_score: 'emotion_recognition' }

    for (const prediction of predictions) {
      const rawId = prediction.score_id
      if (!rawId) continue
      const normalizedId = alias[normalizeScoreId(rawId)] ?? normalizeScoreId(rawId)
      const value = Number(prediction.value)
      if (!Number.isFinite(value)) continue

      const ci95Lower = Number.isFinite(prediction.ci95_lower as number) ? Number(prediction.ci95_lower) : value
      const ci95Upper = Number.isFinite(prediction.ci95_upper as number) ? Number(prediction.ci95_upper) : value

      byId[normalizedId] = { value, ci95Lower, ci95Upper }
    }

    return byId
  }, [analysis?.results?.predicted_scores])

  const predictedValues = useMemo(() => {
    if (!analysis?.results?.correlation_matrix) return {}
    const values: Record<string, SimulatedScoreResult> = {}
    for (const score of SCORE_REGISTRY) {
      values[score.id] =
        modelPredictions[score.id] ??
        simulateScore(score, analysis.results.correlation_matrix)
    }
    return values
  }, [analysis?.results?.correlation_matrix, modelPredictions])

  const selectedScore = useMemo(
    () => SCORE_REGISTRY.find((s) => s.id === selectedScoreId) ?? null,
    [selectedScoreId]
  )

  if (!executionId) {
    return (
      <AnalysisSelector
        title='Predictions'
        subtitle='Select a completed analysis to view cognitive and emotional score predictions.'
        routePath='/predictions'
      />
    )
  }

  return (
    <div className='page-container'>
      <header>
        <h1 className='section-title'>Predictions</h1>
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
          <p className='text-ink-800'>Loading predictions...</p>
        </div>
      ) : !analysis ? null : analysis.status !== 'completed' ? (
        <div className='status-banner status-banner-warning'>
          <p>This execution is currently {analysis.status}. Return when processing is complete.</p>
        </div>
      ) : !analysis.results ? (
        <div className='status-banner status-banner-warning'>
          <p>Execution completed but no results were returned.</p>
        </div>
      ) : (
        <>
          {analysis.results.prediction_errors && analysis.results.prediction_errors.length > 0 && (
            <div className='status-banner status-banner-warning'>
              <p>
                Some model predictions are unavailable: {analysis.results.prediction_errors.join(' | ')}
              </p>
            </div>
          )}

          {/* 2x2 Grid Layout */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            {/* Top-Left: Correlation Matrix */}
            <CorrelationMatrix data={analysis.results} fileName={analysis.results.file_name} />

            {/* Top-Right: Score selector + 3D Brain */}
            <BrainVisualizationPanel
              predictedValues={predictedValues}
              correlationMatrix={analysis.results.correlation_matrix}
              connectomeHtml={analysis.results.nilearn_connectome_html}
              selectedScoreId={selectedScoreId}
              onSelectScore={setSelectedScoreId}
            />

            {/* Bottom-Left: BOLD Time Series */}
            <BoldTimeSeries nTimepoints={analysis.results.n_timepoints} />

            {/* Bottom-Right: 3 Static Views */}
            <StaticBrainViews
              markersPngBase64={analysis.results.nilearn_markers_png_base64}
              scoreShortName={selectedScore?.shortName ?? ''}
            />
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- Page Export ---------- */

export default function PredictionsPage() {
  return (
    <Suspense
      fallback={
        <div className='surface-card text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading predictions page...</p>
        </div>
      }
    >
      <PredictionsContent />
    </Suspense>
  )
}
