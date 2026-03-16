'use client'

import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import { ScatterPoint } from '@/lib/model-performance-data'

interface ScatterPlotProps {
  data: ScatterPoint[]
  title: string
  correlation: number
}

export function ScatterPlot({ data, title, correlation }: ScatterPlotProps) {
  const plotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!plotRef.current || data.length === 0) return

    const xValues = data.map((point) => point.actual)
    const yValues = data.map((point) => point.predicted)
    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)

    Plotly.newPlot(
      plotRef.current,
      [
        {
          x: xValues,
          y: yValues,
          mode: 'markers',
          type: 'scatter',
          name: 'Subjects',
          marker: {
            size: 8,
            color: 'rgba(37, 99, 235, 0.65)',
            line: {
              color: 'rgba(29, 78, 216, 1)',
              width: 1,
            },
          },
        },
        {
          x: [minX, maxX],
          y: [minX, maxX],
          mode: 'lines',
          type: 'scatter',
          name: 'Ideal fit',
          line: {
            color: '#ef4444',
            width: 2,
            dash: 'dash',
          },
          hoverinfo: 'skip',
        },
      ],
      {
        title: { text: title, font: { size: 14, color: '#0f172a' } },
        xaxis: {
          title: { text: 'Actual score' },
          gridcolor: 'rgba(148, 163, 184, 0.25)',
        },
        yaxis: {
          title: { text: 'Predicted score' },
          gridcolor: 'rgba(148, 163, 184, 0.25)',
        },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.03,
            y: 0.95,
            text: `r = ${correlation.toFixed(3)}`,
            showarrow: false,
            font: { size: 12, color: '#0f172a' },
            bgcolor: 'rgba(255,255,255,0.8)',
            bordercolor: 'rgba(148,163,184,0.5)',
            borderwidth: 1,
            borderpad: 4,
          },
        ],
        autosize: true,
        margin: { l: 52, r: 20, t: 44, b: 50 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
      },
      {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
      }
    ).catch((error: unknown) => {
      console.error('Error rendering scatter plot:', error)
    })

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current)
      }
    }
  }, [data, title, correlation])

  return (
    <div
      ref={plotRef}
      style={{ width: '100%', height: '360px' }}
      className='rounded-xl border border-brand-400/20 bg-white/80 overflow-hidden'
    />
  )
}
