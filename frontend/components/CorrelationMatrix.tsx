'use client'

import { useEffect, useRef } from 'react'
import { CorrelationResults } from '@/lib/types'

interface CorrelationMatrixProps {
  data: CorrelationResults
  fileName: string
  title?: string
  subtitle?: string
}

export default function CorrelationMatrix({
  data,
  fileName,
  title = 'Correlation Matrix',
  subtitle,
}: CorrelationMatrixProps) {
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

  useEffect(() => {
    if (!plotRef.current) return

    let cancelled = false

    const renderPlot = async () => {
      const { default: Plotly } = await import('plotly.js-dist-min')
      if (cancelled || !plotRef.current) return

      plotlyRef.current = Plotly

      const fallbackPlotlyJson = {
        data: [
          {
            z: data.correlation_matrix,
            type: 'heatmap',
            colorscale: 'RdBu',
            zmid: 0,
            zmin: -1,
            zmax: 1,
            colorbar: { title: 'Correlation' },
          },
        ],
        layout: {},
      }
      const plotlyJson = data.plotly_json ?? fallbackPlotlyJson
      const baseLayout = (plotlyJson.layout ?? {}) as Record<string, unknown>
      const baseXaxis = ((baseLayout.xaxis as Record<string, unknown> | undefined) ?? {})
      const baseYaxis = ((baseLayout.yaxis as Record<string, unknown> | undefined) ?? {})
      const layout = {
        ...baseLayout,
        autosize: true,
        dragmode: 'zoom',
        uirevision: 'correlation-matrix',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        width: undefined,
        margin: { l: 60, r: 100, t: 60, b: 60 },
        xaxis: {
          ...baseXaxis,
          range: [0, 268],
          autorange: false,
          constrain: 'domain',
          fixedrange: false,
        },
        yaxis: {
          ...baseYaxis,
          range: [0, 268],
          autorange: false,
          scaleanchor: 'x',
          scaleratio: 1,
          constrain: 'domain',
          fixedrange: false,
        },
      }

      Plotly.newPlot(plotRef.current, plotlyJson.data ?? [], layout, {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        scrollZoom: false,
        modeBarButtonsToAdd: [
          'zoom2d',
          'pan2d',
          'select2d',
          'lasso2d',
          'zoomIn2d',
          'zoomOut2d',
          'autoScale2d',
          'resetScale2d',
        ],
        modeBarButtonsToRemove: ['sendDataToCloud', 'toggleSpikelines', 'hoverCompareCartesian'],
        toImageButtonOptions: {
          filename: `correlation_matrix_${Date.now()}`,
          format: 'png',
        },
      }).catch((error: unknown) => {
        console.error('Error rendering Plotly chart:', error)
      })
    }

    void renderPlot()

    return () => {
      cancelled = true
      if (plotRef.current) {
        plotlyRef.current?.purge(plotRef.current)
      }
    }
  }, [data, fileName])

  const downloadAsJSON = () => {
    const dataString = JSON.stringify(data, null, 2)
    const blob = new Blob([dataString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `correlation_matrix_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadAsCSV = () => {
    const csvContent = data.correlation_matrix
      .map((row) => row.map((value) => value.toFixed(4)).join('\t'))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `correlation_matrix_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const setDragMode = (mode: 'zoom' | 'pan' | 'select' | 'lasso') => {
    if (!plotRef.current || !plotlyRef.current) return
    plotlyRef.current.relayout(plotRef.current, { dragmode: mode }).catch((error: unknown) => {
      console.error('Error switching drag mode:', error)
    })
  }

  const resetView = () => {
    if (!plotRef.current || !plotlyRef.current) return
    plotlyRef.current.relayout(plotRef.current, {
      'xaxis.range': [0, 268],
      'xaxis.autorange': false,
      'yaxis.range': [0, 268],
      'yaxis.autorange': false,
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
      filename: `correlation_matrix_${Date.now()}`,
    }).catch((error: unknown) => {
      console.error('Error exporting PNG:', error)
    })
  }

  return (
    <div className='surface-card h-full flex flex-col pt-4'>
      {title || subtitle ? (
        <header>
          {title ? <h2 className='font-display text-lg text-ink-950'>{title}</h2> : null}
          <p className='text-xs text-ink-700 mt-0.5'>
            {subtitle ?? (
              <>
                {data.n_rois} ROIs &middot; {data.n_timepoints} timepoints &middot; <span className='mono-data'>{fileName}</span>
              </>
            )}
          </p>
        </header>
      ) : null}

      <div className={`${title || subtitle ? 'mt-4 ' : ''}rounded-xl border border-brand-400/20 bg-white/82 overflow-hidden`}>
        <div ref={plotRef} style={{ width: '100%', height: '400px', margin: '0 auto' }} />
      </div>
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
