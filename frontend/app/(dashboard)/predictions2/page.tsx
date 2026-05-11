'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Activity, Brain, ChartNoAxesColumn, HeartPulse } from 'lucide-react'
import { api } from '@/lib/api'
import { computeScoreTopLinks } from '@/lib/score-links'
import { getROILabel } from '@/lib/shen268-labels'
import { getScoresByCategory, SCORE_REGISTRY, type ScoreCategory, type ScoreDefinition } from '@/lib/score-registry'
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

function formatValue(value: number, scoreDef: ScoreDefinition): string {
  const range = scoreDef.scoreRange[1] - scoreDef.scoreRange[0]
  if (range <= 1) return value.toFixed(2)
  if (range <= 30) return value.toFixed(1)
  return Math.round(value).toString()
}

function scorePercent(value: number, scoreDef: ScoreDefinition): number {
  const [min, max] = scoreDef.scoreRange
  if (max <= min) return 0
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

function formatScoreRange(scoreDef: ScoreDefinition): string {
  return `${formatValue(scoreDef.scoreRange[0], scoreDef)} - ${formatValue(scoreDef.scoreRange[1], scoreDef)} ${scoreDef.unit}`
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

function ScoreCategoryCard({
  category,
  selectedScoreId,
  predictedValues,
  onSelect,
}: {
  category: ScoreCategory
  selectedScoreId: string | null
  predictedValues: Record<string, SimulatedScoreResult>
  onSelect: (scoreId: string) => void
}) {
  const scores = getScoresByCategory(category)
  const icon = category === 'cognition' ? Brain : HeartPulse
  const title = category === 'cognition' ? 'Cognition' : 'Emotion'
  const Icon = icon

  return (
    <div className='surface-card-strong space-y-4'>
      <div className='flex items-center gap-3'>
        <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-brand-700 shadow-sm'>
          <Icon className='h-5 w-5' />
        </div>
        <div>
          <h2 className='font-display text-lg font-semibold text-ink-950'>{title}</h2>
          <p className='text-xs text-ink-700'>Model-derived behavioral profile</p>
        </div>
      </div>

      <div className='space-y-3'>
        {scores.map((scoreDef) => {
          const result = predictedValues[scoreDef.id]
          const active = selectedScoreId === scoreDef.id
          const percent = result ? scorePercent(result.value, scoreDef) : 0

          return (
            <button
              key={scoreDef.id}
              type='button'
              onClick={() => onSelect(scoreDef.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-brand-500/40 bg-white shadow-sm'
                  : 'border-brand-400/15 bg-white/70 hover:border-brand-500/30 hover:bg-white/90'
              }`}
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-ink-950'>{scoreDef.name}</p>
                  <p className='text-[11px] text-ink-700'>Score range: {formatScoreRange(scoreDef)}</p>
                </div>
                <div className='text-right'>
                  {result ? (
                    <>
                      <p className='text-[10px] uppercase tracking-[0.08em] text-ink-700'>Predicted score</p>
                      <p className='text-lg font-semibold' style={{ color: scoreDef.accentColor }}>
                        {formatValue(result.value, scoreDef)}
                      </p>
                      <p className='text-[11px] text-ink-700'>{Math.round(percent)}%</p>
                    </>
                  ) : (
                    <>
                      <p className='text-sm font-semibold text-ink-700'>Unavailable</p>
                      <p className='text-[11px] text-ink-700'>No prediction</p>
                    </>
                  )}
                </div>
              </div>

              <div className='mt-2 flex items-center justify-between gap-3 text-[11px] text-ink-700'>
                <span>{scoreDef.unit}</span>
                <span>
                  {result
                    ? `Predicted range (95% CI): ${formatValue(result.ci95Lower, scoreDef)} - ${formatValue(result.ci95Upper, scoreDef)}`
                    : 'Prediction range unavailable'}
                </span>
              </div>

              <div className='mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200'>
                <div
                  className='h-full rounded-full transition-all'
                  style={{ width: `${percent}%`, background: scoreDef.accentColor }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

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

      byId[normalizedId] = { value, ci95Lower, ci95Upper }
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

      values[score.id] = simulateScore(score, results.correlation_matrix)
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

  const focusedTimeSeries = useMemo(
    () => buildFocusedTimeSeries(results?.time_series, results, selectedScore?.id ?? ''),
    [results, selectedScore]
  )

  const timeSeriesMaxIndex = Math.max((focusedTimeSeries?.tr_index.length ?? 1) - 1, 0)

  useEffect(() => {
    setCurrentTrIndex((current) => Math.min(current, timeSeriesMaxIndex))
  }, [timeSeriesMaxIndex])

  const currentTrValue = focusedTimeSeries?.tr_index[currentTrIndex]
  const currentGlobalSignal = focusedTimeSeries?.global_signal[currentTrIndex] ?? null

  const topConnections = useMemo(() => {
    if (!results?.correlation_matrix || !selectedScore) return []
    return computeScoreTopLinks(results.correlation_matrix, selectedScore, 3, 0.2)
  }, [results?.correlation_matrix, selectedScore])

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
      <section className='surface-card-strong space-y-5'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <p className='text-xs uppercase tracking-[0.18em] text-brand-700 font-semibold'>Predictions 2</p>
            <h1 className='font-display text-3xl text-ink-950'>Integrated Brain-Behavior Dashboard</h1>
            <p className='text-sm text-ink-700'>
              File name indicator: <span className='mono-data'>{results.file_name}</span>
            </p>
            <p className='text-sm text-ink-700'>
              Visual model link: <span className='font-semibold text-ink-950'>ListSort (Age Adjusted)</span>
            </p>
            <p className='text-xs text-ink-700'>
              Execution ID: <span className='mono-data'>{activeAnalysis.execution_id}</span>
            </p>
          </div>

          <div className='w-full max-w-md rounded-2xl border border-brand-400/20 bg-white/85 p-4'>
            <div className='mb-2 flex items-center justify-between text-sm font-semibold text-ink-950'>
              <span>Processing Status</span>
              <span className='text-brand-700'>Completed</span>
            </div>
            <div className='h-3 overflow-hidden rounded-full bg-slate-200'>
              <div className='h-full w-full rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700' />
            </div>
            <p className='mt-2 text-xs text-ink-700'>
              Analysis outputs are ready for exploration and explanation.
            </p>
          </div>
        </div>
      </section>

      <section className='grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_0.9fr]'>
        <div className='surface-card-strong space-y-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <h2 className='font-display text-2xl text-ink-950'>3D Brain Connectivity Map</h2>
              <p className='text-sm text-ink-700'>
                Interactive connectome for the current analysis, linked to the ListSort (Age Adjusted) behavioral model and paired with a playback scrubber across the fMRI time series.
              </p>
            </div>
            {selectedScore && selectedScoreResult ? (
              <div className='rounded-2xl border border-brand-400/20 bg-white/90 px-4 py-3 text-right shadow-sm'>
                <p className='text-xs uppercase tracking-[0.12em] text-ink-700'>Focused Metric</p>
                <p className='font-semibold text-ink-950'>{selectedScore.name}</p>
                <p className='text-lg font-semibold' style={{ color: selectedScore.accentColor }}>
                  {formatValue(selectedScoreResult.value, selectedScore)} {selectedScore.unit}
                </p>
              </div>
            ) : null}
          </div>

          <div className='overflow-hidden rounded-[1.75rem] border border-brand-400/20 bg-white/85 shadow-inner'>
            {results.nilearn_connectome_html ? (
              <iframe
                title='3D Brain Connectivity Map'
                srcDoc={results.nilearn_connectome_html}
                className='w-full border-0'
                style={{ height: '540px' }}
                sandbox='allow-scripts allow-same-origin'
              />
            ) : (
              <div className='flex h-[540px] items-center justify-center text-sm text-ink-700'>
                3D connectome output is not available for this run.
              </div>
            )}
          </div>

          <div className='rounded-2xl border border-brand-400/20 bg-white/90 p-4'>
            <div className='mb-3 flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2 text-sm font-semibold text-ink-950'>
                <Activity className='h-4 w-4 text-brand-700' />
                <span>Playback Slider</span>
              </div>
              <div className='text-right text-xs text-ink-700'>
                <p>TR Index: <span className='mono-data'>{currentTrValue ?? 'N/A'}</span></p>
                {currentGlobalSignal !== null ? (
                  <p>Global Average: <span className='mono-data'>{currentGlobalSignal.toFixed(4)}</span></p>
                ) : null}
              </div>
            </div>
            <input
              type='range'
              min={0}
              max={timeSeriesMaxIndex}
              step={1}
              value={currentTrIndex}
              onChange={(event) => setCurrentTrIndex(Number(event.target.value))}
              disabled={!focusedTimeSeries || timeSeriesMaxIndex === 0}
              className='w-full accent-blue-600'
            />
            <div className='mt-3 grid gap-3 sm:grid-cols-3'>
              {topConnections.map((link, index) => (
                <div key={`${link.source_roi}-${link.target_roi}-${index}`} className='rounded-xl border border-brand-400/15 bg-slate-50 px-3 py-2'>
                  <p className='text-[11px] uppercase tracking-[0.1em] text-ink-700'>Top Link {index + 1}</p>
                  <p className='text-sm font-medium text-ink-950'>
                    {link.source_label} to {link.target_label}
                  </p>
                  <p className='text-xs text-ink-700'>
                    r = {link.weight.toFixed(3)} ({link.sign})
                  </p>
                </div>
              ))}
            </div>
            <p className='text-xs text-ink-700'>
              These highlighted links and ROI traces are keyed to the <span className='font-semibold'>ListSort (Age Adjusted)</span> model selection.
            </p>
          </div>
        </div>

        <div className='space-y-6'>
          <ScoreCategoryCard
            category='cognition'
            selectedScoreId={selectedScore?.id ?? null}
            predictedValues={predictedValues}
            onSelect={setSelectedScoreId}
          />
          <ScoreCategoryCard
            category='emotion'
            selectedScoreId={selectedScore?.id ?? null}
            predictedValues={predictedValues}
            onSelect={setSelectedScoreId}
          />
        </div>
      </section>

      <section className='surface-card-strong space-y-4'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-brand-700 shadow-sm'>
            <Brain className='h-5 w-5' />
          </div>
          <div>
            <h2 className='font-display text-2xl text-ink-950'>Static Brain Views</h2>
            <p className='text-sm text-ink-700'>Axial, sagittal, and coronal anatomical references for the current map.</p>
          </div>
        </div>
        <StaticBrainViews
          markersPngBase64={results.nilearn_markers_png_base64}
          scoreShortName={selectedScore?.shortName ?? 'Selected score'}
        />
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
