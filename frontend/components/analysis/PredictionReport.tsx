'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { AnalysisResponse, CorrelationResults } from '@/lib/types'
import { SCORE_REGISTRY } from '@/lib/score-registry'
import { simulateScore, SimulatedScoreResult } from '@/lib/score-simulator'
import { BoldTimeSeries } from '@/components/charts/BoldTimeSeries'
import { API_BASE_URL } from '@/lib/api'
import { useAnalysisStore } from '@/lib/store'

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

const PRIMARY_VISUAL_SCORE_ID = 'listsort_ageadj'
const FALLBACK_IMPORTANCE_BRAIN_PATHS: Record<string, string> = {
  listsort_ageadj: '/static/brain_plots/listsort_importance_3d.html',
  pmat: '/static/brain_plots/pmat_importance_3d.html',
  picseq: '/static/brain_plots/picseq_importance_3d.html',
  emotsupp_unadj: '/static/brain_plots/emotsupp_importance_3d.html',
  psqi: '/static/brain_plots/psqi_importance_3d.html',
}
const FALLBACK_IMPORTANCE_STATIC_BRAIN_PATHS: Record<string, string> = {
  listsort_ageadj: '/static/brain_plots/listsort_importance_4panel.png',
  pmat: '/static/brain_plots/pmat_importance_4panel.png',
  picseq: '/static/brain_plots/picseq_importance_4panel.png',
  emotsupp_unadj: '/static/brain_plots/emotsupp_importance_4panel.png',
  psqi: '/static/brain_plots/psqi_importance_4panel.png',
}

interface PredictionReportProps {
  analysis: AnalysisResponse
  heading?: string
  executionIdLabel?: boolean
}

function normalizeScoreId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function toCanonicalScoreId(value: string): string {
  const alias: Record<string, string> = {
    emotion_score: 'emotsupp_unadj',
    emotion: 'emotsupp_unadj',
    attention: 'sustained_attention',
    sleep_quality: 'psqi',
    sleep: 'psqi',
    psqi_score: 'psqi',
    wm: 'listsort_ageadj',
    working_memory: 'listsort_ageadj',
    listsort: 'listsort_ageadj',
    list_sort: 'listsort_ageadj',
    listsort_age_adj: 'listsort_ageadj',
    list_sort_age_adj: 'listsort_ageadj',
  }

  const normalizedId = normalizeScoreId(value)
  return alias[normalizedId] ?? normalizedId
}

function toBackendUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null
  const normalizeBrainPlotPath = (value: string): string => {
    if (value.startsWith('/brain_plots/')) {
      return `/static${value}`
    }
    return value
  }

  const appendBrainPlotCacheBuster = (value: string): string => {
    if (!/\/static\/brain_plots\/.+\.(?:html|png)(?:\?.*)?$/i.test(value)) {
      return value
    }
    if (/[?&]v=\d+/i.test(value)) {
      return value
    }
    const separator = value.includes('?') ? '&' : '?'
    return `${value}${separator}v=${Date.now()}`
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return appendBrainPlotCacheBuster(pathOrUrl)
  }

  const normalizedPath = appendBrainPlotCacheBuster(normalizeBrainPlotPath(pathOrUrl))
  return `${API_BASE_URL.replace(/\/$/, '')}/${normalizedPath.replace(/^\//, '')}`
}

