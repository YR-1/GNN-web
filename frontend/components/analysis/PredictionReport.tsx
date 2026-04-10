'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AnalysisResponse, CorrelationResults } from '@/lib/types'
import { SCORE_REGISTRY } from '@/lib/score-registry'
import { simulateScore, SimulatedScoreResult } from '@/lib/score-simulator'
import { BoldTimeSeries } from '@/components/charts/BoldTimeSeries'

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

interface PredictionReportProps {
  analysis: AnalysisResponse
  heading?: string
  executionIdLabel?: boolean
}

export function PredictionReport({
  analysis,
  heading = 'Prediction Report',
  executionIdLabel = true,
}: PredictionReportProps) {
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(SCORE_REGISTRY[0]?.id ?? null)

  const results = analysis.results as CorrelationResults | undefined

  const modelPredictions = useMemo(() => {
    const byId: Record<string, SimulatedScoreResult> = {}
    const predictions = results?.predicted_scores ?? []

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
  }, [results?.predicted_scores])

  const predictedValues = useMemo(() => {
    if (!results?.correlation_matrix) return {}
    const values: Record<string, SimulatedScoreResult> = {}
    for (const score of SCORE_REGISTRY) {
      values[score.id] =
        modelPredictions[score.id] ??
        simulateScore(score, results.correlation_matrix)
    }
    return values
  }, [results?.correlation_matrix, modelPredictions])

  const selectedScore = useMemo(
    () => SCORE_REGISTRY.find((s) => s.id === selectedScoreId) ?? null,
    [selectedScoreId]
  )

  if (analysis.status !== 'completed') {
    return (
      <div className='status-banner status-banner-warning'>
        <p>This execution is currently {analysis.status}. Return when processing is complete.</p>
      </div>
    )
  }

  if (!results) {
    return (
      <div className='status-banner status-banner-warning'>
        <p>Execution completed but no results were returned.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <header>
        <h2 className='section-title'>{heading}</h2>
        <p className='section-subtitle'>
          File: <span className='mono-data'>{results.file_name}</span>
        </p>
        {executionIdLabel && (
          <p className='section-subtitle'>
            Execution ID: <span className='mono-data'>{analysis.execution_id}</span>
          </p>
        )}
      </header>

      {results.prediction_errors && results.prediction_errors.length > 0 && (
        <div className='status-banner status-banner-warning'>
          <p>
            Some model predictions are unavailable: {results.prediction_errors.join(' | ')}
          </p>
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <CorrelationMatrix data={results} fileName={results.file_name} />

        <BrainVisualizationPanel
          predictedValues={predictedValues}
          correlationMatrix={results.correlation_matrix}
          connectomeHtml={results.nilearn_connectome_html}
          selectedScoreId={selectedScoreId}
          onSelectScore={setSelectedScoreId}
        />

        <BoldTimeSeries timeSeries={results.time_series} />

        <StaticBrainViews
          markersPngBase64={results.nilearn_markers_png_base64}
          scoreShortName={selectedScore?.shortName ?? ''}
        />
      </div>
    </div>
  )
}
