export interface ScatterPoint {
  actual: number
  predicted: number
}

export interface ModelPerformance {
  id: string
  behavioralScore: string
  correlation: number
  pValue: number
  mse: number
  scatterData: ScatterPoint[]
}

const generateScatterData = (seed: number, correlation: number): ScatterPoint[] => {
  const points: ScatterPoint[] = []
  const sampleSize = 50

  for (let index = 0; index < sampleSize; index += 1) {
    const actual = 50 + index * 0.9 + Math.sin(index * 0.45 + seed) * 6
    const noiseScale = (1 - correlation) * 14
    const predicted = actual + Math.cos(index * 0.33 + seed * 0.7) * noiseScale
    points.push({ actual, predicted })
  }

  return points
}

export const modelPerformanceData: ModelPerformance[] = [
  {
    id: 'listsort_ageadj',
    behavioralScore: 'ListSort (Age Adjusted)',
    correlation: 0.882,
    pValue: 0.00041,
    mse: 3.28,
    scatterData: generateScatterData(1.2, 0.882),
  },
  {
    id: 'pmat',
    behavioralScore: 'PMAT (Fluid Intelligence)',
    correlation: 0.844,
    pValue: 0.00073,
    mse: 3.71,
    scatterData: generateScatterData(2.4, 0.844),
  },
  {
    id: 'picseq',
    behavioralScore: 'PicSeq (Picture Sequence Memory)',
    correlation: 0.806,
    pValue: 0.00124,
    mse: 4.09,
    scatterData: generateScatterData(3.1, 0.806),
  },
  {
    id: 'emotsupp_unadj',
    behavioralScore: 'EmotSupp (Emotional Support)',
    correlation: 0.769,
    pValue: 0.00215,
    mse: 4.85,
    scatterData: generateScatterData(5.4, 0.769),
  },
  {
    id: 'psqi',
    behavioralScore: 'PSQI (Sleep Quality)',
    correlation: 0.747,
    pValue: 0.00301,
    mse: 5.13,
    scatterData: generateScatterData(6.2, 0.747),
  },
]
