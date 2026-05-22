export type ScoreCategory = 'cognition' | 'emotion'

export interface ScoreDefinition {
  id: string
  name: string
  shortName: string
  category: ScoreCategory
  description: string
  domain?: string
  construct?: string
  variableCode?: string
  measureName?: string
  detail?: string
  interpretation?: string
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
    name: 'ListSort (Working Memory)',
    shortName: 'ListSort',
    category: 'cognition',
    description: 'NIH Toolbox List Sorting working memory score.',
    domain: 'Cognition',
    construct: 'Working memory',
    variableCode: 'ListSort_AgeAdj',
    measureName: 'NIH Toolbox List Sorting Working Memory Test: Age-Adjusted Scale Score',
    detail:
      'This task asks participants to sequence visually and orally presented foods and animals into size order. It measures working memory by combining information processing and short-term storage.',
    interpretation:
      'Higher scores indicate stronger working-memory performance. The age-adjusted score is normed to the participant age band, where 100 is average and 115 or 85 is about 1 SD above or below average.',
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
    domain: 'Cognition',
    construct: 'Fluid intelligence / non-verbal reasoning',
    variableCode: 'PMAT24_A_CR',
    measureName: 'Penn Progressive Matrices: Number of Correct Responses',
    detail:
      'The PMAT presents visual matrix patterns with one missing item. Participants choose the option that best completes the pattern across items of increasing difficulty.',
    interpretation:
      'Higher scores indicate more correct responses and stronger fluid reasoning performance. The main score is the number of correct responses on the abbreviated 24-item task.',
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
    domain: 'Cognition',
    construct: 'Episodic memory',
    variableCode: 'PicSeq_Unadj',
    measureName: 'NIH Toolbox Picture Sequence Memory Test: Unadjusted Scale Score',
    detail:
      'This task measures acquisition, storage, and effortful recall by asking participants to remember and reproduce increasingly long sequences of illustrated objects and activities.',
    interpretation:
      'Higher scores indicate stronger episodic memory. The unadjusted scale score is normed to the adult NIH Toolbox sample, where 100 is average and 115 or 85 is about 1 SD above or below average.',
    relevantROIs: [
      ...range(1, 22), ...range(135, 156),
      ...range(63, 82), ...range(197, 216),
      ...range(101, 110), ...range(235, 244),
    ],
    scoreRange: [50, 150],
    unit: 'Unadj',
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
    id: 'emotsupp_unadj',
    name: 'Emotional Support (Empathy & Care)',
    shortName: 'EmotSupp',
    category: 'emotion',
    description: 'NIH Toolbox Emotional Support Survey unadjusted T-score.',
    domain: 'Emotion',
    construct: 'Social support / perceived emotional support',
    variableCode: 'EmotSupp_Unadj',
    measureName: 'NIH Toolbox Emotional Support Survey: Unadjusted Scale Score',
    detail:
      'This self-report survey measures whether people in the participant social network are perceived as available to listen with empathy, caring, and understanding.',
    interpretation:
      'Higher scores indicate greater perceived emotional support. The unadjusted T-score has mean 50 and SD 10; scores at or below 40 suggest low support, while scores at or above 60 suggest high support.',
    relevantROIs: [
      ...range(101, 110), ...range(235, 244),
      ...range(63, 82), ...range(197, 216),
      ...range(111, 121), ...range(245, 255),
    ],
    scoreRange: [20, 80],
    unit: 'T-score',
    accentColor: '#ef4444',
  },
  {
    id: 'psqi',
    name: 'PSQI (Sleep Quality)',
    shortName: 'PSQI',
    category: 'emotion',
    description: 'Pittsburgh Sleep Quality Index derived from brain connectivity.',
    domain: 'Alertness / sleep',
    construct: 'Sleep quality',
    variableCode: 'PSQI_Score',
    measureName: 'Sleep (Pittsburgh Sleep Questionnaire) Total Score',
    detail:
      'The PSQI total score summarizes responses across the Pittsburgh Sleep Quality Index items to estimate overall sleep quality.',
    interpretation:
      'Higher PSQI scores generally indicate poorer sleep quality, so this score is interpreted in the opposite direction from the cognitive measures.',
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
