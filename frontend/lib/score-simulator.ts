import { ScoreDefinition } from './score-registry'

export interface SimulatedScoreResult {
  value: number
  ci95Lower: number
  ci95Upper: number
  source?: 'model' | 'simulated'
  modelFile?: string
  modelArchitecture?: string
  nGraphWindows?: number
  valueScale?: string
  normalizedValue?: number
  targetScaler?: string
}

/**
 * Generate a deterministic simulated prediction score from the correlation
 * matrix. Uses the mean correlation within the score's relevant ROI pairs
 * plus a hash of the score ID for variation. Returns the predicted value
 * along with a 95% confidence interval derived from correlation variance.
 */
export function simulateScore(
  scoreDef: ScoreDefinition,
  correlationMatrix: number[][]
): SimulatedScoreResult {
  const roiSet = new Set(scoreDef.relevantROIs)
  const n = correlationMatrix.length
  let sum = 0
  let sumSq = 0
  let count = 0

  for (const roi1 of roiSet) {
    for (const roi2 of roiSet) {
      const i = roi1 - 1
      const j = roi2 - 1
      if (i >= n || j >= n || i >= j) continue
      const val = correlationMatrix[i][j]
      if (Number.isFinite(val)) {
        sum += val
        sumSq += val * val
        count++
      }
    }
  }

  const meanCorr = count > 0 ? sum / count : 0
  const variance = count > 1 ? (sumSq / count - meanCorr * meanCorr) : 0.04
  const stdCorr = Math.sqrt(Math.max(variance, 0))

  let hash = 0
  for (let c = 0; c < scoreDef.id.length; c++) {
    hash = ((hash << 5) - hash + scoreDef.id.charCodeAt(c)) | 0
  }

  const [lo, hi] = scoreDef.scoreRange
  const range = hi - lo
  const normalized = (Math.tanh(meanCorr * 3 + (hash % 100) / 100) + 1) / 2
  const value = lo + normalized * range

  const ciHalfWidth = stdCorr * 1.96 * range * 0.3
  const ci95Lower = Math.max(lo, value - ciHalfWidth)
  const ci95Upper = Math.min(hi, value + ciHalfWidth)

  return { value, ci95Lower, ci95Upper }
}
