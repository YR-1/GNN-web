import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BookOpen,
  Brain,
  ChartNetwork,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  FileText,
  Grid3X3,
  HelpCircle,
  Network,
  Rocket,
  Upload,
} from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DocTableOfContents } from '@/components/DocTableOfContents'

/** At-a-glance facts shown in the Overview section. */
const QUICK_FACTS: { icon: LucideIcon; label: string; value: string }[] = [
  { icon: FileText, label: 'Input', value: '.txt, .csv or .tsv' },
  { icon: Grid3X3, label: 'Brain atlas', value: 'Shen 268 regions' },
  { icon: Brain, label: 'Predictions', value: '5 behavioral scores' },
  { icon: Clock, label: 'Typical runtime', value: '30 to 60 seconds' },
]

/** The four stages of the analysis pipeline, in order. */
const PIPELINE_STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Upload, title: 'Upload', text: 'You provide an fMRI ROI time-series file.' },
  {
    icon: Grid3X3,
    title: 'Functional connectivity',
    text: 'Correlations between all 268 regions form a connectivity matrix.',
  },
  {
    icon: ChartNetwork,
    title: 'Brain graph',
    text: 'The matrix becomes a graph: regions are nodes, connections are edges.',
  },
  {
    icon: Brain,
    title: 'GNN prediction',
    text: 'A Graph Neural Network reads the graph and predicts behavioral scores.',
  },
]

/** Model architectures used across the five predicted behavioral scores. */
const MODEL_ARCHITECTURES: {
  name: string
  predicts: string
  approach: string
  explainability: string
  referenceLabel: string
  referenceUrl: string
}[] = [
  {
    name: 'FBNetGen',
    predicts: 'ListSort · PicSeq',
    approach:
      'Applies dynamic graph attention (GAT) across the functional connectome, learning edge-level weights that reflect the predictive relevance of each region-to-region connection. Each sliding window is encoded independently; subject-level predictions are obtained by averaging across windows.',
    explainability:
      'Node importance is derived from four complementary methods — integrated gradients, vanilla saliency, occlusion, and pool-gate attention — aggregated into a consensus z-score across all 268 ROIs.',
    referenceLabel: 'Wayfear/FBNETGEN',
    referenceUrl: 'https://github.com/Wayfear/FBNETGEN',
  },
  {
    name: 'T-RegGNN',
    predicts: 'EmoTSupp · PSQI',
    approach:
      'Applies graph convolution over each windowed connectivity matrix, then aggregates window embeddings using a temporal attention mechanism that learns the relative importance of each time segment. Unlike window-averaging approaches, this preserves the dynamic structure of the resting-state signal.',
    explainability:
      'Node and edge importance are derived from integrated gradients and occlusion. Temporal attention weights and window occlusion additionally identify which segments of the scan most influenced the prediction — a capability unique to this architecture.',
    referenceLabel: 'basiralab/RegGNN',
    referenceUrl: 'https://github.com/basiralab/RegGNN',
  },
  {
    name: 'BrainGNN',
    predicts: 'PMAT24',
    approach:
      'Applies a network-aware graph convolution (RaGConv) that soft-assigns each ROI to one of the eight Shen functional networks, giving each network its own learned transformation. The graph is then progressively pruned from 268 to 134 to 67 ROIs via differentiable TopK pooling, retaining only the regions most relevant to the prediction.',
    explainability:
      'Region importance scores emerge directly from the pooling layers, which are explicitly regularised during training via interpretability losses (TopK and graph-label consistency). No post-hoc attribution is required.',
    referenceLabel: 'xxlya/BrainGNN_Pytorch',
    referenceUrl: 'https://github.com/xxlya/BrainGNN_Pytorch',
  },
]

/** Ordered quick-start checklist for new users. */
const QUICK_START: string[] = [
  'Sign in, then open the Upload page.',
  'Select an fMRI time-series file in the Shen 268 format (see Data Format below).',
  'Submit the file. Analysis starts automatically and runs in the background.',
  'Voila! Your predicted scores and brain visualizations are ready to view.',
]

