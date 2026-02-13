import { ConnectomeLink } from './types'
import { ScoreDefinition } from './score-registry'
import { getROILabel } from './shen268-labels'

/**
 * Compute top-k links from the correlation matrix, restricted to
 * pairs where BOTH ROIs are in the score's relevantROIs set.
 */
export function computeScoreTopLinks(
  matrix: number[][],
  scoreDef: ScoreDefinition,
  topK: number,
  minR: number = 0
): ConnectomeLink[] {
  const roiSet = new Set(scoreDef.relevantROIs)
  const n = matrix.length
  const pairs: { i: number; j: number; val: number; abs: number }[] = []

  for (let i = 0; i < n; i++) {
    if (!roiSet.has(i + 1)) continue
    for (let j = i + 1; j < n; j++) {
      if (!roiSet.has(j + 1)) continue
      const val = matrix[i][j]
      if (!Number.isFinite(val)) continue
      const abs = Math.abs(val)
      if (abs < minR) continue
      pairs.push({ i, j, val, abs })
    }
  }

  pairs.sort((a, b) => b.abs - a.abs)

  return pairs.slice(0, topK).map((p) => ({
    source_roi: p.i + 1,
    target_roi: p.j + 1,
    weight: p.val,
    abs_weight: p.abs,
    sign: p.val >= 0 ? ('positive' as const) : ('negative' as const),
    source_label: getROILabel(p.i + 1),
    target_label: getROILabel(p.j + 1),
  }))
}
