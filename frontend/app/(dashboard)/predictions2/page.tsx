'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChartNoAxesColumn } from 'lucide-react'
import { api, API_BASE_URL } from '@/lib/api'
import { getROILabel } from '@/lib/shen268-labels'
import { SCORE_REGISTRY, type ScoreDefinition } from '@/lib/score-registry'
import { simulateScore, type SimulatedScoreResult } from '@/lib/score-simulator'
import type { AnalysisResponse, CorrelationResults, ExplainedScore, HistoryItem, TimeSeriesPayload } from '@/lib/types'
import { useAnalysisStore } from '@/lib/store'

const CorrelationMatrix = dynamic(() => import('@/components/CorrelationMatrix'), { ssr: false })
const StaticBrainViews = dynamic(() => import('@/components/StaticBrainViews'), { ssr: false })
const BoldTimeSeries = dynamic(
  () => import('@/components/charts/BoldTimeSeries').then((mod) => mod.BoldTimeSeries),
  { ssr: false }
)

const PRIMARY_VISUAL_SCORE_ID = 'listsort_ageadj'
const LISTSORT_IMPORTANCE_BRAIN_PATH = '/static/brain_plots/listsort_importance_3d.html'
const LISTSORT_IMPORTANCE_STATIC_BRAIN_PATH = '/static/brain_plots/listsort_importance_4panel.png'

