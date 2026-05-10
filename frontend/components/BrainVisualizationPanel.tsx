'use client'

import { useMemo, useState } from 'react'
import { SCORE_CATEGORIES, SCORE_REGISTRY, getScoresByCategory, ScoreDefinition } from '@/lib/score-registry'
import { SimulatedScoreResult } from '@/lib/score-simulator'
import { computeScoreTopLinks } from '@/lib/score-links'
import { ConnectomeLink } from '@/lib/types'
import { getROIInfo } from '@/lib/shen268-labels'

interface BrainVisualizationPanelProps {
  predictedValues: Record<string, SimulatedScoreResult>
  correlationMatrix: number[][]
  connectomeHtml?: string | null
  selectedScoreId: string | null
  onSelectScore: (scoreId: string) => void
}

const TOP_K_OPTIONS = [3, 5, 10, 20, 50]

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

function formatPredictionUnit(scoreDef: ScoreDefinition, valueScale?: string): string {
  if (valueScale === 'normalized') return 'normalized'
  return scoreDef.unit
}

function sourceBadgeClass(source?: string): string {
  return source === 'model'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300/80'
    : 'bg-amber-100 text-amber-800 border-amber-300/80'
}

const linkBadgeClass = (link: ConnectomeLink) =>
  link.sign === 'positive'
    ? 'bg-rose-100 text-rose-800 border-rose-300/70'
    : 'bg-blue-100 text-blue-800 border-blue-300/70'

