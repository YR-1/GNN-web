export interface ScatterPoint {
  actual: number
  predicted: number
}

export interface ModelPerformance {
  id: string
  behavioralScore: string
  gnnArchitecture: string
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
    behavioralScore: 'ListSort (Working Memory)',
    gnnArchitecture: 'FBNetGen',
    correlation: 0.3736,
    pValue: 0.0009,
    mse: 9.7145,
    scatterData: generateScatterData(1.2, 0.3736),
  },
  {
    id: 'pmat',
    behavioralScore: 'PMAT (Fluid Intelligence)',
    gnnArchitecture: 'BrainGNN',
    correlation: 0.3893,
    pValue: 0.0172,
    mse: 19.6051,
    scatterData: generateScatterData(2.4, 0.3893),
  },
  {
    id: 'picseq',
    behavioralScore: 'PicSeq (Picture Sequence Memory)',
    gnnArchitecture: 'FBNetGen',
    correlation: 0.325,
    pValue: 0.0009,
    mse: 8.2255,
    scatterData: generateScatterData(3.1, 0.325),
  },
  {
    id: 'emotsupp_unadj',
    behavioralScore: 'Emotional Support (Empathy & Caring)',
    gnnArchitecture: 'T-RegGNN',
    correlation: 0.3465,
    pValue: 0.0111,
    mse: 7.5502,
    scatterData: generateScatterData(5.4, 0.3465),
  },
  {
    id: 'psqi',
    behavioralScore: 'PSQI (Sleep Quality)',
    gnnArchitecture: 'T-RegGNN',
    correlation: 0.222,
    pValue: 0.134,
    mse: 1.9626,
    scatterData: generateScatterData(6.2, 0.222),
  },
]
