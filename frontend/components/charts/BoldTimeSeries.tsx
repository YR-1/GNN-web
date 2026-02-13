'use client'

import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import { getROILabel } from '@/lib/shen268-labels'

/** Simulated BOLD signal for 5 key ROIs. Uses a seeded pseudo-random walk to
 *  produce stable, reproducible traces that resemble fMRI BOLD fluctuations. */
const BOLD_ROIS = [10, 45, 102, 180, 250] as const

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateBoldSignal(nTimepoints: number, roiIndex: number): number[] {
  const rand = seededRandom(roiIndex * 137 + 42)
  const signal: number[] = []
  let value = 0
  for (let t = 0; t < nTimepoints; t++) {
    value += (rand() - 0.5) * 0.6
    // Add slow drift
    value += Math.sin(t * 0.04 + roiIndex) * 0.02
    signal.push(value)
  }
  return signal
}

interface BoldTimeSeriesProps {
  nTimepoints: number
}

export function BoldTimeSeries({ nTimepoints }: BoldTimeSeriesProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const points = Math.max(nTimepoints, 100)

  useEffect(() => {
    if (!plotRef.current) return

    const timeAxis = Array.from({ length: points }, (_, i) => i * 2) // TR = 2s

    const traces = BOLD_ROIS.map((roi) => ({
      x: timeAxis,
      y: generateBoldSignal(points, roi),
      mode: 'lines' as const,
      name: getROILabel(roi),
      line: { width: 1.5 },
    }))

    Plotly.newPlot(
      plotRef.current,
      traces,
      {
        title: { text: 'Simulated BOLD Signal (5 ROIs)', font: { size: 14, color: '#0f172a' } },
        xaxis: { title: { text: 'Time (s)', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
        yaxis: { title: { text: 'BOLD signal (a.u.)', font: { size: 12 } }, gridcolor: 'rgba(59,130,246,0.1)' },
        legend: { orientation: 'h' as const, y: -0.25, font: { size: 11 } },
        autosize: true,
        margin: { l: 56, r: 20, t: 44, b: 60 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
      },
      { responsive: true, displayModeBar: true, displaylogo: false }
    ).catch((err: unknown) => console.error('BOLD plot error:', err))

    return () => {
      if (plotRef.current) Plotly.purge(plotRef.current)
    }
  }, [points])

  return (
    <div className='surface-card space-y-2'>
      <div>
        <p className='font-semibold text-ink-950 text-sm'>BOLD Time Series</p>
        <p className='text-[11px] text-ink-700'>
          Simulated fMRI BOLD signal for 5 ROIs over {points} timepoints (TR = 2 s).
        </p>
      </div>
      <div
        ref={plotRef}
        style={{ width: '100%', height: '360px' }}
        className='rounded-xl border border-brand-400/20 bg-white/82 overflow-hidden'
      />
    </div>
  )
}
