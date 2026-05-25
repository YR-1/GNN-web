'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  CalendarRange,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { analysisService } from '@/lib/services'
import { ServiceError } from '@/lib/services/baseService'
import type { DashboardStats } from '@/lib/types'

type DashboardMetric = {
  id: string
  label: string
  shortLabel: string
  range: [number, number]
  average: number
  summaryStd?: number
  summaryVariance?: number
  trend: number
  accent: string
  accentSoft: string
  distribution: number[]
  cohortSplit: [number, number]
  confidence: number
  reliability: string
  insight: string
  topRegions: Array<{ name: string; contribution: number }>
}

type HistogramBin = {
  x: number
  count: number
  percentile: string
  rangeText: string
}

const DASHBOARD_METRICS: DashboardMetric[] = [
  {
    id: 'listsort_ageadj',
    label: 'ListSort (Working Memory)',
    shortLabel: 'ListSort',
    range: [50, 150],
    average: 108,
    summaryStd: 4.63,
    summaryVariance: 21.4,
    trend: 2.4,
    accent: '#3B82F6',
    accentSoft: '#DBEAFE',
    distribution: [61, 68, 72, 78, 83, 87, 91, 96, 101, 106, 110, 116, 121, 128, 134],
    cohortSplit: [91.2, 101.4],
    confidence: 0.92,
    reliability: 'High reliability',
    insight: 'Working-memory prediction is driven primarily by frontoparietal coordination and posterior cingulate modulation across the cohort.',
    topRegions: [
      { name: 'Prefrontal Cortex', contribution: 94 },
      { name: 'Posterior Cingulate', contribution: 86 },
      { name: 'Inferior Parietal Lobule', contribution: 80 },
      { name: 'Caudate', contribution: 74 },
      { name: 'Precuneus', contribution: 69 },
    ],
  },
  {
    id: 'pmat',
    label: 'PMAT (Fluid Intelligence)',
    shortLabel: 'PMAT',
    range: [0, 24],
    average: 16.8,
    summaryStd: 1.53,
    summaryVariance: 2.35,
    trend: 3.1,
    accent: '#8B5CF6',
    accentSoft: '#EDE9FE',
    distribution: [4.2, 6.1, 7.8, 9.2, 10.4, 11.9, 13.1, 14.7, 16.1, 17.2, 18.3, 19.1, 20.4, 21.3, 22.2],
    cohortSplit: [14.8, 17.6],
    confidence: 0.94,
    reliability: 'Clinical-grade consistency',
    insight: 'Fluid reasoning patterns show strongest loading in executive-control and parietal integration networks.',
    topRegions: [
      { name: 'Prefrontal Cortex', contribution: 96 },
      { name: 'Inferior Parietal Lobule', contribution: 88 },
      { name: 'Dorsal Attention Hub', contribution: 81 },
      { name: 'Caudate', contribution: 74 },
      { name: 'Posterior Cingulate', contribution: 69 },
    ],
  },
  {
    id: 'picseq',
    label: 'PicSeq (Picture Sequence Memory)',
    shortLabel: 'PicSeq',
    range: [50, 150],
    average: 112,
    summaryStd: 1.6,
    summaryVariance: 2.55,
    trend: 1.9,
    accent: '#EC4899',
    accentSoft: '#FCE7F3',
    distribution: [66, 72, 77, 83, 88, 92, 96, 102, 107, 111, 116, 121, 126, 132, 138],
    cohortSplit: [96, 108],
    confidence: 0.9,
    reliability: 'Stable across sessions',
    insight: 'Picture-sequence memory patterns reflect distributed episodic-memory and associative network coordination.',
    topRegions: [
      { name: 'Hippocampus', contribution: 95 },
      { name: 'Parahippocampal Cortex', contribution: 86 },
      { name: 'Precuneus', contribution: 80 },
      { name: 'Posterior Cingulate', contribution: 76 },
      { name: 'Temporal Association Cortex', contribution: 69 },
    ],
  },
  {
    id: 'emotsupp_unadj',
    label: 'Emotional Support (Empathy & Caring)',
    shortLabel: 'EmotSupp',
    range: [20, 80],
    average: 54,
    summaryStd: 0.38,
    summaryVariance: 0.14,
    trend: 4.2,
    accent: '#ef4444',
    accentSoft: '#fee2e2',
    distribution: [29, 36, 42, 48, 54, 60, 66, 71, 77, 81, 84, 88, 91, 94, 97],
    cohortSplit: [72.8, 80.9],
    confidence: 0.88,
    reliability: 'Moderate-high confidence',
    insight: 'Perceived emotional support reflects default-mode and limbic-prefrontal coordination linked to social cognition.',
    topRegions: [
      { name: 'Amygdala', contribution: 91 },
      { name: 'Temporal Cortex', contribution: 84 },
      { name: 'Orbitofrontal Cortex', contribution: 79 },
      { name: 'Ventromedial PFC', contribution: 73 },
      { name: 'Posterior Insula', contribution: 66 },
    ],
  },
  {
    id: 'psqi',
    label: 'PSQI (Sleep Quality)',
    shortLabel: 'PSQI',
    range: [0, 21],
    average: 4.1,
    summaryStd: 0.1,
    summaryVariance: 0.01,
    trend: -2.7,
    accent: '#F97316',
    accentSoft: '#FFEDD5',
    distribution: [2.1, 3.9, 5.4, 6.8, 8.1, 9.6, 10.7, 11.9, 13.1, 14.2, 15.4, 16.3, 17.4, 18.6, 19.8],
    cohortSplit: [12.2, 14.5],
    confidence: 0.9,
    reliability: 'High signal stability',
    insight: 'Sleep-quality estimation clusters around salience, limbic, and thalamic circuitry with clear cohort spread.',
    topRegions: [
      { name: 'Anterior Cingulate', contribution: 94 },
      { name: 'Insula', contribution: 87 },
      { name: 'Hippocampus', contribution: 79 },
      { name: 'Thalamus', contribution: 72 },
      { name: 'Precuneus', contribution: 68 },
    ],
  },
]