function normalizeScoreId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function toCanonicalScoreId(value: string): string {
  const alias: Record<string, string> = {
    emotion_score: 'emotion_recognition',
    emotion: 'emotion_recognition',
    attention: 'sustained_attention',
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
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${API_BASE_URL.replace(/\/$/, '')}/${pathOrUrl.replace(/^\//, '')}`
}

function formatValue(value: number, scoreDef: ScoreDefinition): string {
  const range = scoreDef.scoreRange[1] - scoreDef.scoreRange[0]
  if (range <= 1) return value.toFixed(2)
  if (range <= 30) return value.toFixed(1)
  return Math.round(value).toString()
}

function formatPredictionValue(value: number, scoreDef: ScoreDefinition, valueScale?: string): string {
  if (valueScale === 'normalized') return value.toFixed(3)
  return formatValue(value, scoreDef)
}

function scorePercent(value: number, scoreDef: ScoreDefinition): number {
  const [min, max] = scoreDef.scoreRange
  if (max <= min) return 0
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

function getExplainedScore(results: CorrelationResults | undefined, scoreId: string): ExplainedScore | undefined {
  return results?.explained_scores?.find((score) => toCanonicalScoreId(score.score_id) === scoreId)
}

function buildFocusedTimeSeries(
  baseTimeSeries: TimeSeriesPayload | undefined,
  results: CorrelationResults | undefined,
  scoreId: string
): TimeSeriesPayload | undefined {
  if (!baseTimeSeries) return undefined

  const explainedScore = getExplainedScore(results, scoreId)
  const topRoiIndices = explainedScore?.roi_importance
    ?.slice()
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
    .map((roi) => roi.roi_index)

  if (!topRoiIndices || topRoiIndices.length === 0) {
    return baseTimeSeries
  }

  const roiSeries = topRoiIndices
    .map((roiIndex) => {
      const existing = baseTimeSeries.roi_series.find((series) => series.roi_index === roiIndex)
      if (existing) {
        return { ...existing, label: existing.label || getROILabel(existing.roi_index) }
      }
      return null
    })
    .filter((series): series is NonNullable<typeof series> => Boolean(series))

  if (roiSeries.length === 0) {
    return baseTimeSeries
  }

  return {
    ...baseTimeSeries,
    roi_series: roiSeries,
  }
}

const METRIC_BAR_ACCENTS: Record<string, string> = {
  listsort_ageadj: '#7c3aed',
  pmat: '#a855f7',
  sustained_attention: '#ec4899',
  emotion_recognition: '#ef4444',
  sleep_quality: '#f97316',
}

const BRAIN_DOWNLOAD_BUTTON_STYLE = {
  backgroundColor: '#949bad',
  borderColor: '#949bad',
  color: '#ffffff',
} as const

export default function Predictions2Page() {
  const router = useRouter()
  const activeAnalysis = useAnalysisStore((state) => state.active_analysis)
  const latestAnalysis = useAnalysisStore((state) => state.latest_analysis)
  const setActiveAnalysis = useAnalysisStore((state) => state.setActiveAnalysis)
  const setLatestAnalysis = useAnalysisStore((state) => state.setLatestAnalysis)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(PRIMARY_VISUAL_SCORE_ID)
  const [currentTrIndex, setCurrentTrIndex] = useState(0)
  const brainIframeRef = useRef<HTMLIFrameElement | null>(null)

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
        setError('Failed to load the enhanced prediction dashboard.')
      } finally {
        setLoading(false)
      }
    }

    void fetchLatestAnalysis()
  }, [activeAnalysis, latestAnalysis, router, setActiveAnalysis, setLatestAnalysis])

  const results = activeAnalysis?.results as CorrelationResults | undefined

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
      SCORE_REGISTRY.find((score) => score.id === selectedScoreId) ??
      SCORE_REGISTRY.find((score) => score.id === PRIMARY_VISUAL_SCORE_ID) ??
      SCORE_REGISTRY[0] ??
      null,
    [selectedScoreId]
  )

  const selectedScoreResult = selectedScore ? predictedValues[selectedScore.id] : null
  const showListSortBrain = selectedScore?.id === PRIMARY_VISUAL_SCORE_ID
  const listsortImportanceBrainUrl = toBackendUrl(results?.listsort_importance_brain_url ?? LISTSORT_IMPORTANCE_BRAIN_PATH)
  const listsortStaticBrainUrl = toBackendUrl(
    results?.listsort_importance_static_brain_url ?? LISTSORT_IMPORTANCE_STATIC_BRAIN_PATH
  )
  const metricScores = SCORE_REGISTRY.filter((score) =>
    ['listsort_ageadj', 'pmat', 'sustained_attention', 'emotion_recognition', 'sleep_quality'].includes(score.id)
  )

  const focusedTimeSeries = useMemo(
    () => buildFocusedTimeSeries(results?.time_series, results, selectedScore?.id ?? ''),
    [results, selectedScore]
  )

  const timeSeriesMaxIndex = Math.max((focusedTimeSeries?.tr_index.length ?? 1) - 1, 0)

  useEffect(() => {
    setCurrentTrIndex((current) => Math.min(current, timeSeriesMaxIndex))
  }, [timeSeriesMaxIndex])

  const currentTrValue = focusedTimeSeries?.tr_index[currentTrIndex]

  const currentBrainTitle = showListSortBrain
    ? 'Global ListSort FBNetGen importance brain'
    : '3D Brain Connectivity Map'

  const getBrainPlotContext = () => {
    const iframe = brainIframeRef.current
    const win = iframe?.contentWindow as
      | (Window & typeof globalThis & { Plotly?: any })
      | null
      | undefined
    const doc = iframe?.contentDocument
    const plotEl = doc?.querySelector('.plotly-graph-div') as
      | (HTMLDivElement & {
          data?: unknown[]
          layout?: {
            scene?: {
              camera?: {
                eye?: { x?: number; y?: number; z?: number }
              }
            }
          }
        })
      | null

    if (!iframe || !win?.Plotly || !plotEl) return null
    return { Plotly: win.Plotly, plotEl }
  }

  const setBrainDragMode = (mode: 'zoom' | 'pan' | 'orbit') => {
    const context = getBrainPlotContext()
    if (!context) return
    context.Plotly.relayout(context.plotEl, { dragmode: mode }).catch((error: unknown) => {
      console.error('Error switching brain drag mode:', error)
    })
  }

  const zoomBrainBy = (factor: number) => {
    const context = getBrainPlotContext()
    const eye = context?.plotEl.layout?.scene?.camera?.eye
    if (!context || !eye) {
      return
    }

    context.Plotly.relayout(context.plotEl, {
      'scene.camera.eye': {
        x: (eye.x ?? 1) * factor,
        y: (eye.y ?? 1) * factor,
        z: (eye.z ?? 0.8) * factor,
      },
    }).catch((error: unknown) => {
      console.error('Error applying brain zoom:', error)
    })
  }

  const resetBrainView = () => {
    const context = getBrainPlotContext()
    if (!context) return
    context.Plotly.relayout(context.plotEl, {
      dragmode: 'orbit',
      'scene.camera.eye': { x: 1, y: 1, z: 0.8 },
    }).catch((error: unknown) => {
      console.error('Error resetting brain view:', error)
    })
  }

  const downloadBrainAsPNG = () => {
    const context = getBrainPlotContext()
    if (!context) return
    context.Plotly.downloadImage(context.plotEl, {
      format: 'png',
      filename: `brain_visual_${Date.now()}`,
    }).catch((error: unknown) => {
      console.error('Error exporting brain PNG:', error)
    })
  }

  const downloadBrainAsJSON = () => {
    const context = getBrainPlotContext()
    if (!context) return
    const payload = JSON.stringify(
      {
        data: context.plotEl.data ?? [],
        layout: context.plotEl.layout ?? {},
      },
      null,
      2
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `brain_visual_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadBrainAsCSV = () => {
    const context = getBrainPlotContext()
    if (!context) return

    const rows = (context.plotEl.data ?? []).flatMap((trace: any, traceIndex: number) => {
      const xValues = Array.isArray(trace?.x) ? trace.x : []
      const yValues = Array.isArray(trace?.y) ? trace.y : []
      const zValues = Array.isArray(trace?.z) ? trace.z : []
      const colors = Array.isArray(trace?.marker?.color) ? trace.marker.color : []
      const labels = Array.isArray(trace?.text) ? trace.text : []
      const rowCount = Math.max(xValues.length, yValues.length, zValues.length, colors.length, labels.length, 1)

      return Array.from({ length: rowCount }, (_, pointIndex) => [
        traceIndex,
        trace?.name ?? '',
        trace?.type ?? '',
        xValues[pointIndex] ?? '',
        yValues[pointIndex] ?? '',
        zValues[pointIndex] ?? '',
        colors[pointIndex] ?? '',
        labels[pointIndex] ?? '',
      ])
    })

    const csvContent = [
      ['trace_index', 'trace_name', 'trace_type', 'x', 'y', 'z', 'color', 'label'].join(','),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `brain_visual_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className='page-container'>
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className='page-container'>
        <div className='text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading enhanced prediction dashboard...</p>
        </div>
      </div>
    )
  }

  if (!activeAnalysis || activeAnalysis.status !== 'completed' || !results) {
    return (
      <div className='page-container text-center py-12'>
        <h1 className='section-title'>Predictions 2</h1>
        <p className='section-subtitle mt-2'>This tab is designed for completed analyses.</p>
        <p className='text-sm text-ink-700 mt-4'>No completed analyses are available yet.</p>
        <div className='mt-5 flex justify-center gap-3'>
          <Link href='/upload' className='btn-primary'>
            Upload data
          </Link>
          <Link href='/predictions' className='btn-secondary'>
            Open Predictions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <section className='overflow-hidden rounded-[2rem] bg-slate-100/80'>
        <div className='grid h-[calc(100vh-4rem)] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3'>
          <section className='px-1 py-1'>
            <div className='space-y-1'>
              <h1 className='font-display text-lg font-semibold text-slate-950'>Predicted Brain Behavior Dashboard</h1>
              <p className='text-sm text-slate-700'>
                File: <span className='mono-data'>{results.file_name}</span>
              </p>
            </div>
          </section>

          <section className='min-h-0 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm'>
            <div className='grid h-full min-h-0 gap-3 p-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.95fr)]'>
              <div className='grid min-h-0 gap-3 xl:grid-rows-[minmax(0,2fr)_minmax(0,1fr)]'>
                <div className='flex min-h-0 flex-col overflow-hidden rounded-[1.2rem] bg-white'>
                  <div className='min-h-0 flex-1 overflow-hidden'>
                    
                  {showListSortBrain ? (
                    listsortImportanceBrainUrl ? (
                      <iframe
                        ref={brainIframeRef}
                        title={currentBrainTitle}
                        src={listsortImportanceBrainUrl}
                        className='h-full min-h-[15rem] w-full border-0'
                        sandbox='allow-scripts allow-same-origin'
                      />
                    ) : (
                      <div className='flex h-full min-h-[15rem] items-center justify-center text-sm text-slate-600'>
                        3D brain visualization is not available for this run.
                      </div>
                    )
                  ) : results.nilearn_connectome_html ? (
                    <iframe
                      ref={brainIframeRef}
                      title={currentBrainTitle}
                      srcDoc={results.nilearn_connectome_html}
                      className='h-full min-h-[15rem] w-full border-0'
                      sandbox='allow-scripts allow-same-origin'
                    />
                  ) : (
                    <div className='flex h-full min-h-[15rem] items-center justify-center text-sm text-slate-600'>
                      3D brain visualization is not available for this run.
                    </div>
                  )}
                </div>
                <div className='border-t border-slate-200 bg-white px-2 py-2'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto'>
                      <button
                        type='button'
                        onClick={() => zoomBrainBy(0.85)}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        Zoom In
                      </button>
                      <button
                        type='button'
                        onClick={() => zoomBrainBy(1.15)}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        Zoom Out
                      </button>
                      <button
                        type='button'
                        onClick={() => setBrainDragMode('pan')}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        Pan
                      </button>
                      <button
                        type='button'
                        disabled
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] opacity-50'
                        title='Plotly 3D brain view does not support box select.'
                      >
                        Box Select
                      </button>
                      <button
                        type='button'
                        disabled
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] opacity-50'
                        title='Plotly 3D brain view does not support lasso select.'
                      >
                        Lasso
                      </button>
                      <button
                        type='button'
                        onClick={resetBrainView}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        Home / Reset
                      </button>
                      <button
                        type='button'
                        onClick={downloadBrainAsPNG}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        PNG
                      </button>
                    </div>

                    <div className='flex shrink-0 flex-nowrap gap-1.5'>
                      <button
                        type='button'
                        onClick={downloadBrainAsJSON}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-50'
                        style={BRAIN_DOWNLOAD_BUTTON_STYLE}
                      >
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' className='h-3 w-3' aria-hidden='true'>
                          <path d='M12 4v9' strokeLinecap='round' />
                          <path d='M8.5 9.5 12 13l3.5-3.5' strokeLinecap='round' strokeLinejoin='round' />
                          <path d='M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4' strokeLinecap='round' strokeLinejoin='round' />
                        </svg>
                        <span>JSON</span>
                      </button>
                      <button
                        type='button'
                        onClick={downloadBrainAsCSV}
                        disabled={!showListSortBrain}
                        className='btn-secondary shrink-0 gap-1 px-1.5 py-0.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-50'
                        style={BRAIN_DOWNLOAD_BUTTON_STYLE}
                      >
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' className='h-3 w-3' aria-hidden='true'>
                          <path d='M12 4v9' strokeLinecap='round' />
                          <path d='M8.5 9.5 12 13l3.5-3.5' strokeLinecap='round' strokeLinejoin='round' />
                          <path d='M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4' strokeLinecap='round' strokeLinejoin='round' />
                        </svg>
                        <span>CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <section className='overflow-hidden rounded-[1.2rem] bg-white'>
                <div className='overflow-hidden [&_.surface-card]:space-y-0 [&_.surface-card]:bg-transparent [&_.surface-card]:p-0 [&_.surface-card]:shadow-none [&_.surface-card>div:first-child]:hidden [&_.border-t]:hidden [&_img]:mx-auto [&_img]:max-h-[8.5rem] [&_img]:w-full [&_img]:object-contain'>
                  <StaticBrainViews
                    markersPngBase64={results.nilearn_markers_png_base64}
                    listsortStaticBrainUrl={listsortStaticBrainUrl}
                    showListSortStaticBrain={showListSortBrain}
                    scoreShortName={selectedScore?.shortName ?? 'Selected score'}
                  />
                </div>
              </section>
            </div>

            <div className='flex min-h-0 flex-col rounded-[1.2rem] bg-white p-3'>
                <div className='mb-3 flex items-center justify-between gap-3'>
                  <h2 className='font-display text-base font-semibold text-slate-950'>Cognitive & Emotion Metrics</h2>
                  {selectedScoreResult && selectedScore ? (
                    <div className='text-right'>
                      <p className='text-[10px] uppercase tracking-[0.12em] text-slate-500'>Predicted Score</p>
                      <p className='text-sm font-semibold text-slate-950'>{selectedScore.shortName}</p>
                    </div>
                  ) : null}
                </div>

                <div className='flex-1 space-y-3'>
                  {metricScores.map((score) => {
                    const result = predictedValues[score.id]
                    const percent = result ? scorePercent(result.value, score) : 0
                    const accent = METRIC_BAR_ACCENTS[score.id] ?? score.accentColor

                    return (
                      <button
                        key={score.id}
                        type='button'
                        onClick={() => setSelectedScoreId(score.id)}
                        className={`w-full rounded-[1rem] border px-3 py-2.5 text-left transition ${
                          selectedScore?.id === score.id
                            ? 'border-slate-300 bg-slate-50 shadow-sm'
                            : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className='mb-1.5 flex items-end justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-[12px] font-medium text-slate-900'>{score.name}</p>
                            <p className='text-[10px] text-slate-500'>{score.unit}</p>
                          </div>
                          <div className='shrink-0 text-right'>
                            <p className='text-lg font-semibold' style={{ color: accent }}>
                              {result ? formatPredictionValue(result.value, score, result.valueScale) : '--'}
                            </p>
                          </div>
                        </div>
                        <div className='h-2 overflow-hidden rounded-full bg-slate-100'>
                          <div
                            className='h-full rounded-full transition-all'
                            style={{
                              width: `${percent}%`,
                              background: `linear-gradient(90deg, ${accent}, ${accent}CC)`,
                            }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className='grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2'>
        <div className='flex h-full flex-col space-y-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-brand-700 shadow-sm'>
              <ChartNoAxesColumn className='h-5 w-5' />
            </div>
            <div>
              <h2 className='font-display text-2xl text-ink-950'>Correlation Matrix</h2>
              <p className='text-sm text-ink-700'>High-contrast ROI-to-ROI interaction heatmap for the loaded file.</p>
            </div>
          </div>
          <CorrelationMatrix
            data={results}
            fileName={results.file_name}
            title=''
            subtitle=''
          />
        </div>

        <div className='flex h-full flex-col space-y-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-brand-700 shadow-sm'>
              <Activity className='h-5 w-5' />
            </div>
            <div>
              <h2 className='font-display text-2xl text-ink-950'>Time Series Graph</h2>
              <p className='text-sm text-ink-700'>
                Global Average plus the top 5 critical ROIs identified by the current GNN explanation when available.
              </p>
            </div>
          </div>
          <BoldTimeSeries
            timeSeries={focusedTimeSeries}
            highlightedTrIndex={currentTrValue ?? null}
            title=''
            subtitle=''
          />
        </div>
      </section>
    </div>
  )
}
