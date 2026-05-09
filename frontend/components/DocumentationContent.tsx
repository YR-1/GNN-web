import {
  AlertTriangle,
  BookOpen,
  Brain,
  ChartNetwork,
  ExternalLink,
  FileText,
  Grid3X3,
  HelpCircle,
  Rocket,
  Upload,
} from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DocumentationContent() {
  return (
    <div className='page-container space-y-5'>
      <header>
        <h1 className='section-title'>Documentation</h1>
        <p className='section-subtitle'>User guide for the fMRI-based behavioral score prediction system.</p>
      </header>

      <Card className='bg-white/75'>
        <CardHeader className='border-b border-brand-400/15 bg-gradient-to-r from-blue-50 to-blue-100/40 rounded-t-2xl'>
          <CardTitle className='text-blue-900 flex items-center gap-2'>
            <Rocket className='w-5 h-5' />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-5 space-y-4'>
          <p className='text-slate-700'>
            This application predicts behavioral scores from fMRI time series data using a Graph Neural Network (GNN)
            model.
          </p>
          <div className='space-y-3'>
            <h3 className='text-blue-900 font-medium'>Quick Start Steps</h3>
            <ol className='space-y-2 list-decimal list-inside text-slate-700'>
              <li>
                Upload your <code className='bg-slate-100 px-2 py-0.5 rounded text-sm'>.txt</code> file containing
                fMRI time series data.
              </li>
              <li>Ensure the data follows the correct format in the Data Format section below.</li>
              <li>Click "Submit" to start the prediction process.</li>
              <li>View predicted behavioral scores and visualizations on the results page.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className='bg-white/75'>
        <CardHeader className='border-b border-brand-400/15 bg-gradient-to-r from-blue-50 to-blue-100/40 rounded-t-2xl'>
          <CardTitle className='text-blue-900 flex items-center gap-2'>
            <FileText className='w-5 h-5' />
            Data Format
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-5 space-y-4'>
          <p className='text-slate-700'>Your fMRI data must follow these specific requirements:</p>
          <ul className='space-y-2 list-disc list-inside text-slate-700'>
            <li>
              <strong>File type:</strong> Plain text file (.txt)
            </li>
            <li>
              <strong>Matrix dimensions:</strong> 268 columns (brain regions) x m rows (time points)
            </li>
            <li>
              <strong>Column structure:</strong> Each column represents one brain region from the Shen 268 atlas
            </li>
            <li>
              <strong>Row structure:</strong> Each row represents a time point in the fMRI scan
            </li>
          </ul>

          <div className='bg-amber-50 border border-amber-200 rounded-lg p-4'>
            <div className='flex items-start gap-2'>
              <AlertTriangle className='w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0' />
              <div>
                <p className='font-medium text-amber-900'>Important Note</p>
                <p className='text-sm text-amber-800 mt-1'>
                  Data must be based on the <strong>Shen 268-region brain atlas</strong>. Other atlases are not
                  currently supported.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className='text-sm text-slate-600 mb-2'>Example data structure:</p>
            <pre className='bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto text-xs'>
{`# Time series matrix (m x 268)
# Each row = one time point
# Each column = one brain region (Shen atlas)

0.234  -0.123  0.456  ...  0.789  (268 values)
0.345  -0.234  0.567  ...  0.890
0.456  -0.345  0.678  ...  0.901
...
(m rows total)`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card className='bg-white/75'>
        <CardHeader className='border-b border-brand-400/15 bg-gradient-to-r from-blue-50 to-blue-100/40 rounded-t-2xl'>
          <CardTitle className='text-blue-900 flex items-center gap-2'>
            <Brain className='w-5 h-5' />
            Analysis Method
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-5 space-y-4'>
          <p className='text-slate-700'>
            The analysis pipeline transforms fMRI time series data into behavioral predictions through the following
            steps:
          </p>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2'>
            <div className='text-center rounded-xl border border-brand-400/15 bg-blue-50/60 p-4'>
              <Upload className='w-8 h-8 text-blue-600 mx-auto mb-2' />
              <p className='text-sm text-slate-700'>fMRI Time Series</p>
            </div>
            <div className='text-center rounded-xl border border-brand-400/15 bg-blue-50/60 p-4'>
              <Grid3X3 className='w-8 h-8 text-blue-600 mx-auto mb-2' />
              <p className='text-sm text-slate-700'>Functional Connectivity</p>
            </div>
            <div className='text-center rounded-xl border border-brand-400/15 bg-blue-50/60 p-4'>
              <ChartNetwork className='w-8 h-8 text-blue-600 mx-auto mb-2' />
              <p className='text-sm text-slate-700'>Brain Graph</p>
            </div>
            <div className='text-center rounded-xl border border-brand-400/15 bg-blue-50/60 p-4'>
              <Brain className='w-8 h-8 text-blue-600 mx-auto mb-2' />
              <p className='text-sm text-slate-700'>GNN Prediction</p>
            </div>
          </div>

          <div className='space-y-2 text-slate-700 text-sm'>
            <p>
              <strong>1. Functional Connectivity:</strong> Time series data is converted into a connectivity matrix
              showing correlations between brain regions.
            </p>
            <p>
              <strong>2. Graph Construction:</strong> The connectivity matrix is transformed into a graph where nodes
              are brain regions and edges represent connections.
            </p>
            <p>
              <strong>3. GNN Processing:</strong> A Graph Neural Network analyzes the brain graph structure to predict
              behavioral scores.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className='bg-white/75'>
        <CardHeader className='border-b border-brand-400/15 bg-gradient-to-r from-blue-50 to-blue-100/40 rounded-t-2xl'>
          <CardTitle className='text-blue-900 flex items-center gap-2'>
            <BookOpen className='w-5 h-5' />
            Results
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-5 space-y-3'>
          <p className='text-slate-700'>
            The application outputs <strong>predicted behavioral scores</strong> for various cognitive and behavioral
            measures based on input fMRI data.
          </p>
          <ul className='space-y-2 list-disc list-inside text-slate-700'>
            <li>Scores are normalized and presented with percentile rankings</li>
            <li>Visualizations include radar charts and correlation matrices</li>
            <li>Results can be used to understand brain-behavior relationships</li>
          </ul>
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4'>
            <p className='text-sm text-blue-900'>
              <strong>Note:</strong> These predictions are intended for <strong>research purposes only</strong> and
              should be interpreted within appropriate scientific context.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className='border-amber-200 bg-white/75'>
        <CardHeader className='border-b border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/40 rounded-t-2xl'>
          <CardTitle className='text-amber-900 flex items-center gap-2'>
            <AlertTriangle className='w-5 h-5' />
            Limitations
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-5'>
          <ul className='space-y-3 text-slate-700'>
            <li>
              <strong>Atlas restriction:</strong> Only supports data from the Shen 268-region brain atlas. Other
              parcellations are not compatible.
            </li>
            <li>
              <strong>Data quality dependency:</strong> Prediction accuracy depends on the quality of input fMRI data,
              including proper preprocessing and artifact removal.
            </li>
            <li>
              <strong>Not for clinical diagnosis:</strong> This tool is designed for research and educational purposes
              only and should not be used for clinical decision-making or diagnosis.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className='bg-white/75'>
        <CardHeader className='border-b border-brand-400/15 bg-gradient-to-r from-blue-50 to-blue-100/40 rounded-t-2xl'>
          <CardTitle className='text-blue-900 flex items-center gap-2'>
            <HelpCircle className='w-5 h-5' />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-2'>
          <Accordion type='single' collapsible className='w-full divide-y divide-blue-100'>
            <AccordionItem value='item-1' className='border-blue-100'>
              <AccordionTrigger className='text-slate-900 hover:text-blue-700 font-medium'>
                Why is my file not accepted?
              </AccordionTrigger>
              <AccordionContent className='text-slate-700'>
                <p>Your file may be rejected for several reasons:</p>
                <ul className='mt-2 space-y-1 list-disc list-inside'>
                  <li>The file format is not .txt</li>
                  <li>The data does not have exactly 268 columns</li>
                  <li>The data contains non-numeric values or missing data</li>
                  <li>The file is corrupted or improperly formatted</li>
                </ul>
                <p className='mt-2'>Please ensure your data matches the specifications in the Data Format section.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='item-2' className='border-blue-100'>
              <AccordionTrigger className='text-slate-900 hover:text-blue-700 font-medium'>
                Can I use other brain atlases?
              </AccordionTrigger>
              <AccordionContent className='text-slate-700'>
                Currently, this system only supports data from the Shen 268-region brain atlas. The GNN model was
                trained specifically on this parcellation scheme, so other atlases (for example AAL, Harvard-Oxford,
                or Schaefer) will not produce valid results.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='item-3' className='border-blue-100'>
              <AccordionTrigger className='text-slate-900 hover:text-blue-700 font-medium'>
                What does the output mean?
              </AccordionTrigger>
              <AccordionContent className='text-slate-700'>
                The output consists of predicted behavioral scores across multiple domains (for example cognitive
                performance and personality traits). Percentiles indicate how the predicted score compares to a
                reference population.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='item-4' className='border-blue-100'>
              <AccordionTrigger className='text-slate-900 hover:text-blue-700 font-medium'>
                How long does the analysis take?
              </AccordionTrigger>
              <AccordionContent className='text-slate-700'>
                Analysis typically completes within 30 to 60 seconds depending on the number of time points in your
                data. You will see progress indicators during processing.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='item-5' className='border-blue-100'>
              <AccordionTrigger className='text-slate-900 hover:text-blue-700 font-medium'>
                Is my data stored or shared?
              </AccordionTrigger>
              <AccordionContent className='text-slate-700'>
                This is a demonstration application for a Final Year Project. In the current implementation, data is
                processed within your active session and is not intended for permanent storage. Always follow your
                institution&apos;s data governance policies before uploading sensitive data.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className='bg-white/75'>
        <CardHeader className='border-b border-brand-400/15 bg-gradient-to-r from-blue-50 to-blue-100/40 rounded-t-2xl'>
          <CardTitle className='text-blue-900'>Reference</CardTitle>
        </CardHeader>
        <CardContent className='pt-5'>
          <div className='space-y-3'>
            <h4 className='text-slate-900 font-medium'>Shen Brain Atlas</h4>
            <p className='text-slate-700 text-sm'>
              Shen, X., Tokoglu, F., Papademetris, X., and Constable, R. T. (2013). Groupwise whole-brain
              parcellation from resting-state fMRI data for network node identification. <em>NeuroImage</em>, 82,
              403-415.
            </p>
            <a
              href='https://pmc.ncbi.nlm.nih.gov/articles/PMC3759540/'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm'
            >
              View publication on PubMed Central
              <ExternalLink className='w-4 h-4' />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