const METRIC_VISUALS: Record<string, Pick<DashboardMetric, 'accent' | 'accentSoft'>> = {
  listsort_ageadj: { accent: '#3B82F6', accentSoft: '#DBEAFE' },
  pmat: { accent: '#8B5CF6', accentSoft: '#EDE9FE' },
  picseq: { accent: '#EC4899', accentSoft: '#FCE7F3' },
  emotsupp_unadj: { accent: '#EF4444', accentSoft: '#FEE2E2' },
  psqi: { accent: '#F97316', accentSoft: '#FFEDD5' },
}

function formatMetricValue(metric: DashboardMetric, value: number): string {
  const [min, max] = metric.range
  if (max <= 1) return value.toFixed(2)
  if (max - min <= 25) return value.toFixed(1)
  return Math.round(value).toString()
}

function formatHistogramRange(metric: DashboardMetric, start: number, end: number, isLastBin: boolean): string {
  const lower = formatMetricValue(metric, start)
  const upperBound = isLastBin ? end : end - 1
  const upper = formatMetricValue(metric, upperBound)
  return `${lower} to ${upper}`
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * percentile
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function buildHistogram(metric: DashboardMetric): HistogramBin[] {
  const values = [...metric.distribution].sort((a, b) => a - b)
  const [min, max] = metric.range
  const width = getHistogramStep(metric)
  const binCount = Math.max(1, Math.ceil((max - min) / width))
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + index * width
    const end = Math.min(max, start + width)
    const isLastBin = index === binCount - 1
    const inBin = values.filter((value) => {
      if (isLastBin) return value >= start && value <= end
      return value >= start && value < end
    })
    return {
      x: start + width / 2,
      count: inBin.length,
      percentile: `${Math.round(((index + 1) / binCount) * 100)}th`,
      rangeText: formatHistogramRange(metric, start, end, isLastBin),
    }
  })
  return bins
}

