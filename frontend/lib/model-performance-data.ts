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
    id: 'wm',
    behavioralScore: 'Working Memory',
    correlation: 0.882,
    pValue: 0.00041,
    mse: 3.28,
    scatterData: generateScatterData(1.2, 0.882),
  },
  {
    id: 'fluid_iq',
    behavioralScore: 'Fluid Intelligence',
    correlation: 0.844,
    pValue: 0.00073,
    mse: 3.71,
    scatterData: generateScatterData(2.4, 0.844),
  },
  {
    id: 'attention',
    behavioralScore: 'Sustained Attention',
    correlation: 0.806,
    pValue: 0.00124,
    mse: 4.09,
    scatterData: generateScatterData(3.1, 0.806),
  },
  {
    id: 'processing_speed',
    behavioralScore: 'Processing Speed',
    correlation: 0.793,
    pValue: 0.00192,
    mse: 4.42,
    scatterData: generateScatterData(4.7, 0.793),
  },
  {
    id: 'emotion',
    behavioralScore: 'Emotion Recognition',
    correlation: 0.769,
    pValue: 0.00215,
    mse: 4.85,
    scatterData: generateScatterData(5.4, 0.769),
  },
  {
    id: 'executive',
    behavioralScore: 'Executive Function',
    correlation: 0.747,
    pValue: 0.00301,
    mse: 5.13,
    scatterData: generateScatterData(6.2, 0.747),
  },
  {
    id: 'language',
    behavioralScore: 'Language Fluency',
    correlation: 0.701,
    pValue: 0.00388,
    mse: 5.62,
    scatterData: generateScatterData(7.6, 0.701),
  },
  {
    id: 'social',
    behavioralScore: 'Social Cognition',
    correlation: 0.662,
    pValue: 0.00462,
    mse: 6.02,
    scatterData: generateScatterData(8.8, 0.662),
  },
]
