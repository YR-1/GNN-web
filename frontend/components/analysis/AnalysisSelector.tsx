'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface HistoryItem {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

interface AnalysisSelectorProps {
  title: string
  subtitle: string
  routePath: string
}

export function AnalysisSelector({ title, subtitle, routePath }: AnalysisSelectorProps) {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.getHistory()
        setHistory(
          (response.data as HistoryItem[]).filter(
            (item) => item.status === 'completed' && item.execution_id
          )
        )
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    void fetchHistory()
  }, [])

  return (
    <div className='page-container'>
      <div className='text-center'>
        <h1 className='section-title'>{title}</h1>
        <p className='section-subtitle mt-2'>{subtitle}</p>
      </div>

      <div className='page-section py-8 px-4'>
        {loading ? (
          <div className='text-center'>
            <div className='loading-spinner mx-auto mb-3' />
          </div>
        ) : history.length === 0 ? (
          <div className='text-center'>
            <p className='text-sm text-ink-700'>No completed analyses found.</p>
            <Link href='/upload' className='btn-primary mt-4 inline-flex'>
              Upload data
            </Link>
          </div>
        ) : (
          <div className='max-w-md mx-auto space-y-2'>
            {history.map((item) => (
              <button
                key={item.execution_id}
                type='button'
                className='w-full text-left rounded-xl border border-brand-400/20 bg-white/70 px-4 py-3 hover:bg-white/90 transition'
                onClick={() => router.push(`${routePath}?executionId=${item.execution_id}`)}
              >
                <p className='font-medium text-ink-950 truncate'>{item.file_name}</p>
                <p className='text-xs text-ink-700 mt-0.5'>
                  {new Date(item.uploaded_at).toLocaleDateString()} at{' '}
                  {new Date(item.uploaded_at).toLocaleTimeString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className='text-center'>
        <Link href='/history' className='btn-secondary'>
          Open full history
        </Link>
      </div>
    </div>
  )
}
