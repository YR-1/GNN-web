'use client'

import { useEffect, useRef } from 'react'
import { TimeSeriesPayload } from '@/lib/types'
import { loadPlotly } from '@/lib/load-plotly'

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
  subtitle = 'Global Signal = average across all ROIs; top 5 ROI traces by signal variability.',
}: BoldTimeSeriesProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const downloadButtonStyle = {
    backgroundColor: '#949bad',
    borderColor: '#949bad',
    color: '#ffffff',
  } as const
  const getCurrentRanges = () => {
    const plotEl = plotRef.current as unknown as {
      _fullLayout?: {
        xaxis?: { range?: [number, number] }
        yaxis?: { range?: [number, number] }
      }
    } | null

    return {
      xRange: plotEl?._fullLayout?.xaxis?.range,
      yRange: plotEl?._fullLayout?.yaxis?.range,
    }
  }
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

    const renderPlot = async () => {
      const Plotly = await loadPlotly()
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
          name: `ROI ${roiSeries.roi_index}`,
          line: { width: 1.4 },
        })),
      ]

      Plotly.newPlot(
        plotRef.current,
        traces,
        {
          title: { text: 'Uploaded fMRI Time Series (Global Signal + Top 5 Variable ROIs)', font: { size: 16, color: '#0f172a' } },
          xaxis: { title: { text: 'TR Index', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
          yaxis: { title: { text: 'Signal', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
          legend: { orientation: 'h' as const, y: -0.25, font: { size: 11 } },
          autosize: true,
          dragmode: 'zoom' as const,
          uirevision: 'time-series-graph',
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
        { responsive: true, displayModeBar: false, displaylogo: false }
      ).catch((err: unknown) => console.error('BOLD plot error:', err))
    }

    void renderPlot()

    return () => {
      cancelled = true
      if (plotRef.current) plotlyRef.current?.purge(plotRef.current)
    }
  }, [hasData, highlightedTrIndex, timeSeries])

  const setDragMode = (mode: 'zoom' | 'pan' | 'select' | 'lasso') => {
    if (!plotRef.current || !plotlyRef.current) return
    plotlyRef.current.relayout(plotRef.current, { dragmode: mode }).catch((error: unknown) => {
      console.error('Error switching drag mode:', error)
    })
  }

  const resetView = () => {
    if (!plotRef.current || !plotlyRef.current) return
    plotlyRef.current.relayout(plotRef.current, {
      'xaxis.autorange': true,
      'yaxis.autorange': true,
      dragmode: 'zoom',
      selections: [],
    }).catch((error: unknown) => {
      console.error('Error resetting plot view:', error)
    })
  }

  const zoomBy = (factor: number) => {
    if (!plotRef.current || !plotlyRef.current) return
    const { xRange, yRange } = getCurrentRanges()
    if (!xRange || !yRange) {
      resetView()
      return
    }

    const xCenter = (xRange[0] + xRange[1]) / 2
    const yCenter = (yRange[0] + yRange[1]) / 2
    const xHalfSpan = ((xRange[1] - xRange[0]) * factor) / 2
    const yHalfSpan = ((yRange[1] - yRange[0]) * factor) / 2

    plotlyRef.current.relayout(plotRef.current, {
      'xaxis.range': [xCenter - xHalfSpan, xCenter + xHalfSpan],
      'yaxis.range': [yCenter - yHalfSpan, yCenter + yHalfSpan],
    }).catch((error: unknown) => {
      console.error('Error applying zoom:', error)
    })
  }

  const downloadAsPNG = () => {
    if (!plotRef.current || !plotlyRef.current) return
    plotlyRef.current.downloadImage(plotRef.current, {
      format: 'png',
      filename: `bold_time_series_${Date.now()}`,
    }).catch((error: unknown) => {
      console.error('Error exporting PNG:', error)
    })
  }

  const downloadAsJSON = () => {
    if (!timeSeries) return
    const dataString = JSON.stringify(timeSeries, null, 2)
    const blob = new Blob([dataString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bold_time_series_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadAsCSV = () => {
    if (!timeSeries) return
    const header = ['TR Index', 'Global Signal', ...timeSeries.roi_series.map((series) => `ROI ${series.roi_index}`)]
    const rows = timeSeries.tr_index.map((tr, index) => [
      tr,
      timeSeries.global_signal[index],
      ...timeSeries.roi_series.map((series) => series.values[index]),
    ])
    const csvContent = [header.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bold_time_series_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!hasData) {
    return (
      <div className='surface-card h-full flex flex-col pt-4'>
        <div>
          <p className='font-display text-lg text-ink-950'>{title}</p>
          <p className='text-xs text-ink-700 mt-0.5'>
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
    <div className='surface-card h-full flex flex-col pt-4'>
      {title || subtitle ? (
        <div>
          {title ? <p className='font-display text-lg text-ink-950'>{title}</p> : null}
          {subtitle ? <p className='text-xs text-ink-700 mt-0.5'>{subtitle}</p> : null}
        </div>
      ) : null}
      <div
        ref={plotRef}
        style={{ width: '100%', height: '400px' }}
        className={`${title || subtitle ? 'mt-4 ' : ''}rounded-xl border border-brand-400/20 bg-white/82 overflow-hidden`}
      />
      <div className='mt-auto pt-4'>
        <div className='flex flex-wrap gap-2'>
          <button type='button' onClick={() => zoomBy(0.8)} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>Zoom In</button>
          <button type='button' onClick={() => zoomBy(1.25)} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>Zoom Out</button>
          <button type='button' onClick={() => setDragMode('pan')} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>Pan</button>
          <button type='button' onClick={() => setDragMode('select')} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>Box Select</button>
          <button type='button' onClick={() => setDragMode('lasso')} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>Lasso</button>
          <button type='button' onClick={resetView} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>Home / Reset</button>
          <button type='button' onClick={downloadAsPNG} className='btn-secondary text-xs px-3 py-1.5 gap-1.5'>PNG</button>
        </div>
        <div className='mt-4 flex gap-2'>
          <button
            type='button'
            onClick={downloadAsJSON}
            className='btn-secondary text-xs px-3 py-1.5 gap-1.5'
            style={downloadButtonStyle}
          >
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' className='h-3.5 w-3.5' aria-hidden='true'>
              <path d='M12 4v9' strokeLinecap='round' />
              <path d='M8.5 9.5 12 13l3.5-3.5' strokeLinecap='round' strokeLinejoin='round' />
              <path d='M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
            <span>JSON</span>
          </button>
          <button
            type='button'
            onClick={downloadAsCSV}
            className='btn-secondary text-xs px-3 py-1.5 gap-1.5'
            style={downloadButtonStyle}
          >
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' className='h-3.5 w-3.5' aria-hidden='true'>
              <path d='M12 4v9' strokeLinecap='round' />
              <path d='M8.5 9.5 12 13l3.5-3.5' strokeLinecap='round' strokeLinejoin='round' />
              <path d='M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
            <span>CSV</span>
          </button>
        </div>
      </div>
    </div>
  )
}
