'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analysisService } from '@/lib/services'
import { DashboardStats } from '@/lib/types'
import { getStatusPillClass } from '@/lib/utils'

export default function DashboardPage() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => analysisService.getDashboardStats(),
  })

  const successRate = useMemo(() => {
    if (!stats || stats.total_uploads <= 0) return 0
    return Math.round((stats.completed_analyses / stats.total_uploads) * 100)
  }, [stats])

  return (
    <div className='page-container'>
      <header className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
        <div>
          <h1 className='section-title'>Dashboard</h1>
          <p className='section-subtitle'>Overview of upload volume and analysis progress.</p>
        </div>
        <div className='flex gap-2'>
          <Link href='/upload' className='btn-glass-primary'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.9'
              className='h-4 w-4'
              aria-hidden='true'
            >
              <path d='M12 16V5m0 0 4 4m-4-4-4 4' strokeLinecap='round' strokeLinejoin='round' />
              <path d='M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3' strokeLinecap='round' />
            </svg>
            <span>New upload</span>
          </Link>
          <Link href='/history' className='btn-glass'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.9'
              className='h-4 w-4'
              aria-hidden='true'
            >
              <path d='M3.5 12a8.5 8.5 0 1 0 2.5-6' strokeLinecap='round' />
              <path d='M3.5 4v4h4' strokeLinecap='round' strokeLinejoin='round' />
              <path d='M12 7.5V12l3 2' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
            <span>View history</span>
          </Link>
        </div>
      </header>

      {error && (
        <div className='status-banner status-banner-error'>
          <p>Unable to load dashboard metrics. Please try again.</p>
        </div>
      )}

      {isLoading ? (
        <div className='text-center py-12'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-ink-800'>Loading dashboard data...</p>
        </div>
      ) : stats ? (
        <>
          <div>
            <p className='font-semibold text-ink-950 mb-4'>Key Metrics</p>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
              <article className='metric-card'>
                <p className='metric-label'>Total uploads</p>
                <p className='metric-value'>{stats.total_uploads}</p>
                <p className='mt-2 text-xs text-ink-700'>Files submitted</p>
              </article>

              <article className='metric-card'>
                <p className='metric-label'>Completed analyses</p>
                <p className='metric-value'>{stats.completed_analyses}</p>
                <p className='mt-2 text-xs text-ink-700'>Success rate: {successRate}%</p>
              </article>

              <article className='metric-card'>
                <p className='metric-label'>Failed analyses</p>
                <p className='metric-value'>{stats.failed_analyses}</p>
                <p className='mt-2 text-xs text-ink-700'>Total analyses: {stats.total_analyses}</p>
              </article>

              <article className='metric-card'>
                <p className='metric-label'>Total analyses</p>
                <p className='metric-value'>{stats.total_analyses}</p>
                <p className='mt-2 text-xs text-ink-700'>All time</p>
              </article>
            </div>
          </div>

          {stats.recent_uploads && stats.recent_uploads.length > 0 && (
            <div>
              <p className='font-semibold text-ink-950 mb-3'>Recent activity</p>
              <div className='space-y-2'>
                {stats.recent_uploads.map((upload) => (
                  <div
                    key={upload.upload_id}
                    className='flex items-center justify-between gap-3 rounded-xl border border-brand-400/15 bg-white/60 px-4 py-2.5'
                  >
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-ink-950 truncate'>{upload.file_name}</p>
                      <p className='text-xs text-ink-700'>
                        {new Date(upload.uploaded_at).toLocaleDateString()} at{' '}
                        {new Date(upload.uploaded_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${getStatusPillClass(
                        upload.status
                      )}`}
                    >
                      {upload.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className='text-center py-12'>
          <p className='text-ink-900 font-semibold'>No data yet</p>
          <p className='text-sm text-ink-700 mt-2'>Upload your first file to get started.</p>
          <Link href='/upload' className='btn-glass-primary mt-5 inline-flex'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.9'
              className='h-4 w-4'
              aria-hidden='true'
            >
              <path d='M12 16V5m0 0 4 4m-4-4-4 4' strokeLinecap='round' strokeLinejoin='round' />
              <path d='M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3' strokeLinecap='round' />
            </svg>
            <span>Upload data</span>
          </Link>
        </div>
      )}
    </div>
  )
}
