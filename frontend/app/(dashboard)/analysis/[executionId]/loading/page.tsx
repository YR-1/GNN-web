'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useAnalysisStore } from '@/lib/store'
import { AnalysisResponse } from '@/lib/types'
import React from 'react'

type ExecutionStatusValue = 'queued' | 'processing' | 'completed' | 'failed'

const targetProgressByStatus: Record<ExecutionStatusValue, number> = {
  queued: 28,
  processing: 90,
  completed: 100,
  failed: 100,
}

const fallbackStatusMessage: Record<ExecutionStatusValue, string> = {
  queued: 'Converting your brain data into a connectivity graph for the model.',
  processing: 'Analyzing the brain graph and predicting your behavioral scores.',
  completed: 'Analysis finished. Preparing to open the results.',
  failed: 'The analysis stopped before completion.',
}

export default function AnalysisLoadingPage({
  params,
}: {
  params: Promise<{ executionId: string }>
}) {
  const { executionId } = React.use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const setActiveAnalysis = useAnalysisStore((state) => state.setActiveAnalysis)
  const setLatestAnalysis = useAnalysisStore((state) => state.setLatestAnalysis)
  const [displayProgress, setDisplayProgress] = useState(6)
  const [targetProgress, setTargetProgress] = useState(12)
  const [status, setStatus] = useState<ExecutionStatusValue>('queued')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState(searchParams.get('fileName') ?? '')
  const [statusMessage, setStatusMessage] = useState(fallbackStatusMessage.queued)
  const finishedRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)
  const requestInFlightRef = useRef(false)

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
    const queryFileName = searchParams.get('fileName')
    if (queryFileName) {
      setFileName(queryFileName)
    }
  }, [searchParams])

  useEffect(() => {
    if (fileName) return

    const fetchFileName = async () => {
      try {
        const response = await api.getHistory()
        const match = (response.data as Array<{ execution_id?: string; file_name: string }>).find(
          (item) => item.execution_id === executionId
        )
        if (match?.file_name) {
          setFileName(match.file_name)
        }
      } catch {
        // Non-blocking enhancement only; loading should continue even if history lookup fails.
      }
    }

    void fetchFileName()
  }, [executionId, fileName])

  useEffect(() => {
    const pollStatus = async () => {
      if (finishedRef.current || requestInFlightRef.current) return
      requestInFlightRef.current = true

      try {
        const response = await api.getStatus(executionId)
        consecutiveFailuresRef.current = 0
        if (error) setError('')
        const nextStatus = response.data.status as ExecutionStatusValue
        setStatus(nextStatus)
        setTargetProgress(targetProgressByStatus[nextStatus] ?? 85)
        setStatusMessage(response.data.message?.trim() || fallbackStatusMessage[nextStatus] || fallbackStatusMessage.processing)

        if (nextStatus === 'completed') {
          finishedRef.current = true
          setTargetProgress(100)
          const analysisResponse = await api.getAnalysis(executionId)
          const analysis = analysisResponse.data as AnalysisResponse
          setLatestAnalysis(analysis)
          setActiveAnalysis(analysis)
          setTimeout(() => {
            router.replace('/predictions')
          }, 360)
        } else if (nextStatus === 'failed') {
          finishedRef.current = true
          setError('Analysis failed on server.')
        }
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.replace('/login')
          return
        }
        consecutiveFailuresRef.current += 1
        if (consecutiveFailuresRef.current >= 3) {
          setError('Failed to fetch analysis status.')
        }
      } finally {
        requestInFlightRef.current = false
      }
    }

    void pollStatus()
    const interval = setInterval(() => {
      void pollStatus()
    }, 1200)

    return () => clearInterval(interval)
  }, [executionId, error, router, setActiveAnalysis, setLatestAnalysis])

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
        {fileName ? (
          <p className='section-subtitle mt-2'>
            Loading: <span className='mono-data'>{fileName}</span>
          </p>
        ) : null}
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
            <p className='text-sm text-ink-800 mt-4'>
              {statusMessage}
            </p>
            <p className='text-sm text-ink-700 mt-4'>
              We will redirect automatically to the Prediction tab when complete.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