export function PredictionReport({
  analysis,
  heading = 'Prediction Report',
  executionIdLabel = true,
}: PredictionReportProps) {
  const selectedScoreId = useAnalysisStore((state) => state.selected_prediction_score_id)
  const setSelectedScoreId = useAnalysisStore((state) => state.setSelectedPredictionScoreId)

  const results = analysis.results as CorrelationResults | undefined

  const modelPredictions = useMemo(() => {
    const byId: Record<string, SimulatedScoreResult> = {}
    const predictions = results?.predicted_scores ?? []

    for (const prediction of predictions) {
      const rawId = prediction.score_id
      if (!rawId) continue
      const normalizedId = toCanonicalScoreId(rawId)
      const value = Number(prediction.value)
      if (!Number.isFinite(value)) continue

      const ci95Lower = Number.isFinite(prediction.ci95_lower as number) ? Number(prediction.ci95_lower) : value
      const ci95Upper = Number.isFinite(prediction.ci95_upper as number) ? Number(prediction.ci95_upper) : value

      byId[normalizedId] = {
        value,
        ci95Lower,
        ci95Upper,
        source: 'model',
        modelFile: prediction.model_file,
        modelArchitecture: prediction.model_architecture,
        nGraphWindows: prediction.n_graph_windows,
        valueScale: prediction.value_scale,
        normalizedValue: prediction.normalized_value,
        targetScaler: prediction.target_scaler,
      }
    }

    return byId
  }, [results?.predicted_scores])

  const predictedValues = useMemo(() => {
    if (!results?.correlation_matrix) return {}
    const values: Record<string, SimulatedScoreResult> = {}

    const hasBackendModel = (scoreId: string) => {
      const entry = Object.entries(results.model_registry ?? {}).find(
        ([registryScoreId]) => toCanonicalScoreId(registryScoreId) === scoreId
      )?.[1]
      return Boolean(entry?.exists)
    }

    for (const score of SCORE_REGISTRY) {
      if (modelPredictions[score.id]) {
        values[score.id] = modelPredictions[score.id]
        continue
      }

      // If a real backend model exists for this score, do not mask missing
      // inference results with a simulated placeholder.
      if (hasBackendModel(score.id)) {
        continue
      }

      values[score.id] = {
        ...simulateScore(score, results.correlation_matrix),
        source: 'simulated',
      }
    }
    return values
  }, [results?.correlation_matrix, results?.model_registry, modelPredictions])

  const selectedScore = useMemo(
    () =>
      SCORE_REGISTRY.find((s) => s.id === selectedScoreId) ??
      SCORE_REGISTRY.find((s) => s.id === PRIMARY_VISUAL_SCORE_ID) ??
      null,
    [selectedScoreId]
  )

  const selectedImportanceBrainUrl = useMemo(() => {
    if (!selectedScore) return null
    const path =
      results?.importance_brain_urls?.[selectedScore.id] ??
      (selectedScore.id === 'listsort_ageadj' ? results?.listsort_importance_brain_url : null) ??
      FALLBACK_IMPORTANCE_BRAIN_PATHS[selectedScore.id]
    return toBackendUrl(path)
  }, [results?.importance_brain_urls, results?.listsort_importance_brain_url, selectedScore])

  const selectedImportanceStaticBrainUrl = useMemo(() => {
    if (!selectedScore) return null
    const path =
      results?.importance_static_brain_urls?.[selectedScore.id] ??
      (selectedScore.id === 'listsort_ageadj' ? results?.listsort_importance_static_brain_url : null) ??
      FALLBACK_IMPORTANCE_STATIC_BRAIN_PATHS[selectedScore.id]
    return toBackendUrl(path)
  }, [results?.importance_static_brain_urls, results?.listsort_importance_static_brain_url, selectedScore])

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
        <p className='section-subtitle'>
          Visual model link: <span className='font-semibold text-ink-950'>{selectedScore?.name ?? 'Selected score'}</span>
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
          importanceBrainUrl={selectedImportanceBrainUrl}
          selectedScoreId={selectedScoreId}
          onSelectScore={setSelectedScoreId}
        />

        <BoldTimeSeries timeSeries={results.time_series} />

        <StaticBrainViews
          markersPngBase64={results.nilearn_markers_png_base64}
          importanceStaticBrainUrl={selectedImportanceStaticBrainUrl}
          showImportanceStaticBrain={Boolean(selectedImportanceStaticBrainUrl)}
          scoreShortName={selectedScore?.shortName ?? ''}
        />
      </div>
    </div>
  )
}
