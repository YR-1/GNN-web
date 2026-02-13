'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CorrelationMatrix from '@/components/CorrelationMatrix'
import { api } from '@/lib/api'
import { CorrelationResults } from '@/lib/types'

export default function AnalysisResultPage({
  params,
}: {
  params: { executionId: string }
}) {
  const { executionId } = params
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [results, setResults] = useState<CorrelationResults | null>(null)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await api.getAnalysis(executionId)
        const status = response.data.status
        const payload = response.data.results as CorrelationResults | undefined

        if (status === 'completed' && payload) {
          setResults(payload)
          return
        }
        if (status === 'failed') {
          setError(payload?.error || 'Analysis failed on server.')
          return
        }

        router.replace(`/analysis/${executionId}/loading`)
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.replace('/login')
          return
        }
        if (err?.response?.status === 404) {
          setError('Analysis execution was not found.')
          return
        }
        setError('Failed to load analysis results.')
      } finally {
        setLoading(false)
      }
    }

    void fetchAnalysis()
  }, [executionId, router])

  if (loading) {
    return (
      <div className='page-container max-w-3xl mx-auto'>
        <div className='text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading analysis results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='page-container max-w-3xl mx-auto'>
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
        <button type='button' className='btn-secondary' onClick={() => router.push('/upload')}>
          Back to Upload
        </button>
      </div>
    )
  }

  if (!results) return null

  return (
    <div className='page-container'>
      <header className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
        <div>
          <h1 className='section-title'>Analysis Output</h1>
          <p className='section-subtitle'>
            Execution ID: <span className='mono-data'>{executionId}</span>
          </p>
        </div>
        <div className='flex gap-2'>
          <Link href={`/predictions?executionId=${executionId}`} className='btn-primary'>
            View predictions
          </Link>
          <Link href={`/statistics?executionId=${executionId}`} className='btn-secondary'>
            View statistics
          </Link>
        </div>
      </header>
      <div>
        <p className='font-semibold text-ink-950 mb-3'>Correlation Matrix</p>
        <CorrelationMatrix data={results} fileName={results.file_name} />
      </div>
    </div>
  )
}
