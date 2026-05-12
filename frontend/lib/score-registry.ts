export type ScoreCategory = 'cognition' | 'emotion'

export interface ScoreDefinition {
  id: string
  name: string
  shortName: string
  category: ScoreCategory
  description: string
  relevantROIs: number[]
  scoreRange: [number, number]
  unit: string
  accentColor: string
}

export const SCORE_CATEGORIES: { id: ScoreCategory; label: string }[] = [
  { id: 'cognition', label: 'Cognition' },
  { id: 'emotion', label: 'Emotion' },
]

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export const SCORE_REGISTRY: ScoreDefinition[] = [
  {
    id: 'listsort_ageadj',
    name: 'ListSort (Age Adjusted)',
    shortName: 'ListSort',
    category: 'cognition',
    description: 'NIH Toolbox List Sorting working memory score (age-adjusted).',
    relevantROIs: [
      ...range(1, 22), ...range(135, 156),
      ...range(44, 62), ...range(178, 196),
      ...range(63, 82), ...range(197, 216),
    ],
    scoreRange: [50, 150],
    unit: 'AgeAdj',
    accentColor: '#2563eb',
  },
  {
    id: 'pmat',
    name: 'PMAT (Fluid Intelligence)',
    shortName: 'PMAT',
    category: 'cognition',
    description: 'Penn Matrix Analysis Test measuring fluid reasoning ability.',
    relevantROIs: [
      ...range(1, 22), ...range(135, 156),
      ...range(44, 62), ...range(178, 196),
    ],
    scoreRange: [0, 24],
    unit: 'correct',
    accentColor: '#3b82f6',
  },
  {
    id: 'picseq',
    name: 'PicSeq (Picture Sequence Memory)',
    shortName: 'PicSeq',
    category: 'cognition',
    description: 'NIH Toolbox Picture Sequence Memory episodic memory score.',
    relevantROIs: [
      ...range(1, 22), ...range(135, 156),
      ...range(63, 82), ...range(197, 216),
      ...range(101, 110), ...range(235, 244),
    ],
    scoreRange: [50, 150],
    unit: 'AgeAdj',
    accentColor: '#0f766e',
  },
  {
    id: 'sustained_attention',
    name: 'Sustained Attention',
    shortName: 'Attention',
    category: 'cognition',
    description: 'Ability to maintain focus over extended periods (gradCPT-based).',
    relevantROIs: [
      ...range(1, 22), ...range(135, 156),
      ...range(23, 38), ...range(157, 172),
      ...range(44, 62), ...range(178, 196),
    ],
    scoreRange: [0, 1],
    unit: 'd-prime',
    accentColor: '#8b5cf6',
  },
  {
    id: 'emotion_recognition',
    name: 'Emotion Recognition',
    shortName: 'Emotion',
    category: 'emotion',
    description: 'Ability to identify emotional expressions in faces.',
    relevantROIs: [
      ...range(101, 110), ...range(235, 244),
      ...range(63, 82), ...range(197, 216),
      ...range(111, 121), ...range(245, 255),
    ],
    scoreRange: [0, 100],
    unit: '% correct',
    accentColor: '#ef4444',
  },
  {
    id: 'sleep_quality',
    name: 'Sleep Quality',
    shortName: 'Sleep',
    category: 'emotion',
    description: 'Pittsburgh Sleep Quality Index (PSQI) derived from brain connectivity.',
    relevantROIs: [
      ...range(101, 110), ...range(235, 244),
      ...range(111, 121), ...range(245, 255),
      ...range(1, 22), ...range(135, 156),
    ],
    scoreRange: [0, 21],
    unit: 'PSQI',
    accentColor: '#10b981',
  },
]

export function getScoresByCategory(category: ScoreCategory): ScoreDefinition[] {
  return SCORE_REGISTRY.filter((s) => s.category === category)
}

export function getScoreById(id: string): ScoreDefinition | undefined {
  return SCORE_REGISTRY.find((s) => s.id === id)
}
