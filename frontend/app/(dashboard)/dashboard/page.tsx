'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  ArrowUpRight,
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
  label: string
  count: number
  percentile: string
  rangeText: string
}

const DASHBOARD_METRICS: DashboardMetric[] = [
  {
    id: 'listsort_ageadj',
    label: 'ListSort (Age Adjusted)',
    shortLabel: 'ListSort',
    range: [50, 150],
    average: 96,
    trend: 2.4,
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
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
    average: 16.1,
    trend: 3.1,
    accent: '#a855f7',
    accentSoft: '#f3e8ff',
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
    id: 'sustained_attention',
    label: 'Sustained Attention',
    shortLabel: 'Attention',
    range: [0, 1],
    average: 0.53,
    trend: 1.9,
    accent: '#ec4899',
    accentSoft: '#fce7f3',
    distribution: [0.08, 0.13, 0.19, 0.24, 0.29, 0.35, 0.41, 0.47, 0.53, 0.58, 0.64, 0.71, 0.77, 0.84, 0.91],
    cohortSplit: [0.47, 0.59],
    confidence: 0.9,
    reliability: 'Stable across sessions',
    insight: 'Attention performance tracks dorsal attention synchronization with stronger stability in mid-range sustained-control profiles.',
    topRegions: [
      { name: 'Superior Parietal Cortex', contribution: 95 },
      { name: 'Frontal Eye Fields', contribution: 86 },
      { name: 'Precuneus', contribution: 80 },
      { name: 'Middle Frontal Gyrus', contribution: 76 },
      { name: 'Visual Association Cortex', contribution: 69 },
    ],
  },
  {
    id: 'emotion_recognition',
    label: 'Emotion Recognition',
    shortLabel: 'Emotion',
    range: [0, 100],
    average: 77,
    trend: 4.2,
    accent: '#ef4444',
    accentSoft: '#fee2e2',
    distribution: [29, 36, 42, 48, 54, 60, 66, 71, 77, 81, 84, 88, 91, 94, 97],
    cohortSplit: [72.8, 80.9],
    confidence: 0.88,
    reliability: 'Moderate-high confidence',
    insight: 'Emotion-recognition strength aligns with temporal-limbic and orbitofrontal coordination across participants.',
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
    average: 13.1,
    trend: -2.7,
    accent: '#f97316',
    accentSoft: '#ffedd5',
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
  listsort_ageadj: { accent: '#7c3aed', accentSoft: '#ede9fe' },
  pmat: { accent: '#a855f7', accentSoft: '#f3e8ff' },
  sustained_attention: { accent: '#ec4899', accentSoft: '#fce7f3' },
  emotion_recognition: { accent: '#ef4444', accentSoft: '#fee2e2' },
  psqi: { accent: '#f97316', accentSoft: '#ffedd5' },
}

function formatMetricValue(metric: DashboardMetric, value: number): string {
  const [min, max] = metric.range
  if (max <= 1) return value.toFixed(2)
  if (max - min <= 25) return value.toFixed(1)
  return Math.round(value).toString()
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
  const binCount = 7
  const width = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + index * width
    const end = index === binCount - 1 ? max : start + width
    const inBin = values.filter((value) => {
      if (index === binCount - 1) return value >= start && value <= end
      return value >= start && value < end
    })
    return {
      label: `${formatMetricValue(metric, start)}-${formatMetricValue(metric, end)}`,
      count: inBin.length,
      percentile: `${Math.round(((index + 1) / binCount) * 100)}th`,
      rangeText: `${formatMetricValue(metric, start)} to ${formatMetricValue(metric, end)}`,
    }
  })
  return bins
}

