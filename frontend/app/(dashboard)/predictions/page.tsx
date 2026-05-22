'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Brain, Heart, Info } from 'lucide-react'
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
const FALLBACK_IMPORTANCE_BRAIN_PATHS: Record<string, string> = {
  listsort_ageadj: LISTSORT_IMPORTANCE_BRAIN_PATH,
  pmat: '/static/brain_plots/pmat_importance_3d.html',
  picseq: '/static/brain_plots/picseq_importance_3d.html',
  emotsupp_unadj: '/static/brain_plots/emotsupp_importance_3d.html',
  psqi: '/static/brain_plots/psqi_importance_3d.html',
}
const FALLBACK_IMPORTANCE_STATIC_BRAIN_PATHS: Record<string, string> = {
  listsort_ageadj: LISTSORT_IMPORTANCE_STATIC_BRAIN_PATH,
  pmat: '/static/brain_plots/pmat_importance_4panel.png',
  picseq: '/static/brain_plots/picseq_importance_4panel.png',
  emotsupp_unadj: '/static/brain_plots/emotsupp_importance_4panel.png',
  psqi: '/static/brain_plots/psqi_importance_4panel.png',
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

function formatRangeLabel(scoreDef: ScoreDefinition): string {
  const [min, max] = scoreDef.scoreRange
  return `Range: ${formatValue(min, scoreDef)} - ${formatValue(max, scoreDef)}`
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
  listsort_ageadj: '#3B82F6',
  pmat: '#8B5CF6',
  picseq: '#EC4899',
  emotsupp_unadj: '#EF4444',
  psqi: '#F97316',
}

const PREDICTIONS2_SCORE_IDS = ['listsort_ageadj', 'pmat', 'picseq', 'emotsupp_unadj', 'psqi']
const PREDICTIONS2_SCORE_ALIASES: Record<string, string> = {
  sustained_attention: 'picseq',
}

export default function Predictions2Page() {
  const router = useRouter()
  const activeAnalysis = useAnalysisStore((state) => state.active_analysis)
  const latestAnalysis = useAnalysisStore((state) => state.latest_analysis)
  const setActiveAnalysis = useAnalysisStore((state) => state.setActiveAnalysis)
  const setLatestAnalysis = useAnalysisStore((state) => state.setLatestAnalysis)
  const selectedScoreId = useAnalysisStore((state) => state.selected_prediction_score_id)
  const setSelectedScoreId = useAnalysisStore((state) => state.setSelectedPredictionScoreId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTrIndex, setCurrentTrIndex] = useState(0)
  const [loadedImportanceBrainUrl, setLoadedImportanceBrainUrl] = useState<string | null>(null)

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

  const effectiveSelectedScoreId = selectedScoreId ? PREDICTIONS2_SCORE_ALIASES[selectedScoreId] ?? selectedScoreId : null

  const selectedScore = useMemo(
    () =>
      SCORE_REGISTRY.find((score) => score.id === effectiveSelectedScoreId) ??
      SCORE_REGISTRY.find((score) => score.id === PRIMARY_VISUAL_SCORE_ID) ??
      SCORE_REGISTRY[0] ??
      null,
    [effectiveSelectedScoreId]
  )

  const selectedScoreResult = selectedScore ? predictedValues[selectedScore.id] : null
  const selectedImportanceBrainUrl = useMemo(() => {
    if (!selectedScore) return null
    const path =
      results?.importance_brain_urls?.[selectedScore.id] ??
      (selectedScore.id === PRIMARY_VISUAL_SCORE_ID ? results?.listsort_importance_brain_url : null) ??
      FALLBACK_IMPORTANCE_BRAIN_PATHS[selectedScore.id]
    return toBackendUrl(path)
  }, [results?.importance_brain_urls, results?.listsort_importance_brain_url, selectedScore])
  const selectedImportanceStaticBrainUrl = useMemo(() => {
    if (!selectedScore) return null
    const path =
      results?.importance_static_brain_urls?.[selectedScore.id] ??
      (selectedScore.id === PRIMARY_VISUAL_SCORE_ID ? results?.listsort_importance_static_brain_url : null) ??
      FALLBACK_IMPORTANCE_STATIC_BRAIN_PATHS[selectedScore.id]
    return toBackendUrl(path)
  }, [results?.importance_static_brain_urls, results?.listsort_importance_static_brain_url, selectedScore])
  const metricScores = SCORE_REGISTRY.filter((score) => PREDICTIONS2_SCORE_IDS.includes(score.id))
  const cognitionMetricScores = metricScores.filter((score) => score.category === 'cognition')
  const emotionMetricScores = metricScores.filter((score) => score.category === 'emotion')

  const focusedTimeSeries = useMemo(
    () => buildFocusedTimeSeries(results?.time_series, results, selectedScore?.id ?? ''),
    [results, selectedScore]
  )

  const timeSeriesMaxIndex = Math.max((focusedTimeSeries?.tr_index.length ?? 1) - 1, 0)

  useEffect(() => {
    setCurrentTrIndex((current) => Math.min(current, timeSeriesMaxIndex))
  }, [timeSeriesMaxIndex])

  const currentTrValue = focusedTimeSeries?.tr_index[currentTrIndex]

  const currentBrainTitle = selectedImportanceBrainUrl
    ? `Global ${selectedScore?.shortName ?? 'score'} model importance brain`
    : '3D Brain Connectivity Map'
  const isImportanceBrainLoading = Boolean(selectedImportanceBrainUrl) && selectedImportanceBrainUrl !== loadedImportanceBrainUrl

  useEffect(() => {
    setLoadedImportanceBrainUrl(null)
  }, [selectedImportanceBrainUrl])

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
        <h1 className='section-title'>Predictions</h1>
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
    <div className='overflow-hidden rounded-[1.9rem] border border-slate-200/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
      <header className='bg-[linear-gradient(180deg,rgba(245,248,255,0.96),rgba(239,244,255,0.92))] px-4 py-2.5 sm:px-4.5'>
        <h1 className='font-display text-[1.32rem] font-semibold text-slate-950 sm:text-[1.42rem]'>Individual Brain Behavior Prediction Dashboard</h1>
        <p className='mt-0.5 text-[12px] text-slate-600'>
          File: <span className='mono-data'>{results.file_name}</span>
        </p>
      </header>

      <div className='space-y-2 bg-white px-3 pb-3 pt-1.5 sm:px-3.5 sm:pb-3.5 sm:pt-1.5'>
      <section className='grid h-[calc(100vh-7rem)] grid-rows-[minmax(0,1fr)] gap-1 overflow-hidden'>
          <section className='min-h-0 overflow-hidden'>
            <div className='grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.95fr)]'>
              <div className='grid min-h-0 gap-1 xl:grid-rows-[minmax(0,1.55fr)_minmax(0,1.3fr)]'>
                <div className='min-h-0 overflow-hidden'>
                  {selectedImportanceBrainUrl ? (
                    <div className='relative h-full min-h-[15rem]'>
                      {isImportanceBrainLoading && (
                        <div className='absolute inset-0 z-10 flex items-center justify-center bg-white text-sm text-slate-600'>
                          <div className='text-center'>
                            <div className='loading-spinner mx-auto mb-3' />
                            <p>Loading selected brain plot...</p>
                          </div>
                        </div>
                      )}
                      <iframe
                        title={currentBrainTitle}
                        src={selectedImportanceBrainUrl}
                        onLoad={() => setLoadedImportanceBrainUrl(selectedImportanceBrainUrl)}
                        className={`h-full w-full border-0 transition-opacity ${
                          isImportanceBrainLoading ? 'opacity-0' : 'opacity-100'
                        }`}
                        sandbox='allow-scripts allow-same-origin'
                      />
                    </div>
                  ) : results.nilearn_connectome_html ? (
                    <iframe
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

                <section className='overflow-hidden'>
                  <div className='h-full overflow-hidden [&_.surface-card]:h-full [&_.surface-card]:space-y-0 [&_.surface-card]:bg-transparent [&_.surface-card]:p-0 [&_.surface-card]:shadow-none [&_.border-t]:hidden [&_img]:mx-auto [&_img]:h-full [&_img]:w-full [&_img]:object-contain'>
                    <StaticBrainViews
                      markersPngBase64={results.nilearn_markers_png_base64}
                      listsortStaticBrainUrl={selectedImportanceStaticBrainUrl}
                      showListSortStaticBrain={Boolean(selectedImportanceStaticBrainUrl)}
                      scoreShortName={selectedScore?.shortName ?? 'Selected score'}
                    />
                  </div>
                </section>
              </div>
            <div className='flex min-h-0 flex-col p-2.5'>
                <div className='mb-2 flex items-start justify-between gap-3'>
                  <h2 className='font-display text-base font-semibold text-slate-950'>Cognitive & Emotion Metrics</h2>
                  {selectedScoreResult && selectedScore ? (
                    <div className='ml-auto rounded-[0.9rem] border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-right shadow-sm'>
                      <p className='text-[10px] uppercase tracking-[0.12em] text-slate-500'>Predicted Score</p>
                      <p className='text-sm font-semibold text-slate-950'>{selectedScore.shortName}</p>
                    </div>
                  ) : null}
                </div>

                <div className='flex-1 space-y-2.5'>
                  {[
                    { id: 'cognition', label: 'Cognition Metrics', scores: cognitionMetricScores },
                    { id: 'emotion', label: 'Emotion Metrics', scores: emotionMetricScores },
                  ].map((group) => (
                    <div key={group.id} className={group.id === 'emotion' ? 'space-y-1.5 pt-2' : 'space-y-1.5'}>
                      <div className='px-1'>
                        <div className='flex items-center gap-2'>
                          {group.id === 'cognition' ? (
                            <Brain className='h-4 w-4 text-slate-700' />
                          ) : (
                            <Heart className='h-4 w-4 text-slate-700' />
                          )}
                          <p className='font-display text-base font-semibold text-slate-950'>
                            {group.label}
                          </p>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        {group.scores.map((score) => {
                          const result = predictedValues[score.id]
                          const percent = result ? scorePercent(result.value, score) : 0
                          const accent = METRIC_BAR_ACCENTS[score.id] ?? score.accentColor

                          return (
                            <button
                              key={score.id}
                              type='button'
                              onClick={() => setSelectedScoreId(score.id)}
                              className={`w-full rounded-[0.95rem] border px-3 py-2 text-left transition ${
                                selectedScore?.id === score.id
                                  ? 'border-slate-300 bg-slate-100 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className='mb-1 flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                  <div className='flex items-center gap-1.5'>
                                    <p className='truncate text-[12px] font-medium text-slate-900'>{score.name}</p>
                                    <span
                                      className='inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-500'
                                      title={score.description}
                                      aria-label={`${score.name} info`}
                                    >
                                      <Info className='h-2.5 w-2.5' />
                                    </span>
                                  </div>
                                  <div className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]'>
                                    <p className='text-slate-500'>{score.unit}</p>
                                    <p className='text-slate-400'>{formatRangeLabel(score)}</p>
                                  </div>
                                </div>
                                <div className='shrink-0 pl-2 pt-0.5 text-right'>
                                  <p className='text-base font-semibold' style={{ color: accent }}>
                                    {result ? formatPredictionValue(result.value, score, result.valueScale) : '--'}
                                  </p>
                                </div>
                              </div>
                              <div className='h-1.5 overflow-hidden rounded-full bg-slate-100'>
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
                  ))}
                </div>
            </div>
            </div>
          </section>
      </section>

      <section className='overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-slate-50/75'>
        <div className='p-3'>
          <section className='grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2'>
            <div className='flex h-full flex-col space-y-4'>
              <div>
                <div>
                  <h2 className='font-display text-lg font-semibold text-slate-950'>Correlation Matrix</h2>
                  <p className='text-sm text-slate-700'>High-contrast ROI-to-ROI interaction heatmap for the loaded file.</p>
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
              <div>
                <div>
                  <h2 className='font-display text-lg font-semibold text-slate-950'>Time Series Graph</h2>
                  <p className='text-sm text-slate-700'>
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
      </section>
      </div>
    </div>
  )
}