/** The five behavioral scores the system predicts (HCP behavioral measures). */
const PREDICTED_SCORES: { name: string; variable: string; domain: string; description: string }[] = [
  {
    name: 'Penn Progressive Matrices (PMAT)',
    variable: 'PMAT24_A_CR',
    domain: 'Fluid intelligence',
    description:
      'Measures fluid intelligence through non-verbal reasoning. The participant picks which of five options completes a visual pattern, across 24 items of increasing difficulty (an abbreviated Raven Progressive Matrices, Form A).',
  },
  {
    name: 'Picture Sequence Memory Test',
    variable: 'PicSeq_Unadj',
    domain: 'Episodic memory',
    description:
      'An NIH Toolbox test of episodic memory. The participant recalls increasingly long sequences of illustrated objects and activities in the order shown. Unadjusted scale score: 100 is the national average, with 115 and 85 one SD above and below.',
  },
  {
    name: 'List Sorting Working Memory Test',
    variable: 'ListSort_AgeAdj',
    domain: 'Working memory',
    description:
      'An NIH Toolbox test of working memory. The participant sequences visually and orally presented items (foods and animals) into size order. Age-adjusted scale score: 100 is the national average for the participant age band.',
  },
  {
    name: 'Emotional Support Survey',
    variable: 'EmotSupp_Unadj',
    domain: 'Social relationships',
    description:
      'An NIH Toolbox self-report measure of perceived emotional support: whether people in the social network are felt to be available to listen with empathy and understanding. Unadjusted scale score: mean 50, SD 10, where higher means more support.',
  },
  {
    name: 'Pittsburgh Sleep Quality Index (PSQI)',
    variable: 'PSQI_Score',
    domain: 'Sleep quality',
    description:
      'The total score across all items of the Pittsburgh Sleep Quality Index (Buysse et al., 1989), a self-report questionnaire covering sleep quality and disturbances.',
  },
]

/**
 * The eight large-scale functional networks of the Shen 268 atlas.
 * Region counts are derived directly from the atlas network labels and sum to 268.
 * Network names and grouping follow Finn et al. (2015).
 */
const BRAIN_NETWORKS: { name: string; rois: number; color: string; description: string }[] = [
  {
    name: 'Medial Frontal',
    rois: 29,
    color: '#2563eb',
    description: 'Self-referential thinking, social cognition, and emotional regulation.',
  },
  {
    name: 'Frontoparietal',
    rois: 34,
    color: '#7c3aed',
    description: 'Executive control: working memory, attention, planning, and goal-directed behavior.',
  },
  {
    name: 'Default Mode',
    rois: 20,
    color: '#db2777',
    description: 'Most active at rest. Linked to memory recall, daydreaming, and imagining the future.',
  },
  {
    name: 'Subcortical-Cerebellum',
    rois: 90,
    color: '#ea580c',
    description: 'Deep-brain and cerebellar structures that coordinate movement, learning, and signal relay.',
  },
  {
    name: 'Motor',
    rois: 50,
    color: '#16a34a',
    description: 'Plans and executes voluntary movement and processes sensorimotor feedback from the body.',
  },
  {
    name: 'Visual I',
    rois: 18,
    color: '#0891b2',
    description: 'Primary visual cortex: the first cortical stage of vision, handling edges and contrast.',
  },
  {
    name: 'Visual II',
    rois: 9,
    color: '#0d9488',
    description: 'Secondary visual areas that process color, motion, and simple shapes.',
  },
  {
    name: 'Visual Association',
    rois: 18,
    color: '#ca8a04',
    description: 'Higher-order visual integration: recognizing objects, faces, and scenes.',
  },
]