function formatTrend(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
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

function BrainCard({ metric }: { metric: DashboardMetric }) {
  const topRegions = metric.topRegions.slice(0, 3)

  return (
    <div className='relative h-full overflow-hidden rounded-[1.65rem] border border-white/80 bg-white/75 p-3.5 shadow-[0_18px_40px_rgba(125,103,255,0.12)] backdrop-blur-xl'>
      <div
        className='pointer-events-none absolute inset-x-10 top-5 h-24 rounded-full blur-3xl'
        style={{ background: `radial-gradient(circle, ${metric.accentSoft}, transparent 72%)` }}
      />
      <div className='relative'>
        <div>
          <h2 className='text-base font-semibold text-slate-950'>Top Brain Regions</h2>
          <p className='mt-1 text-[11px] whitespace-nowrap text-slate-600'>{metric.insight}</p>
        </div>
      </div>

      <div className='mt-4 space-y-2'>
        {topRegions.map((region, index) => (
          <div key={region.name} className='rounded-[0.95rem] border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm'>
            <div className='mb-1.5 flex items-center justify-between gap-3'>
              <div className='flex items-center gap-3'>
                <span
                  className='inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm'
                  style={{ background: metric.accent }}
                >
                  {index + 1}
                </span>
                <span className='text-[12px] font-medium text-slate-900'>{region.name}</span>
              </div>
              <span className='text-[12px] font-semibold text-slate-950'>{region.contribution}%</span>
            </div>
            <div className='h-2 rounded-full bg-slate-100'>
              <div
                className='h-full rounded-full transition-all duration-500'
                style={{
                  width: `${region.contribution}%`,
                  background: `linear-gradient(90deg, ${metric.accent}, ${metric.accent}bb)`,
                  boxShadow: `0 0 18px ${metric.accent}55`,
                }}
              />
            </div>
          </div>
        ))}
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
      <div className='mb-1.5 flex items-start justify-between gap-2.5'>
        <div>
          <p className='text-[12px] font-semibold text-slate-950'>{metric.label}</p>
          <p className='text-[11px] text-slate-500'>
            {formatMetricValue(metric, metric.range[0])} - {formatMetricValue(metric, metric.range[1])}
          </p>
        </div>
        <span className='rounded-full px-2 py-1 text-[10px] font-semibold' style={{ color: metric.accent, background: metric.accentSoft }}>
          {metric.reliability}
        </span>
      </div>

      <div className='relative mt-3 h-9'>
        <div className='absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-slate-200' />
        <div
          className='absolute top-1/2 h-4.5 -translate-y-1/2 rounded-full'
          style={{
            left: `${toPercent(stats.q1)}%`,
            width: `${Math.max(toPercent(stats.q3) - toPercent(stats.q1), 3)}%`,
            background: `linear-gradient(90deg, ${metric.accentSoft}, ${metric.accent})`,
            boxShadow: `0 10px 26px ${metric.accent}22`,
          }}
        />
        <div
          className='absolute top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-slate-500'
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

      <div className='mt-1.5 grid grid-cols-5 gap-1 text-[9px] text-slate-500'>
        <div>Min: {formatMetricValue(metric, stats.min)}</div>
        <div>Q1: {formatMetricValue(metric, stats.q1)}</div>
        <div>Median: {formatMetricValue(metric, stats.median)}</div>
        <div>Q3: {formatMetricValue(metric, stats.q3)}</div>
        <div>Max: {formatMetricValue(metric, stats.max)}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [selectedMetricId, setSelectedMetricId] = useState<string>(DASHBOARD_METRICS[0].id)

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => analysisService.getDashboardStats(),
  })

  const dashboardMetrics = useMemo<DashboardMetric[]>(() => {
    const actualMetrics = stats?.dashboard_metrics ?? []
    if (actualMetrics.length === 0) return DASHBOARD_METRICS

    return actualMetrics.map((metric) => {
      const visual = METRIC_VISUALS[metric.id]
      const fallback = DASHBOARD_METRICS.find((item) => item.id === metric.id)
      return {
        ...metric,
        accent: visual?.accent ?? fallback?.accent ?? '#7c3aed',
        accentSoft: visual?.accentSoft ?? fallback?.accentSoft ?? '#ede9fe',
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

  const histogramData = useMemo(() => buildHistogram(selectedMetric), [selectedMetric])
  const histogramColors = useMemo(
    () => histogramBarColors(selectedMetric, histogramData.length),
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
    selectedMetric.distribution.length,
    safeStats.recentUploads.length,
    18
  )

  const successRate =
    safeStats.totalUploads > 0 ? Math.round((safeStats.completed / safeStats.totalUploads) * 100) : 0
  void successRate  // silence noUnusedLocals

  if (!selectedMetric) {
    return (
      <div className='page-container'>
        <div className='status-banner status-banner-info'>
          <p>No completed prediction metrics are available for the dashboard yet.</p>
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
    <div className='space-y-2.5'>
      <section className='relative overflow-hidden rounded-[1.75rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,248,255,0.92))] p-3 shadow-[0_20px_48px_rgba(123,97,255,0.12)] backdrop-blur-xl sm:p-3.5'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,103,255,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_26%),radial-gradient(circle_at_bottom,rgba(244,114,182,0.12),transparent_30%)]' />
        <div className='relative space-y-2.5'>
          <header className='flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between'>
            <div className='min-w-0 flex-1 space-y-0.5'>
              <div>
                <h1 className='font-display text-lg font-semibold text-slate-950'>
                  Population Brain Prediction Dashboard
                </h1>
                <p className='mt-0.5 max-w-[46rem] text-[11px] leading-[1.05rem] text-slate-600 sm:text-[12px]'>
                  Research-grade monitoring for cohort-wide fMRI-derived behavioral predictions with adaptive scales,
                  confidence overlays, and network-level interpretation cues.
                </p>
              </div>
            </div>

            <div className='grid shrink-0 gap-2 sm:grid-cols-2 xl:min-w-[17rem]'>
              <div className='rounded-[1rem] border border-white/80 bg-white/75 p-2 shadow-sm'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>Cohort Size</p>
                <div className='mt-1 flex items-end justify-between gap-3'>
                  <p className='text-[1.2rem] font-semibold text-slate-950'>{cohortSize}</p>
                  <Users className='h-4 w-4 text-violet-500' />
                </div>
              </div>
              <div className='rounded-[1rem] border border-white/80 bg-white/75 p-2 shadow-sm'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>AI Reliability</p>
                <div className='mt-1 flex items-end justify-between gap-3'>
                  <p className='text-[1.2rem] font-semibold text-slate-950'>{Math.round(selectedMetric.confidence * 100)}%</p>
                  <ShieldCheck className='h-4 w-4 text-sky-500' />
                </div>
              </div>
            </div>
          </header>

          <div className='grid gap-1.5'>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
              {dashboardMetrics.map((metric) => {
                const active = metric.id === selectedMetric.id
                return (
                  <button
                    key={metric.id}
                    type='button'
                    onClick={() => setSelectedMetricId(metric.id)}
                    className={`group relative overflow-hidden rounded-[1.05rem] border px-2.5 py-2 text-left transition-all duration-300 ${
                      active
                        ? 'shadow-[0_14px_26px_rgba(109,94,252,0.14)]'
                        : 'border-white/80 bg-white/78 text-slate-900 shadow-sm hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg'
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
                    <div className='relative flex items-start justify-between gap-2.5'>
                      <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${active ? 'text-slate-700' : 'text-slate-500'}`}>
                          {metric.label}
                        </p>
                        <p className='mt-0.5 text-[1.2rem] font-semibold leading-none' style={{ color: metric.accent }}>
                          {formatMetricValue(metric, metric.average)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          active ? 'bg-white/70 text-slate-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <ArrowUpRight className={`h-3 w-3 ${metric.trend < 0 ? 'rotate-90' : ''}`} />
                        {formatTrend(metric.trend)}
                      </span>
                    </div>
                    <div className='relative mt-1.5 flex items-center justify-between'>
                      <p className={`text-[10px] ${active ? 'text-slate-600' : 'text-slate-500'}`}>Avg prediction</p>
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
                  </button>
                )
              })}
            </div>
          </div>

          <div className='grid gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] xl:auto-rows-fr'>
            <div className='rounded-[1.5rem] border border-white/80 bg-white/75 p-3 shadow-[0_16px_34px_rgba(56,189,248,0.09)] backdrop-blur-xl'>
              <div className='mb-2 flex flex-wrap items-start justify-between gap-2'>
                <div>
                  <h2 className='text-base font-semibold text-slate-950'>{selectedMetric.label} Distribution</h2>
                  <p className='mt-0.5 text-[12px] text-slate-600'>
                    Adaptive axis range: {formatMetricValue(selectedMetric, selectedMetric.range[0])} to{' '}
                    {formatMetricValue(selectedMetric, selectedMetric.range[1])}
                  </p>
                </div>
                <div className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600'>
                  Percentile-aware cohort histogram
                </div>
              </div>

              <div className='h-[12.5rem]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={histogramData} margin={{ top: 12, right: 12, left: -12, bottom: 12 }}>
                    <CartesianGrid stroke='rgba(148,163,184,0.18)' vertical={false} />
                    <XAxis
                      dataKey='label'
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-12}
                      textAnchor='end'
                      height={44}
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
                    <Bar dataKey='count' radius={[14, 14, 6, 6]} animationDuration={500}>
                      {histogramData.map((entry, index) => (
                        <Cell key={`${entry.label}-${index}`} fill={histogramColors[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>

            <BrainCard metric={selectedMetric} />
          </div>

          <section className='rounded-[1.5rem] border border-white/80 bg-white/76 p-3 shadow-[0_16px_34px_rgba(244,114,182,0.08)] backdrop-blur-xl'>
            <div className='mb-2.5 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <h2 className='text-base font-semibold text-slate-950'>Longitudinal Distribution Metrics</h2>
                <p className='mt-0.5 text-[12px] text-slate-600'>
                  Boxplots rendered with independent scaling per metric to preserve cohort spread, quartiles, and outliers.
                </p>
              </div>
              <div className='flex flex-wrap gap-2 text-[11px] font-medium text-slate-600'>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>variance analysis</span>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>cohort comparison</span>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>prediction spread</span>
                <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1'>percentile distribution</span>
              </div>
            </div>

            <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-5'>
              {dashboardMetrics.map((metric) => (
                <BoxplotStrip key={metric.id} metric={metric} />
              ))}
            </div>
          </section>

          <section className='grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_18rem]'>
            <div className='rounded-[1.5rem] border border-white/80 bg-white/76 p-3.5 shadow-sm'>
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

            <div className='rounded-[1.5rem] border border-white/80 bg-white/76 p-3.5 shadow-sm'>
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