export default function BrainVisualizationPanel({
  predictedValues,
  correlationMatrix,
  connectomeHtml,
  selectedScoreId,
  onSelectScore,
}: BrainVisualizationPanelProps) {
  const [topK, setTopK] = useState(10)
  const [minR, setMinR] = useState(0)
  const [showDetails, setShowDetails] = useState(false)

  const selectedScore = useMemo(
    () => SCORE_REGISTRY.find((s) => s.id === selectedScoreId) ?? null,
    [selectedScoreId]
  )

  const topLinks = useMemo(() => {
    if (!selectedScore) return []
    return computeScoreTopLinks(correlationMatrix, selectedScore, topK, minR)
  }, [correlationMatrix, selectedScore, topK, minR])

  const relevantLobes = useMemo(() => {
    if (!selectedScore) return []
    const lobes = new Set<string>()
    for (const roi of selectedScore.relevantROIs) {
      const info = getROIInfo(roi)
      if (info) lobes.add(`${info.hemisphere} ${info.lobe}`)
    }
    return Array.from(lobes).sort()
  }, [selectedScore])

  const result = selectedScore ? predictedValues[selectedScore.id] : null

  return (
    <div className='surface-card space-y-3'>
      {/* Score selector tabs */}
      <div className='space-y-2'>
        {SCORE_CATEGORIES.map((category) => {
          const scores = getScoresByCategory(category.id)
          if (scores.length === 0) return null
          return (
            <div key={category.id} className='flex flex-wrap items-center gap-1.5'>
              <span className='text-[10px] uppercase tracking-wider text-ink-600 font-semibold w-16 shrink-0'>
                {category.label}
              </span>
              {scores.map((scoreDef) => {
                const sv = predictedValues[scoreDef.id]
                const isActive = selectedScoreId === scoreDef.id
                return (
                  <button
                    key={scoreDef.id}
                    type='button'
                    onClick={() => onSelectScore(scoreDef.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition border ${
                      isActive
                        ? 'bg-white border-brand-500/40 shadow-sm text-ink-950'
                        : 'bg-white/50 border-brand-400/20 text-ink-700 hover:bg-white/80'
                    }`}
                  >
                    <span
                      className='w-2 h-2 rounded-full shrink-0'
                      style={{ background: scoreDef.accentColor }}
                    />
                    <span>{scoreDef.shortName}</span>
                    {sv && (
                      <>
                        <span className='font-semibold' style={{ color: scoreDef.accentColor }}>
                          {formatPredictionValue(sv.value, scoreDef, sv.valueScale)}
                        </span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${sourceBadgeClass(sv.source)}`}>
                          {sv.source === 'model' ? 'Model' : 'Sim'}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Selected score summary */}
      {selectedScore && result && (
        <div className='flex items-baseline justify-between border-t border-brand-400/10 pt-2'>
          <div>
            <p className='text-sm font-semibold text-ink-950'>{selectedScore.name}</p>
            <p className='text-[11px] text-ink-600'>{selectedScore.description}</p>
            <p className='mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-600'>
              <span className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${sourceBadgeClass(result.source)}`}>
                {result.source === 'model' ? 'Model prediction' : 'Simulated fallback'}
              </span>
              {result.modelFile && <span>File: {result.modelFile}</span>}
              {result.modelArchitecture && <span>Architecture: {result.modelArchitecture}</span>}
              {result.nGraphWindows && <span>Windows: {result.nGraphWindows}</span>}
              {result.normalizedValue !== undefined && result.valueScale === 'original' && (
                <span>Normalized: {result.normalizedValue.toFixed(3)}</span>
              )}
            </p>
          </div>
          <div className='text-right shrink-0'>
            <span className='text-xl font-semibold' style={{ color: selectedScore.accentColor }}>
              {formatPredictionValue(result.value, selectedScore, result.valueScale)}
            </span>
            <span className='text-xs text-ink-600 ml-1'>
              {formatPredictionUnit(selectedScore, result.valueScale)}
            </span>
            <p className='text-[10px] text-ink-600'>
              95% CI: {formatPredictionValue(result.ci95Lower, selectedScore, result.valueScale)} - {formatPredictionValue(result.ci95Upper, selectedScore, result.valueScale)}
            </p>
          </div>
        </div>
      )}

      {/* 3D Connectome */}
      <div className='rounded-xl border border-brand-400/20 bg-white/82 overflow-hidden'>
        {connectomeHtml ? (
          <iframe
            title={`Connectome for ${selectedScore?.shortName ?? 'brain'}`}
            srcDoc={connectomeHtml}
            className='w-full border-0'
            style={{ height: '400px' }}
            sandbox='allow-scripts allow-same-origin'
          />
        ) : (
          <div className='flex items-center justify-center h-48 text-sm text-ink-700'>
            Connectome not available
          </div>
        )}
      </div>

      {/* Collapsible details */}
      {selectedScore && (
        <div>
          <button
            type='button'
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs text-ink-600 hover:text-ink-900 transition'
          >
            {showDetails ? 'Hide' : 'Show'} connection details ({topLinks.length} links)
          </button>

          {showDetails && (
            <div className='mt-2 space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <label className='text-xs text-ink-700'>
                  Top&#8209;k:
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className='ml-1 rounded-lg border border-brand-400/25 bg-white/80 px-2 py-1 text-xs text-ink-800'
                  >
                    {TOP_K_OPTIONS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label className='text-xs text-ink-700'>
                  Min |r|:
                  <input
                    type='number'
                    min={0}
                    max={1}
                    step={0.05}
                    value={minR}
                    onChange={(e) => setMinR(Math.max(0, Math.min(1, Number(e.target.value))))}
                    className='ml-1 w-16 rounded-lg border border-brand-400/25 bg-white/80 px-2 py-1 text-xs text-ink-800'
                  />
                </label>
              </div>

              {topLinks.length > 0 ? (
                <div className='rounded-xl border border-brand-400/20 bg-white/85 p-3'>
                  <p className='font-semibold text-ink-900 mb-2 text-sm'>
                    Top {topLinks.length} links for {selectedScore.shortName}
                  </p>
                  <div className='space-y-1.5'>
                    {topLinks.map((link, index) => (
                      <div key={`${link.source_roi}-${link.target_roi}-${index}`} className='flex flex-wrap items-center gap-1.5 text-xs'>
                        <span className='inline-flex rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-white border-brand-400/25 text-ink-800'>
                          #{index + 1}
                        </span>
                        <span className='text-ink-900 font-medium'>
                          {link.source_label} &lt;-&gt; {link.target_label}
                        </span>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${linkBadgeClass(link)}`}>
                          {link.sign}
                        </span>
                        <span className='text-ink-700'>r = {link.weight.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className='text-xs text-ink-600'>No connections above threshold.</p>
              )}

              <p className='text-[10px] text-ink-600'>
                Regions: {relevantLobes.join(', ')} ({selectedScore.relevantROIs.length} ROIs)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

