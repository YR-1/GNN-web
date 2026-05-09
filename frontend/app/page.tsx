import Link from 'next/link'
import Image from 'next/image'
import { Brain, TrendingUp, BarChart3, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

export default function RootPage() {
  return (
    <div className='min-h-screen'>
      {/* Hero Section */}
      <section className='relative overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-500/5' />
        <div className='max-w-7xl mx-auto px-6 py-20 relative'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='mb-8 flex justify-center'>
              <div className='inline-flex items-center justify-center gap-4 px-2 py-2'>
                <Image
                  src='/fyp-logo-brain.png'
                  alt='MindPulse logo'
                  width={88}
                  height={88}
                  className='h-[68px] w-[68px] object-contain sm:h-[88px] sm:w-[88px]'
                />
                <span className='font-display text-3xl font-bold leading-none text-ink-950 sm:text-5xl'>
                  MindPulse
                </span>
              </div>
            </div>
            <h1 className='text-4xl sm:text-5xl font-display font-bold text-ink-950 mb-6'>
              Predict Human Behavior from Brain Activity
            </h1>
            <p className='text-ink-700 text-lg mb-8 max-w-2xl mx-auto'>
              Advanced machine learning platform for analyzing brain connectivity and predicting behavioral outcomes.
            </p>
            <div className='flex flex-wrap gap-4 justify-center'>
              <Link href='/login'>
                <Button size='lg'>
                  Get Started
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Button>
              </Link>
              <Link href='/documentation'>
                <Button size='lg' variant='outline'>
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className='max-w-7xl mx-auto px-6 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-display font-bold text-ink-950 mb-4'>
            Powerful Features for Neuroscience Research
          </h2>
          <p className='text-ink-700 max-w-2xl mx-auto'>
            State-of-the-art tools designed specifically for brain-behavior prediction studies
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          <Card className='p-6 hover:shadow-lg transition-shadow'>
            <div className='w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4'>
              <Brain className='w-6 h-6 text-purple-600' />
            </div>
            <h3 className='text-base font-display font-semibold text-ink-950 mb-2'>Graph-Based Functional Connectivity Analysis</h3>
            <p className='text-ink-700 text-sm'>
              Constructs graph representations of functional connectivity derived from fMRI time-series data, enabling analysis of interactions between brain regions within a network framework.
            </p>
          </Card>

          <Card className='p-6 hover:shadow-lg transition-shadow'>
            <div className='w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4'>
              <TrendingUp className='w-6 h-6 text-green-600' />
            </div>
            <h3 className='text-base font-display font-semibold text-ink-950 mb-2'>Behavioral Score Prediction</h3>
            <p className='text-ink-700 text-sm'>
              Applies Graph Neural Network models to predict behavioral or cognitive performance scores from patterns of functional brain connectivity.
            </p>
          </Card>

          <Card className='p-6 hover:shadow-lg transition-shadow'>
            <div className='w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4'>
              <BarChart3 className='w-6 h-6   text-orange-600' />
            </div>
            <h3 className='text-base font-display font-semibold text-ink-950 mb-2'>Rich Visualizations</h3>
            <p className='text-ink-700 text-sm'>
              Provides visual representations of functional connectivity networks and model outputs, facilitating interpretation of brain network structure and predicted behavioral outcomes.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className='bg-slate-100/50 py-16'>
        <div className='max-w-7xl mx-auto px-6'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-display font-bold text-ink-950 mb-4'>How It Works</h2>
            <p className='text-ink-700 max-w-2xl mx-auto'>
              Simple three-step process from data upload to insights
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto'>
            {[
              { n: '1', title: 'Upload Data', desc: 'Upload your brain time series data in TXT format' },
              { n: '2', title: 'Process & Analyze', desc: 'Our AI models process your data and identify patterns' },
              { n: '3', title: 'Get Results', desc: 'View predictions, visualizations, and export findings' },
            ].map(({ n, title, desc }) => (
              <div key={n} className='text-center'>
                <div className='w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md'>
                  <span className='text-white text-lg font-bold'>{n}</span>
                </div>
                <h3 className='text-base font-display font-semibold text-ink-950 mb-2'>{title}</h3>
                <p className='text-ink-700 text-sm'>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research Applications */}
      <section className='max-w-7xl mx-auto px-6 py-16'>
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-display font-bold text-ink-950 mb-4'>Research Applications</h2>
          <p className='text-ink-700 max-w-2xl mx-auto'>
            Discover which brain regions drive specific behaviors and cognitive processes
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto'>
          {[
            {
              title: 'Functional Brain Network Analysis',
              desc: 'Examine large-scale interactions between brain regions by modeling functional connectivity as graph-based brain networks.',
            },
            {
              title: 'Brain–Behavior Relationship Studies',
              desc: 'Investigate how patterns of functional connectivity relate to individual differences in cognitive, emotional, and behavioral measures.',
            },
            {
              title: 'Individual Differences Analysis',
              desc: 'Examine how differences in functional brain connectivity across individuals are associated with variability in behavioral and cognitive measures.',
            },
            {
              title: 'Objective Behavioral Assessment',
              desc: 'Provide a data-driven approach to estimating behavioral outcomes from neuroimaging data, complementing traditional questionnaire-based assessments.',
            },
          ].map(({ title, desc }) => (
            <Card key={title} className='p-6'>
              <CheckCircle2 className='w-8 h-8 text-green-600 mb-3' />
              <h3 className='text-base font-display font-semibold text-ink-950 mb-2'>{title}</h3>
              <p className='text-ink-700 text-sm'>{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className='bg-brand-600 text-white py-16'>
        <div className='max-w-7xl mx-auto px-6 text-center'>
          <h2 className='text-3xl font-display font-bold mb-4'>Ready to Start Your Research?</h2>
          <p className='mb-8 max-w-2xl mx-auto opacity-90'>
            Join hundreds of neuroscience researchers using MindPulse to advance our understanding of the human brain
          </p>
          <Link href='/login'>
            <Button size='lg' variant='secondary'>
              Get Started Now
              <ArrowRight className='w-4 h-4 ml-2' />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t border-brand-400/20 bg-white py-8'>
        <div className='max-w-7xl mx-auto px-6'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-8'>
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <div className='w-8 h-8 rounded-lg flex items-center justify-center'>
                  
                  <Image
                  src='/fyp-logo-brain.png'
                  alt='MindPulse logo'
                  width={72}
                  height={76}
                  className='h-[28px] w-[24px] object-contain'
                />
                </div>
                <span className='font-display font-semibold text-ink-950'>MindPulse</span>
              </div>
              <p className='text-sm text-ink-700'>
                Advancing neuroscience through predictive modeling
              </p>
            </div>

            <div>
              <h4 className='font-display font-semibold text-ink-950 mb-3'>Product</h4>
              <ul className='space-y-2 text-sm text-ink-700'>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Features</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Pricing</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Documentation</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>API</a></li>
              </ul>
            </div>

            <div>
              <h4 className='font-display font-semibold text-ink-950 mb-3'>Resources</h4>
              <ul className='space-y-2 text-sm text-ink-700'>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Tutorials</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Research Papers</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Case Studies</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className='font-display font-semibold text-ink-950 mb-3'>Company</h4>
              <ul className='space-y-2 text-sm text-ink-700'>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>About</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Team</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Contact</a></li>
                <li><a href='#' className='hover:text-ink-950 transition-colors'>Privacy</a></li>
              </ul>
            </div>
          </div>

          <div className='border-t border-brand-400/20 mt-8 pt-8 text-center text-sm text-ink-700'>
            <p>© 2025 MindPulse. For research purposes only. Not for clinical use.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
