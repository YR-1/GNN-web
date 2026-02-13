'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className='page-container'>
      <div className='surface-card max-w-lg mx-auto text-center'>
        <div className='text-red-500 text-4xl mb-4'>⚠️</div>
        <h2 className='text-xl font-semibold text-ink-950 mb-2'>Error loading dashboard</h2>
        <p className='text-sm text-ink-700 mb-6'>
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <div className='flex gap-3 justify-center'>
          <button onClick={reset} className='btn-primary'>
            Try again
          </button>
          <Link href='/dashboard' className='btn-secondary'>
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
