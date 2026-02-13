'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className='min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-slate-50'>
      <div className='surface-card max-w-md w-full text-center'>
        <div className='text-red-500 text-5xl mb-4'>⚠️</div>
        <h1 className='text-2xl font-bold text-ink-950 mb-2'>Something went wrong</h1>
        <p className='text-sm text-ink-700 mb-6'>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className='space-y-2'>
          <button onClick={reset} className='btn-primary w-full'>
            Try again
          </button>
          <a href='/' className='btn-secondary w-full block'>
            Go to home
          </a>
        </div>
      </div>
    </div>
  )
}
