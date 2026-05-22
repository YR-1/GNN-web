'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAnalysisStore } from '@/lib/store'
import { AnalysisResponse } from '@/lib/types'
import { AnalysisLoadingGraphic } from '@/components/AnalysisLoadingGraphic'
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

/** Pipeline steps shown in the loading indicator, aligned to backend status. */
const ANALYSIS_STEPS = [
  'Preparing and converting your data',
  'Running 5 prediction models',
  'Finalizing your results',
]

const stepIndexByStatus: Record<ExecutionStatusValue, number> = {
  queued: 0,
  processing: 1,
  completed: 2,
  failed: 0,
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

  const currentStepIndex = stepIndexByStatus[status]

  return (
    <section className='mx-auto flex min-h-[64vh] max-w-xl items-center justify-center'>
      <div className='page-container w-full text-center'>
        <h1 className='section-title text-2xl sm:text-3xl'>Analyzing Your File</h1>
        {fileName ? (
          <p className='section-subtitle mt-1 truncate'>
            <span className='mono-data'>{fileName}</span>
          </p>
        ) : null}

        {error ? (
          <div className='status-banner status-banner-error mt-6 text-left'>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <AnalysisLoadingGraphic />

            <div className='mt-6'>
              <div className='mb-1.5 flex items-center justify-between text-sm font-medium text-ink-800'>
                <span>{statusLabel}</span>
                <span>{displayProgress}%</span>
              </div>
              <div className='relative h-2.5 overflow-hidden rounded-full border border-brand-400/25 bg-white'>
                <div
                  className='relative h-full overflow-hidden rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-[width] duration-300 ease-out'
                  style={{ width: `${displayProgress}%` }}
                >
                  <span className='loader-shimmer' />
                </div>
              </div>
            </div>

            <p className='mt-4 text-sm text-ink-800'>{statusMessage}</p>

            <div className='mt-5 space-y-1 text-left'>
              {ANALYSIS_STEPS.map((label, index) => {
                const state =
                  index < currentStepIndex ? 'done' : index === currentStepIndex ? 'active' : 'pending'

                return (
                  <div
                    key={label}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      state === 'active' ? 'bg-blue-50/80' : ''
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        state === 'pending'
                          ? 'border border-brand-400/40 text-ink-700'
                          : 'bg-brand-600 text-white'
                      }`}
                    >
                      {state === 'done' ? (
                        <Check className='h-3.5 w-3.5' />
                      ) : state === 'active' ? (
                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      ) : (
                        <span className='text-xs font-semibold'>{index + 1}</span>
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        state === 'active'
                          ? 'font-medium text-ink-950'
                          : state === 'done'
                            ? 'text-ink-800'
                            : 'text-ink-700'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className='mt-5 text-xs text-ink-700'>
              You will be taken to your predictions automatically when the analysis completes.
            </p>
          </>
        )}

        <p className='mt-4 text-[11px] text-ink-700'>
          Reference: <span className='mono-data'>{executionId}</span>
        </p>
      </div>
    </section>
  )
}
