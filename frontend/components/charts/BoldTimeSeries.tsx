'use client'

import { useEffect, useRef } from 'react'
import { TimeSeriesPayload } from '@/lib/types'

interface BoldTimeSeriesProps {
  timeSeries?: TimeSeriesPayload
  highlightedTrIndex?: number | null
  title?: string
  subtitle?: string
}

export function BoldTimeSeries({
  timeSeries,
  highlightedTrIndex = null,
  title = 'BOLD Time Series',
  subtitle = 'Real signal from your uploaded file: Global Signal + up to 5 ROI traces.',
}: BoldTimeSeriesProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const hasData =
    !!timeSeries &&
    Array.isArray(timeSeries.tr_index) &&
    Array.isArray(timeSeries.global_signal) &&
    timeSeries.tr_index.length > 0 &&
    timeSeries.global_signal.length > 0 &&
    timeSeries.tr_index.length === timeSeries.global_signal.length

  useEffect(() => {
    if (!plotRef.current || !hasData || !timeSeries) return

    let cancelled = false

<<<<<<< HEAD
    const renderPlot = async () => {
      const { default: Plotly } = await import('plotly.js-dist-min')
      if (cancelled || !plotRef.current) return

      plotlyRef.current = Plotly

      const traces = [
        {
          x: timeSeries.tr_index,
          y: timeSeries.global_signal,
          mode: 'lines' as const,
          name: 'Global Signal',
          line: { width: 2.3, color: '#1d4ed8' },
        },
        ...timeSeries.roi_series.map((roiSeries) => ({
          x: timeSeries.tr_index,
          y: roiSeries.values,
          mode: 'lines' as const,
          name: roiSeries.label || `ROI ${roiSeries.roi_index}`,
          line: { width: 1.4 },
        })),
      ]

      Plotly.newPlot(
        plotRef.current,
        traces,
        {
          title: { text: 'Uploaded fMRI Time Series (Global + First 5 ROIs)', font: { size: 14, color: '#0f172a' } },
          xaxis: { title: { text: 'TR Index', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
          yaxis: { title: { text: 'Signal', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
          legend: { orientation: 'h' as const, y: -0.25, font: { size: 11 } },
          autosize: true,
          margin: { l: 56, r: 20, t: 44, b: 60 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        },
        { responsive: true, displayModeBar: true, displaylogo: false }
      ).catch((err: unknown) => console.error('BOLD plot error:', err))
    }

    void renderPlot()
=======
    Plotly.newPlot(
      plotRef.current,
      traces,
      {
        title: { text: 'Uploaded fMRI Time Series (Global + First 5 ROIs)', font: { size: 14, color: '#0f172a' } },
        xaxis: { title: { text: 'TR Index', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
        yaxis: { title: { text: 'Signal', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
        legend: { orientation: 'h' as const, y: -0.25, font: { size: 11 } },
        autosize: true,
        margin: { l: 56, r: 20, t: 44, b: 60 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        shapes:
          highlightedTrIndex !== null
            ? [
                {
                  type: 'line' as const,
                  x0: highlightedTrIndex,
                  x1: highlightedTrIndex,
                  y0: 0,
                  y1: 1,
                  xref: 'x' as const,
                  yref: 'paper' as const,
                  line: { color: '#f97316', width: 2, dash: 'dot' as const },
                },
              ]
            : [],
      },
      { responsive: true, displayModeBar: true, displaylogo: false }
    ).catch((err: unknown) => console.error('BOLD plot error:', err))
>>>>>>> rq-branch

    return () => {
      cancelled = true
      if (plotRef.current) plotlyRef.current?.purge(plotRef.current)
    }
  }, [hasData, timeSeries])

  if (!hasData) {
    return (
      <div className='surface-card space-y-2'>
        <div>
          <p className='font-semibold text-ink-950 text-sm'>{title}</p>
          <p className='text-[11px] text-ink-700'>
            Uploaded file signal preview
          </p>
        </div>
        <div className='status-banner status-banner-error'>
          <p>Unable to render chart: uploaded time-series is empty or incorrectly formatted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className='surface-card space-y-2'>
      <div>
        <p className='font-semibold text-ink-950 text-sm'>{title}</p>
        <p className='text-[11px] text-ink-700'>{subtitle}</p>
      </div>
      <div
        ref={plotRef}
        style={{ width: '100%', height: '360px' }}
        className='rounded-xl border border-brand-400/20 bg-white/82 overflow-hidden'
      />
    </div>
  )
}