function getHistogramStep(metric: DashboardMetric): number {
  if (metric.id === 'pmat') return 4
  if (metric.id === 'psqi') return 3

  const [min, max] = metric.range
  const span = max - min

  if (span >= 40) return 10
  if (span >= 20) return 5
  if (span > 5) return 1
  if (span > 1) return 0.5
  return 0.1
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(Math.max(variance, 0))
}

function formatSummarySpread(metric: DashboardMetric, value: number): string {
  const [min, max] = metric.range
  if (max - min <= 25 || Math.abs(value) < 10) return value.toFixed(2)
  return value.toFixed(1)
}

function formatBoxMetric(metric: DashboardMetric) {
  const values = [...metric.distribution].sort((a, b) => a - b)
  const min = values[0] ?? metric.range[0]
  const max = values[values.length - 1] ?? metric.range[1]
  const q1 = quantile(values, 0.25)
  const median = quantile(values, 0.5)
  const q3 = quantile(values, 0.75)
  return { min, q1, median, q3, max }
}

function histogramBarColors(metric: DashboardMetric, length: number): string[] {
  return Array.from({ length }, (_, index) => {
    const opacity = 0.35 + (index / Math.max(length - 1, 1)) * 0.55
    const hex = metric.accent.replace('#', '')
    const bigint = Number.parseInt(hex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`
  })
}

function buildHistogramTicks(metric: DashboardMetric): number[] {
  const [min, max] = metric.range
  const step = getHistogramStep(metric)
  const tickCount = Math.max(1, Math.ceil((max - min) / step))
  return Array.from({ length: tickCount + 1 }, (_, index) => Math.min(max, min + step * index))
}

function BrainCard({ metric }: { metric: DashboardMetric }) {
  const topRegions = metric.topRegions.slice(0, 3)

  return (
    <div className='relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-slate-50/75 p-2 shadow-sm'>
      <div
        className='pointer-events-none absolute inset-x-10 top-5 h-24 rounded-full blur-3xl'
        style={{ background: `radial-gradient(circle, ${metric.accentSoft}, transparent 72%)` }}
      />
      <div className='relative'>
        <div>
          <h2 className='text-base font-semibold text-slate-950'>Top Brain Regions</h2>
        </div>
      </div>

      <div className='relative mt-2 flex min-h-0 flex-1 flex-col justify-evenly gap-2'>
        {topRegions.length > 0 ? (
          topRegions.map((region, index) => (
            <div key={region.name} className='flex min-h-[3rem] items-center rounded-[0.95rem] border border-slate-200/80 bg-white/80 px-2.5 py-1.5 shadow-sm'>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                  <span
                    className='inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm'
                    style={{ background: metric.accent }}
                  >
                    {index + 1}
                  </span>
                  <span className='text-[12px] font-medium text-slate-900'>{region.name}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className='flex min-h-0 flex-1 items-center justify-center rounded-[0.95rem] border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-center text-[12px] text-slate-500'>
            No participant-level brain-region explanation is available for this metric yet.
          </div>
        )}
      </div>
    </div>
  )
}

function BoxplotStrip({ metric }: { metric: DashboardMetric }) {
  const stats = formatBoxMetric(metric)
  const [minRange, maxRange] = metric.range
  const span = Math.max(maxRange - minRange, 1)
  const toPercent = (value: number) => ((value - minRange) / span) * 100

  return (
    <div className='rounded-[1.15rem] border border-slate-200/80 bg-white/78 p-2.5 shadow-sm'>
      <div className='mb-1.5'>
        <div>
          <p className='text-[12px] font-semibold text-slate-950'>{metric.label}</p>
          <p className='text-[11px] text-slate-500'>
            {formatMetricValue(metric, metric.range[0])} - {formatMetricValue(metric, metric.range[1])}
          </p>
        </div>
      </div>

      <div className='relative mt-3 h-9'>
        <div className='absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-slate-200' />
        <div
          className='absolute top-1/2 z-10 h-5 -translate-y-1/2 border'
          style={{
            left: `${toPercent(stats.q1)}%`,
            width: `${Math.max(toPercent(stats.q3) - toPercent(stats.q1), 0)}%`,
            background: `${metric.accent}55`,
            borderColor: `${metric.accent}55`,
            boxShadow: `0 10px 26px ${metric.accent}22`,
          }}
        />
        <div
          className='absolute top-1/2 z-20 h-6 w-[3px] -translate-y-1/2 rounded-full bg-slate-600'
          style={{ left: `${toPercent(stats.median)}%` }}
        />
        <div
          className='absolute top-1/2 h-[2px] -translate-y-1/2 bg-slate-400'
          style={{
            left: `${toPercent(stats.min)}%`,
            width: `${Math.max(toPercent(stats.q1) - toPercent(stats.min), 1)}%`,
          }}
        />
        <div
          className='absolute top-1/2 h-[2px] -translate-y-1/2 bg-slate-400'
          style={{
            left: `${toPercent(stats.q3)}%`,
            width: `${Math.max(toPercent(stats.max) - toPercent(stats.q3), 1)}%`,
          }}
        />
        <div className='absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-slate-500' style={{ left: `${toPercent(stats.min)}%` }} />
        <div className='absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-slate-500' style={{ left: `${toPercent(stats.max)}%` }} />
      </div>

      <div className='mt-1.5 grid grid-cols-5 gap-1.5 text-[11px] text-slate-500'>
        <div className='leading-tight'>
          <span className='block font-medium'>Min:</span>
          <span className='block text-[12px] font-semibold text-slate-700'>{formatMetricValue(metric, stats.min)}</span>
        </div>
        <div className='leading-tight'>
          <span className='block font-medium'>Q1:</span>
          <span className='block text-[12px] font-semibold text-slate-700'>{formatMetricValue(metric, stats.q1)}</span>
        </div>
        <div className='leading-tight'>
          <span className='block font-medium'>Median:</span>
          <span className='block text-[12px] font-semibold text-slate-700'>{formatMetricValue(metric, stats.median)}</span>
        </div>
        <div className='leading-tight'>
          <span className='block font-medium'>Q3:</span>
          <span className='block text-[12px] font-semibold text-slate-700'>{formatMetricValue(metric, stats.q3)}</span>
        </div>
        <div className='leading-tight'>
          <span className='block font-medium'>Max:</span>
          <span className='block text-[12px] font-semibold text-slate-700'>{formatMetricValue(metric, stats.max)}</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [selectedMetricId, setSelectedMetricId] = useState<string>(DASHBOARD_METRICS[0].id)
  const [hasRequestedBackfill, setHasRequestedBackfill] = useState(false)
  const queryClient = useQueryClient()

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => analysisService.getDashboardStats(),
  })

  const dashboardMetrics = useMemo<DashboardMetric[]>(() => {
    const actualMetrics = stats?.dashboard_metrics ?? []
    if (actualMetrics.length === 0) return []

    return actualMetrics.map((metric) => {
      const visual = METRIC_VISUALS[metric.id]
      const fallback = DASHBOARD_METRICS.find((item) => item.id === metric.id)
      return {
        ...metric,
        accent: visual?.accent ?? fallback?.accent ?? '#3B82F6',
        accentSoft: visual?.accentSoft ?? fallback?.accentSoft ?? '#DBEAFE',
        insight: metric.insight || fallback?.insight || '',
        topRegions: metric.topRegions ?? [],
      }
    })
  }, [stats?.dashboard_metrics])

  const selectedMetric = useMemo(
    () => dashboardMetrics.find((metric) => metric.id === selectedMetricId) ?? dashboardMetrics[0],
    [dashboardMetrics, selectedMetricId]
  )

  useEffect(() => {
    if (!dashboardMetrics.some((metric) => metric.id === selectedMetricId) && dashboardMetrics[0]) {
      setSelectedMetricId(dashboardMetrics[0].id)
    }
  }, [dashboardMetrics, selectedMetricId])

  useEffect(() => {
    if (hasRequestedBackfill || !stats) return
    const hasCompletedHistory = (stats.completed_analyses ?? 0) > 0
    const hasDashboardMetrics = (stats.dashboard_metrics?.length ?? 0) > 0
    const hasMissingTopRegions = (stats.dashboard_metrics ?? []).some(
      (metric) => !metric.topRegions || metric.topRegions.length === 0
    )
    if (!hasCompletedHistory) return
    if (hasDashboardMetrics && !hasMissingTopRegions) return

    setHasRequestedBackfill(true)
    void analysisService.backfillDashboardSummaries()
      .then(() => queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }))
      .catch(() => undefined)
  }, [hasRequestedBackfill, queryClient, stats])

  const histogramData = useMemo(() => (selectedMetric ? buildHistogram(selectedMetric) : []), [selectedMetric])
  const histogramTicks = useMemo(() => (selectedMetric ? buildHistogramTicks(selectedMetric) : []), [selectedMetric])
  const histogramColors = useMemo(
    () => (selectedMetric ? histogramBarColors(selectedMetric, histogramData.length) : []),
    [histogramData.length, selectedMetric]
  )

  const safeStats = {
    totalUploads: stats?.total_uploads ?? 0,
    completed: stats?.completed_analyses ?? 0,
    pending: stats?.pending_analyses ?? 0,
    avgProcessingTime: stats?.avg_processing_time ?? 6.8,
    recentUploads: stats?.recent_uploads ?? [],
  }

  const cohortSize = Math.max(
    safeStats.completed,
    safeStats.totalUploads,
    safeStats.recentUploads.length
  )

  const successRate =
    safeStats.totalUploads > 0 ? Math.round((safeStats.completed / safeStats.totalUploads) * 100) : 0
  void successRate  // silence noUnusedLocals

  if (!selectedMetric) {
    return (
      <div className='page-container'>
        <div className='flex items-center justify-center py-16'>
          <div className='text-center'>
            <div className='loading-spinner mx-auto mb-3' />
            <p className='text-ink-800'>Loading neuroanalytics dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage =
      error instanceof ServiceError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to load dashboard metrics. Please try again.'

    return (
      <div className='page-container'>
        <div className='status-banner status-banner-error'>
          <p>{errorMessage}</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='page-container'>
        <div className='flex items-center justify-center py-16'>
          <div className='text-center'>
            <div className='loading-spinner mx-auto mb-3' />
            <p className='text-ink-800'>Loading neuroanalytics dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-[1.9rem] border border-slate-200/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
      <header className='bg-[linear-gradient(180deg,rgba(245,248,255,0.96),rgba(239,244,255,0.92))] px-4 py-3 sm:px-4.5'>
        <h1 className='font-display text-[1.32rem] font-semibold text-slate-950 sm:text-[1.42rem]'>
            Group Brain Behavior Prediction Dashboard
        </h1>
        <p className='mt-0.5 text-[12px] text-slate-600'>
          Group-level behavioral prediction analysis from functional brain connectivity patterns.
        </p>
      </header>

      <section className='bg-white p-4 sm:p-4.5'>
        <div className='space-y-2.5'>
          <div className='grid gap-2 xl:grid-cols-[minmax(0,1fr)_10rem] xl:items-stretch'>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
              {dashboardMetrics.map((metric) => {
                const active = metric.id === selectedMetric.id
                const std = metric.summaryStd ?? standardDeviation(metric.distribution)
                const variance = metric.summaryVariance ?? std * std
                return (
                  <button
                    key={metric.id}
                    type='button'
                    onClick={() => setSelectedMetricId(metric.id)}
                    className={`group relative overflow-hidden rounded-[1.05rem] border px-2.5 py-2 text-left transition-all duration-300 ${
                      active
                        ? 'shadow-[0_14px_26px_rgba(109,94,252,0.14)]'
                        : 'border-slate-200/80 bg-white text-slate-900 shadow-sm hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-md'
                    }`}
                    style={
                      active
                        ? {
                            borderColor: `${metric.accent}55`,
                            background: `linear-gradient(180deg, ${metric.accentSoft}, rgba(255,255,255,0.96))`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className='pointer-events-none absolute inset-0 opacity-90'
                      style={{
                        background: active
                          ? `radial-gradient(circle at top right, ${metric.accentSoft}, transparent 58%)`
                          : `radial-gradient(circle at top left, ${metric.accentSoft}, transparent 60%)`,
                      }}
                    />
                    <div className='relative'>
                      <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${active ? 'text-slate-700' : 'text-slate-500'}`}>
                          {metric.label}
                        </p>
                      </div>
                      <div className='mt-2 grid grid-cols-[minmax(0,1fr)_4rem] gap-3'>
                        <div>
                          <p className='text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500'>AVG ± SD</p>
                          <p className='mt-0.5 text-[1.2rem] font-semibold leading-none text-slate-950'>
                            <span style={{ color: metric.accent }}>{formatMetricValue(metric, metric.average)}</span>
                            {' '}± {formatSummarySpread(metric, std)}
                          </p>
                        </div>
                        <div className='text-right'>
                          <p className='text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500'>VAR</p>
                          <p className='mt-0.5 text-[1.2rem] font-semibold leading-none text-slate-900'>
                            {formatSummarySpread(metric, variance)}
                          </p>
                        </div>
                      </div>

                    <div className='relative mt-1.5 flex items-center justify-between'>
                      <p className={`text-[10px] ${active ? 'text-slate-600' : 'text-slate-500'}`}>
                        Avg prediction ({formatMetricValue(metric, metric.range[0])} to {formatMetricValue(metric, metric.range[1])})
                      </p>
                      <span
                        className='inline-flex h-2 w-2 rounded-full shadow-[0_0_16px_currentColor]'
                        style={{ color: metric.accent, backgroundColor: metric.accent }}
                      />
                    </div>
                    <div className='relative mt-1.5 h-1 overflow-hidden rounded-full bg-white/70'>
                      <div
                        className='h-full rounded-full'
                        style={{
                          width: `${Math.max(18, ((metric.average - metric.range[0]) / Math.max(metric.range[1] - metric.range[0], 1)) * 100)}%`,
                          background: `linear-gradient(90deg, ${metric.accent}, ${metric.accent}cc)`,
                        }}
                      />
                    </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className='grid gap-2'>
              <div className='flex h-full flex-col rounded-[1rem] border border-slate-200/80 bg-slate-50/75 px-2.5 py-2 shadow-sm'>
                <p className='text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500'>Total Subjects</p>
                <div className='mt-4 flex items-end justify-between gap-3'>
                  <p className='text-[1.8rem] font-semibold leading-none text-slate-950'>{cohortSize}</p>
                  <Users className='h-8 w-8 text-violet-500' />
                </div>
                <p className='mt-auto pt-5 text-[11px] text-slate-500'>Uploaded subjects</p>
              </div>
            </div>
          </div>

          <div className='grid gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] xl:auto-rows-fr'>
            <div className='rounded-[1.5rem] border border-slate-200/80 bg-slate-50/75 p-2.5 shadow-sm'>
              <div className='mb-1.5 flex flex-wrap items-start justify-between gap-2'>
                <div>
                  <h2 className='text-base font-semibold text-slate-950'>{selectedMetric.label} Distribution</h2>
                </div>
                <div className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600'>
                  Group Prediction Distribution
                </div>
              </div>

              <div className='h-[10.75rem]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={histogramData} margin={{ top: 12, right: 12, left: -12, bottom: 12 }} barCategoryGap={0} barGap={0}>
                    <CartesianGrid stroke='rgba(148,163,184,0.18)' vertical={false} />
                    <XAxis
                      type='number'
                      dataKey='x'
                      domain={selectedMetric.range}
                      ticks={histogramTicks}
                      tickFormatter={(value: number) => formatMetricValue(selectedMetric, value)}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      height={32}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                      contentStyle={{
                        borderRadius: 18,
                        border: '1px solid rgba(226,232,240,0.9)',
                        boxShadow: '0 18px 50px rgba(15,23,42,0.12)',
                        background: 'rgba(255,255,255,0.96)',
                      }}
                      formatter={(value) => [`${value} participants`, 'Count']}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload
                          ? `${payload[0].payload.rangeText} • ${payload[0].payload.percentile}`
                          : ''
                      }
                    />
                    <Bar dataKey='count' radius={[0, 0, 0, 0]} animationDuration={500}>
                      {histogramData.map((entry, index) => (
                        <Cell key={`${entry.x}-${index}`} fill={histogramColors[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>

            <BrainCard metric={selectedMetric} />
          </div>

          <section className='rounded-[1.5rem] border border-slate-200/80 bg-slate-50/75 p-3 shadow-sm'>
            <div className='mb-2.5 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <h2 className='text-base font-semibold text-slate-950'>Prediction Variability Analysis</h2>
    
              </div>
              <div className='flex flex-wrap gap-2 text-[11px] font-medium text-slate-600'>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>Comparison</span>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>Spread</span>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>Distribution</span>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>Percentiles</span>
              </div>
            </div>

            <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-5'>
              {dashboardMetrics.map((metric) => (
                <BoxplotStrip key={metric.id} metric={metric} />
              ))}
            </div>
          </section>

          <section className='grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_18rem]'>
            <div className='rounded-[1.5rem] border border-slate-200/80 bg-slate-50/75 p-3.5 shadow-sm'>
              <div className='mb-3 flex items-center justify-between gap-3'>
                <div>
                  <h2 className='text-lg font-semibold text-slate-950'>Execution Pulse</h2>
                  <p className='mt-0.5 text-[12px] text-slate-600'>Compact operational summary for live neuroanalytics processing.</p>
                </div>
                <Link href='/upload' className='btn-glass-primary'>
                  New upload
                </Link>
              </div>

              <div className='grid gap-2 sm:grid-cols-4'>
                {[
                  { label: 'Uploads', value: safeStats.totalUploads, icon: Users, tint: 'bg-violet-50 text-violet-700' },
                  { label: 'Completed', value: safeStats.completed, icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Pending', value: safeStats.pending, icon: Activity, tint: 'bg-amber-50 text-amber-700' },
                  { label: 'Avg Time', value: `${safeStats.avgProcessingTime}s`, icon: CalendarRange, tint: 'bg-sky-50 text-sky-700' },
                ].map((item) => (
                  <div key={item.label} className='rounded-[1rem] border border-slate-200/80 bg-slate-50/80 p-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500'>{item.label}</p>
                      <item.icon className={`h-4 w-4 rounded-full p-0.5 ${item.tint}`} />
                    </div>
                    <p className='mt-2 text-[1.35rem] font-semibold text-slate-950'>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className='rounded-[1.5rem] border border-slate-200/80 bg-slate-50/75 p-3.5 shadow-sm'>
              <h2 className='text-lg font-semibold text-slate-950'>Recent Runs</h2>
              <div className='mt-3 space-y-2'>
                {safeStats.recentUploads.slice(0, 4).map((upload) => (
                  <div key={upload.upload_id} className='rounded-[1rem] border border-slate-200/80 bg-slate-50/80 px-3 py-2.5'>
                    <p className='truncate text-sm font-medium text-slate-900'>{upload.file_name}</p>
                    <div className='mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-500'>
                      <span>{new Date(upload.uploaded_at).toLocaleDateString()}</span>
                      <span className='rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600'>
                        {upload.status}
                      </span>
                    </div>
                  </div>
                ))}
                {safeStats.recentUploads.length === 0 ? (
                  <div className='rounded-[1.1rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500'>
                    No recent uploads yet. Start with a new fMRI file to populate the dashboard.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
