'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'

type ExecutionStatusValue = 'queued' | 'processing' | 'completed' | 'failed'

const targetProgressByStatus: Record<ExecutionStatusValue, number> = {
  queued: 28,
  processing: 90,
  completed: 100,
  failed: 100,
}

export default function AnalysisLoadingPage({
  params,
}: {
  params: { executionId: string }
}) {
  const { executionId } = params
  const router = useRouter()
  const [displayProgress, setDisplayProgress] = useState(6)
  const [targetProgress, setTargetProgress] = useState(12)
  const [status, setStatus] = useState<ExecutionStatusValue>('queued')
  const [error, setError] = useState('')
  const finishedRef = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= targetProgress) return current
        const delta = targetProgress - current
        const step = delta > 10 ? 2 : 1
        return Math.min(targetProgress, current + step)
      })
    }, 120)

    return () => clearInterval(timer)
  }, [targetProgress])

  useEffect(() => {
    const pollStatus = async () => {
      if (finishedRef.current) return

      try {
        const response = await api.getStatus(executionId)
        const nextStatus = response.data.status as ExecutionStatusValue
        setStatus(nextStatus)
        setTargetProgress(targetProgressByStatus[nextStatus] ?? 85)

        if (nextStatus === 'completed') {
          finishedRef.current = true
          setTargetProgress(100)
          setTimeout(() => {
            router.replace(`/analysis/${executionId}`)
          }, 360)
        } else if (nextStatus === 'failed') {
          finishedRef.current = true
          setError(response.data.results?.error || 'Analysis failed on server.')
        }
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.replace('/login')
          return
        }
        setError('Failed to fetch analysis status.')
      }
    }

    void pollStatus()
    const interval = setInterval(() => {
      void pollStatus()
    }, 1200)

    return () => clearInterval(interval)
  }, [executionId, router])

  const statusLabel = useMemo(() => {
    if (status === 'queued') return 'Queued'
    if (status === 'processing') return 'Processing'
    if (status === 'completed') return 'Completed'
    return 'Failed'
  }, [status])

  return (
    <section className='max-w-2xl mx-auto min-h-[64vh] flex items-center justify-center'>
      <div className='page-container w-full'>
        <h1 className='section-title text-3xl'>Analyzing Your File</h1>
        <p className='section-subtitle mt-2'>
          Execution ID: <span className='mono-data'>{executionId}</span>
        </p>

        {error ? (
          <div className='status-banner status-banner-error mt-5'>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className='mt-6'>
              <div className='flex justify-between text-sm text-ink-800 mb-2'>
                <span>Status: {statusLabel}</span>
                <span>{displayProgress}%</span>
              </div>
              <div className='h-3 rounded-full bg-white border border-brand-400/25 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all'
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
            </div>
            <p className='text-sm text-ink-700 mt-4'>
              We will redirect automatically to the analysis view when complete.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
