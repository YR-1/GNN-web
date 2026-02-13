import Link from 'next/link'

const WORKFLOW_STEPS = [
  {
    step: '1',
    title: 'Upload',
    desc: 'Submit ROI time-series files (.txt, .csv, .tsv) using the Shen-268 ROI ordering.',
  },
  {
    step: '2',
    title: 'Process',
    desc: 'Compute correlation structure and build graph-ready connectivity features.',
  },
  {
    step: '3',
    title: 'Predict',
    desc: 'Run score models for cognitive and emotion-related outcomes.',
  },
  {
    step: '4',
    title: 'Interpret',
    desc: 'Inspect top ROI links with 3D connectome and matrix views for scientific interpretation.',
  },
]

const SCORE_GROUPS = [
  {
    title: 'Cognitive Scores',
    items: ['ListSort (Age Adjusted)', 'PMAT', 'Sustained Attention'],
  },
  {
    title: 'Emotion and Well-being',
    items: ['Emotion Recognition', 'Sleep Quality'],
  },
]

const INTERPRETABILITY_ITEMS = [
  'Score-specific top ROI-to-ROI links',
  'Signed correlation strength and ranking',
  'Shen-268 region labels for anatomical context',
  '3D connectome plus matrix evidence in one workflow',
]

export default function RootPage() {
  return (
    <main className='app-bg'>
      <div className='noise-overlay' aria-hidden='true' />

      <section className='page-shell min-h-screen flex flex-col items-center justify-center gap-16 py-16'>
        {/* Hero */}
        <div className='surface-card-strong w-full max-w-3xl text-center fade-in-up'>
          <p className='inline-flex rounded-full border border-brand-400/40 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-700'>
            Shen-268 Atlas &middot; fMRI Connectivity
          </p>
          <h1 className='font-display mt-4 text-3xl sm:text-4xl text-ink-950'>
            ROI Correlation Analysis for Clinical Neuroimaging
          </h1>
          <p className='mx-auto mt-4 max-w-2xl text-base sm:text-lg text-ink-700'>
            Upload ROI time-series data, compute Pearson or Ledoit-Wolf correlation matrices,
            and explore brain connectivity with interactive 3D connectome visualizations.
          </p>
          <div className='mt-8 flex flex-col sm:flex-row items-center justify-center gap-3'>
            <Link href='/login' className='btn-primary w-full sm:w-auto'>
              Sign In
            </Link>
            <Link href='/signup' className='btn-secondary w-full sm:w-auto'>
              Create Account
            </Link>
          </div>
        </div>

        {/* Workflow Timeline */}
        <div className='w-full max-w-4xl fade-in-up'>
          <h2 className='font-display text-xl text-ink-950 text-center mb-2'>Workflow Timeline</h2>
          <p className='text-center text-sm text-ink-700 mb-6'>A single, interpretable path from ROI signal to score-level explanation.</p>
          <div className='relative'>
            <div className='hidden lg:block absolute left-[11%] right-[11%] top-5 h-px bg-brand-400/35' aria-hidden='true' />
            <ol className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              {WORKFLOW_STEPS.map((item) => (
                <li key={item.step} className='surface-card text-center space-y-2 h-full'>
                  <span
                    className='inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white'
                    style={{ background: 'linear-gradient(145deg, var(--brand-500), var(--brand-700))' }}
                  >
                    {item.step}
                  </span>
                  <p className='font-display text-base text-ink-950'>{item.title}</p>
                  <p className='text-sm text-ink-700'>{item.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Scores and Interpretability */}
        <div className='w-full max-w-4xl fade-in-up'>
          <h2 className='font-display text-xl text-ink-950 text-center mb-2'>Scores and Interpretability</h2>
          <p className='text-center text-sm text-ink-700 mb-6'>
            Predict meaningful outcomes and explain them with ROI-level evidence scientists can review.
          </p>

          <div className='grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4'>
            <div className='surface-card space-y-4'>
              <p className='font-display text-base text-ink-950'>Score Families</p>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {SCORE_GROUPS.map((group) => (
                  <div key={group.title} className='rounded-xl border border-brand-400/20 bg-white/70 p-3'>
                    <p className='text-sm font-semibold text-ink-950'>{group.title}</p>
                    <ul className='mt-2 space-y-1 text-sm text-ink-700'>
                      {group.items.map((item) => (
                        <li key={item} className='flex items-start gap-2'>
                          <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className='surface-card space-y-3'>
              <p className='font-display text-base text-ink-950'>Interpretability Layer</p>
              <ul className='space-y-2 text-sm text-ink-700'>
                {INTERPRETABILITY_ITEMS.map((item) => (
                  <li key={item} className='flex items-start gap-2'>
                    <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                    {item}
                  </li>
                ))}
              </ul>
              <div className='rounded-xl border border-brand-400/20 bg-white/75 p-3'>
                <p className='text-xs text-ink-700'>
                  Each predicted score links back to explicit connectivity patterns so model output remains testable and transparent.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className='w-full max-w-4xl fade-in-up'>
          <h2 className='font-display text-xl text-ink-950 text-center mb-6'>Built for neuroscience</h2>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div className='surface-card space-y-2'>
              <p className='font-display text-base text-ink-950'>Shen-268 Atlas</p>
              <p className='text-sm text-ink-700'>
                Supports the 268-parcel functional brain atlas with anatomical region labels for clinically interpretable results.
              </p>
            </div>
            <div className='surface-card space-y-2'>
              <p className='font-display text-base text-ink-950'>Nilearn Connectome</p>
              <p className='text-sm text-ink-700'>
                Interactive 3D brain connectivity visualization powered by nilearn, with configurable top-k link thresholds.
              </p>
            </div>
            <div className='surface-card space-y-2'>
              <p className='font-display text-base text-ink-950'>Validated Methods</p>
              <p className='text-sm text-ink-700'>
                Pearson correlation and Ledoit-Wolf shrinkage estimation via scikit-learn. Plotly interactive heatmaps.
              </p>
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div className='w-full max-w-4xl fade-in-up'>
          <h2 className='font-display text-xl text-ink-950 text-center mb-6'>Methodology</h2>
          <div className='surface-card space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
              <div>
                <p className='font-semibold text-ink-950'>Brain Atlas</p>
                <p className='text-ink-700 mt-1'>
                  Shen et al., 2013 — 268-parcel functional brain atlas derived from resting-state fMRI.
                </p>
              </div>
              <div>
                <p className='font-semibold text-ink-950'>Correlation Method</p>
                <p className='text-ink-700 mt-1'>
                  Pearson correlation with optional Ledoit-Wolf shrinkage estimation (scikit-learn).
                </p>
              </div>
              <div>
                <p className='font-semibold text-ink-950'>Visualization</p>
                <p className='text-ink-700 mt-1'>
                  Nilearn view_connectome and plot_markers for interactive 3D brain network rendering.
                </p>
              </div>
              <div>
                <p className='font-semibold text-ink-950'>Predictions</p>
                <p className='text-ink-700 mt-1'>
                  Simulated scores for demonstration purposes. Real ML models pending clinical validation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className='w-full max-w-4xl fade-in-up'>
          <div className='surface-card'>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm'>
              <div>
                <p className='font-semibold text-ink-950'>ROI Analyzer v0.1.0</p>
                <p className='text-ink-700 mt-1'>Built with nilearn, scikit-learn, Plotly, Next.js, and FastAPI.</p>
              </div>
              <div>
                <p className='font-semibold text-ink-950'>Resources</p>
                <div className='flex flex-wrap gap-x-4 gap-y-1 mt-1 text-ink-700'>
                  <span>Documentation</span>
                  <span>Methodology</span>
                  <span>Privacy Policy</span>
                  <span>Terms of Use</span>
                </div>
              </div>
              <div>
                <p className='font-semibold text-ink-950'>How to Cite</p>
                <p className='text-ink-700 mt-1 mono-data text-xs'>
                  ROI Analyzer (2025). Brain Connectivity Analysis Platform. [Software]
                </p>
              </div>
            </div>

            <div className='mt-6 pt-4 border-t border-brand-400/20 text-xs text-ink-700 text-center space-y-1'>
              <p>
                For research use only. Not intended for clinical diagnosis or treatment decisions.
                Not FDA-approved. Results should be interpreted by qualified professionals with appropriate institutional oversight.
              </p>
            </div>
          </div>
        </footer>
      </section>
    </main>
  )
}