/** Consistent gradient section header used by every documentation card. */
function SectionHeading({
  icon: Icon,
  children,
  tone = 'blue',
}: {
  icon: LucideIcon
  children: ReactNode
  tone?: 'blue' | 'amber'
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 from-amber-50 to-amber-100/40 text-amber-900'
      : 'border-brand-400/15 from-blue-50 to-blue-100/40 text-blue-900'

  return (
    <CardHeader className={`border-b bg-gradient-to-r rounded-t-2xl ${toneClass}`}>
      <CardTitle className='flex items-center gap-2'>
        <Icon className='w-5 h-5' />
        {children}
      </CardTitle>
    </CardHeader>
  )
}

export function DocumentationContent() {
  return (
    <div className='space-y-6'>
      <header className='mx-auto w-full max-w-6xl'>
        <h1 className='section-title'>Documentation</h1>
        <p className='section-subtitle'>
          A guide to predicting behavioral scores from fMRI brain data. Use the menu to jump to any topic.
        </p>
      </header>

      <div className='doc-layout'>
        <aside className='doc-sidebar'>
          <DocTableOfContents />
        </aside>

        <div className='doc-content space-y-5'>
          {/* Overview ----------------------------------------------------- */}
          <section id='overview' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={Rocket}>Overview</SectionHeading>
              <CardContent className='pt-5 space-y-4'>
                <p className='text-slate-700'>
                  This application predicts behavioral and cognitive scores from functional MRI (fMRI) data using a
                  Graph Neural Network (GNN). You upload a recording of brain activity, and the system estimates
                  scores such as memory and reasoning ability.
                </p>

                <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
                  {QUICK_FACTS.map((fact) => (
                    <div key={fact.label} className='rounded-xl border border-brand-400/15 bg-blue-50/55 p-3'>
                      <fact.icon className='w-5 h-5 text-blue-600 mb-1.5' />
                      <p className='text-[11px] font-semibold uppercase tracking-wide text-slate-500'>
                        {fact.label}
                      </p>
                      <p className='text-sm font-medium text-slate-800'>{fact.value}</p>
                    </div>
                  ))}
                </div>

                <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
                  <p className='text-sm text-blue-900'>
                    <strong>Research use only.</strong> This is a Final Year Project demonstration. Predictions are
                    for research and education and must not be used for clinical decisions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* How it works ------------------------------------------------- */}
          <section id='how-it-works' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={Cpu}>How It Works</SectionHeading>
              <CardContent className='pt-5 space-y-4'>
                <p className='text-slate-700'>
                  Your fMRI data passes through four stages, from raw brain activity to a final prediction.
                </p>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2'>
                  {PIPELINE_STEPS.map((step, index) => (
                    <div
                      key={step.title}
                      className='relative rounded-xl border border-brand-400/15 bg-blue-50/55 p-4'
                    >
                      <span className='doc-num absolute -top-2.5 -left-2.5'>{index + 1}</span>
                      <step.icon className='w-7 h-7 text-blue-600 mt-1 mb-2' />
                      <p className='text-sm font-semibold text-slate-900'>{step.title}</p>
                      <p className='mt-1 text-xs leading-relaxed text-slate-600'>{step.text}</p>
                    </div>
                  ))}
                </div>

                <p className='text-sm text-slate-600'>
                  Treating the brain as a graph lets the model learn from the <em>pattern of connections</em> between
                  regions, not just the activity of each region on its own.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Models ------------------------------------------------------- */}
          <section id='models' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={Brain}>Models</SectionHeading>
              <CardContent className='pt-5 space-y-4'>
                <p className='text-slate-700'>
                  Five models were trained independently, one per behavioural measure. Each model receives a functional
                  connectivity graph derived from naturalistic fMRI — specifically a movie-watching condition from the dataset introduced by{' '}
                  <a
                    href='https://github.com/esfinn/movie_cpm'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-medium text-blue-600 hover:text-blue-800 hover:underline'
                  >
                    Finn et al.
                  </a>{' '}
                  — as input and outputs a single predicted score. The three architectures differ in how they
                  aggregate connectivity information across regions and time.
                </p>

                <div className='space-y-4'>
                  {MODEL_ARCHITECTURES.map((model) => (
                    <div
                      key={model.name}
                      className='flex h-full flex-col rounded-xl border border-brand-400/15 bg-blue-50/45 p-4'
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <h3 className='text-lg font-semibold text-slate-950'>{model.name}</h3>
                          <p className='mt-1 text-xs font-medium uppercase tracking-wide text-blue-700'>
                            Predicts: {model.predicts}
                          </p>
                        </div>
                        <Brain className='h-5 w-5 shrink-0 text-blue-600' />
                      </div>

                      <div className='mt-4 space-y-3 text-[13px] leading-relaxed text-slate-600'>
                        <p>
                          <strong className='text-slate-900'>Approach:</strong> {model.approach}
                        </p>
                        <p>
                          <strong className='text-slate-900'>Explainability:</strong> {model.explainability}
                        </p>
                      </div>

                      <a
                        href={model.referenceUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline'
                      >
                        {model.referenceLabel}
                        <ExternalLink className='h-4 w-4' />
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Getting started ---------------------------------------------- */}
          <section id='getting-started' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={CheckCircle2}>Getting Started</SectionHeading>
              <CardContent className='pt-5'>
                <ol className='space-y-3'>
                  {QUICK_START.map((step, index) => (
                    <li key={step} className='flex gap-3'>
                      <span className='doc-num mt-0.5'>{index + 1}</span>
                      <span className='text-sm text-slate-700'>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </section>

          {/* Data format -------------------------------------------------- */}
          <section id='data-format' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={FileText}>Data Format</SectionHeading>
              <CardContent className='pt-5 space-y-4'>
                <p className='text-slate-700'>Your fMRI file must follow these requirements:</p>
                <ul className='space-y-2 list-disc list-inside text-slate-700'>
                  <li>
                    <strong>File type:</strong> plain-text file (<code className='doc-code'>.txt</code>,{' '}
                    <code className='doc-code'>.csv</code>, or <code className='doc-code'>.tsv</code>).
                  </li>
                  <li>
                    <strong>Values:</strong> numbers only, separated by spaces, tabs, or commas. No missing or
                    non-numeric entries.
                  </li>
                  <li>
                    <strong>Shape:</strong> 268 brain regions and one row per time point of the scan.
                  </li>
                  <li>
                    <strong>Orientation:</strong> regions can be the columns or the rows. The system detects the
                    orientation automatically.
                  </li>
                </ul>

                <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
                  <div className='flex items-start gap-2'>
                    <AlertTriangle className='w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0' />
                    <div>
                      <p className='font-medium text-amber-900'>Atlas requirement</p>
                      <p className='mt-1 text-sm text-amber-800'>
                        Data must use the <strong>Shen 268-region brain atlas</strong>. Other atlases are not
                        currently supported.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className='mb-2 text-sm text-slate-600'>Example data structure:</p>
                  <pre className='overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs'>
{`# Time-series matrix (m rows x 268 columns)
# Each row    = one time point
# Each column = one brain region (Shen atlas)

0.234  -0.123  0.456  ...  0.789   (268 values)
0.345  -0.234  0.567  ...  0.890
0.456  -0.345  0.678  ...  0.901
...
(m rows total)`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Brain atlas & networks --------------------------------------- */}
          <section id='brain-atlas' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={Network}>Brain Atlas: 268 Regions, 8 Networks</SectionHeading>
              <CardContent className='pt-5 space-y-4'>
                <p className='text-slate-700'>
                  The Shen 268 atlas divides the whole brain into 268 small, non-overlapping{' '}
                  <strong>regions of interest (ROIs)</strong>. Every column in your uploaded file corresponds to one
                  region, and every value is that region&apos;s activity at one moment in time.
                </p>
                <p className='text-slate-700'>
                  These regions do not act alone. The atlas organizes all 268 of them into{' '}
                  <strong>8 large-scale functional networks</strong> &mdash; groups of regions that tend to activate
                  together and support related functions. The cards below explain each network and how many regions
                  it contains.
                </p>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {BRAIN_NETWORKS.map((network) => (
                    <div
                      key={network.name}
                      className='rounded-xl border border-l-[3px] border-slate-200/80 bg-white/70 p-3.5'
                      style={{ borderLeftColor: network.color }}
                    >
                      <div className='flex items-center gap-2'>
                        <span
                          className='h-2.5 w-2.5 shrink-0 rounded-full'
                          style={{ backgroundColor: network.color }}
                          aria-hidden='true'
                        />
                        <span className='text-sm font-semibold text-slate-900'>{network.name}</span>
                        <span className='ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500'>
                          {network.rois} regions
                        </span>
                      </div>
                      <p className='mt-1.5 text-[13px] leading-relaxed text-slate-600'>{network.description}</p>
                    </div>
                  ))}
                </div>

                <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
                  <p className='text-sm text-blue-900'>
                    <strong>Why this matters:</strong> when you review brain visualizations such as top connections
                    or region-importance maps, the network a region belongs to tells you which functional system the
                    model is drawing on for its prediction.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Understanding results ---------------------------------------- */}
          <section id='results' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={BookOpen}>Understanding Results</SectionHeading>
              <CardContent className='pt-5 space-y-4'>
                <p className='text-slate-700'>
                  Each analysis produces predicted behavioral scores across five measures:
                </p>

                <div className='space-y-2'>
                  {PREDICTED_SCORES.map((score) => (
                    <div
                      key={score.variable}
                      className='rounded-xl border border-brand-400/15 bg-blue-50/45 p-3.5'
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm font-semibold text-slate-900'>{score.name}</span>
                        <span className='rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500'>
                          {score.domain}
                        </span>
                        <code className='doc-code ml-auto'>{score.variable}</code>
                      </div>
                      <p className='mt-1.5 text-[13px] leading-relaxed text-slate-600'>{score.description}</p>
                    </div>
                  ))}
                </div>

                <p className='text-slate-700'>Alongside the scores, the results page shows:</p>
                <ul className='space-y-2 list-disc list-inside text-slate-700'>
                  <li>A correlation matrix of connectivity between all 268 brain regions.</li>
                  <li>
                    Interactive and static brain visualizations highlighting the regions (nodes) and connections
                    (edges) that contributed most to the prediction.
                  </li>
                </ul>

                <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
                  <p className='text-sm text-blue-900'>
                    <strong>Note:</strong> predictions are statistical estimates, not measured scores. Interpret them
                    within an appropriate scientific context.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Limitations -------------------------------------------------- */}
          <section id='limitations' className='doc-section'>
            <Card className='border-amber-200 bg-white/80'>
              <SectionHeading icon={AlertTriangle} tone='amber'>
                Limitations
              </SectionHeading>
              <CardContent className='pt-5'>
                <ul className='space-y-3 text-slate-700'>
                  <li>
                    <strong>Atlas restriction:</strong> only data from the Shen 268-region atlas is supported. Other
                    parcellations are not compatible.
                  </li>
                  <li>
                    <strong>Data quality dependency:</strong> prediction accuracy depends on properly preprocessed
                    input, including artifact removal.
                  </li>
                  <li>
                    <strong>Not for clinical diagnosis:</strong> this tool is for research and education only and
                    must not be used for clinical decision-making.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* FAQ ---------------------------------------------------------- */}
          <section id='faq' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={HelpCircle}>Frequently Asked Questions</SectionHeading>
              <CardContent className='pt-2'>
                <Accordion type='single' collapsible className='w-full divide-y divide-blue-100'>
                  <AccordionItem value='item-6' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      Who is this tool for?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      <p>This is a research and educational tool. It is most useful for:</p>
                      <ul className='mt-2 space-y-1 list-disc list-inside'>
                        <li>
                          Neuroimaging researchers exploring how functional connectivity relates to cognition and
                          behavior.
                        </li>
                        <li>
                          Students and educators who want a hands-on, end-to-end example of the GNN connectome
                          pipeline.
                        </li>
                        
                      </ul>
                    
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value='item-1' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      Why is my file not accepted?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      <p>A file may be rejected for several reasons:</p>
                      <ul className='mt-2 space-y-1 list-disc list-inside'>
                        <li>The file is not a .txt, .csv, or .tsv file.</li>
                        <li>The data does not contain 268 brain regions.</li>
                        <li>The data contains non-numeric values or missing entries.</li>
                        <li>The file is empty or improperly formatted.</li>
                      </ul>
                      <p className='mt-2'>Please match the specifications in the Data Format section.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value='item-2' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      Can I use other brain atlases?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      Currently the system only supports the Shen 268-region atlas. The GNN models were trained
                      specifically on this parcellation, so other atlases (for example AAL, Harvard-Oxford, or
                      Schaefer) will not produce valid results.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value='item-3' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      What does the output mean?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      The output is a set of predicted behavioral scores across cognitive and emotional domains. See
                      the Understanding Results section for the full list and what each measure represents.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value='item-7' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      Will I get the same result each time I upload the same file?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      Yes. The prediction is objective and reproducible: the trained model is a fixed mathematical
                      function, so the same input file always produces exactly the same predicted scores. This
                      differs from a person sitting a cognitive or IQ test, where the same individual can score
                      differently on different days due to practice, fatigue, attention, or mood. Here the result
                      depends only on the uploaded brain data.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value='item-4' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      How long does the analysis take?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      Analysis usually completes within 30 to 60 seconds, depending on the number of time points in
                      your data. Progress indicators are shown during processing.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value='item-5' className='border-blue-100'>
                    <AccordionTrigger className='font-medium text-slate-900 hover:text-blue-700'>
                      Is my data stored or shared?
                    </AccordionTrigger>
                    <AccordionContent className='text-slate-700'>
                      This is a demonstration application for a Final Year Project. Data is processed within your
                      active session and is not intended for permanent storage. Always follow your institution&apos;s
                      data governance policies before uploading sensitive data.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </section>

          {/* References --------------------------------------------------- */}
          <section id='references' className='doc-section'>
            <Card className='bg-white/80'>
              <SectionHeading icon={BookOpen}>References</SectionHeading>
              <CardContent className='pt-5 space-y-5'>
                <div className='space-y-2'>
                  <h4 className='font-medium text-slate-900'>Shen 268 Brain Atlas</h4>
                  <p className='text-sm text-slate-700'>
                    Shen, X., Tokoglu, F., Papademetris, X., &amp; Constable, R. T. (2013). Groupwise whole-brain
                    parcellation from resting-state fMRI data for network node identification. <em>NeuroImage</em>,
                    82, 403&ndash;415.
                  </p>
                  <a
                    href='https://pmc.ncbi.nlm.nih.gov/articles/PMC3759540/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline'
                  >
                    View publication on PubMed Central
                    <ExternalLink className='w-4 h-4' />
                  </a>
                </div>

                <div className='space-y-2'>
                  <h4 className='font-medium text-slate-900'>8-Network Functional Grouping</h4>
                  <p className='text-sm text-slate-700'>
                    Finn, E. S., Shen, X., Scheinost, D., Rosenberg, M. D., Huang, J., Chun, M. M., Papademetris, X.,
                    &amp; Constable, R. T. (2015). Functional connectome fingerprinting: identifying individuals
                    using patterns of brain connectivity. <em>Nature Neuroscience</em>, 18(11), 1664&ndash;1671.
                  </p>
                  <a
                    href='https://pmc.ncbi.nlm.nih.gov/articles/PMC5008686/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline'
                  >
                    View publication on PubMed Central
                    <ExternalLink className='w-4 h-4' />
                  </a>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
