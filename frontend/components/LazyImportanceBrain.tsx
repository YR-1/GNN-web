'use client'

import { useEffect, useRef, useState } from 'react'

interface LazyImportanceBrainProps {
  interactiveUrl: string
  staticUrl?: string | null
  title: string
  className?: string
  previewLabel?: string
}

export function LazyImportanceBrain({
  interactiveUrl,
  staticUrl,
  title,
  className = 'h-[500px]',
  previewLabel = 'Static anatomical preview',
}: LazyImportanceBrainProps) {
  const [showInteractive, setShowInteractive] = useState(false)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const prefetchedRef = useRef(false)

  useEffect(() => {
    setShowInteractive(false)
    setLoadedUrl(null)
    prefetchedRef.current = false
  }, [interactiveUrl])

  const prefetchInteractive = () => {
    if (prefetchedRef.current || typeof document === 'undefined') return
    prefetchedRef.current = true

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = interactiveUrl
    link.as = 'document'
    document.head.appendChild(link)
  }

  if (!showInteractive) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-brand-400/20 bg-white ${className}`}>
        {staticUrl ? (
          <img
            src={staticUrl}
            alt={`${title} static preview`}
            className='absolute inset-0 h-full w-full object-contain'
            loading='eager'
            decoding='async'
          />
        ) : (
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(59,130,246,0.16),transparent_32%),linear-gradient(135deg,#f8fafc,#e2e8f0)]' />
        )}

        <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/95 to-white/20 p-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'>{previewLabel}</p>
          <p className='mt-1 text-sm text-slate-700'>
            Interactive 3D is loaded only when needed so the prediction page opens faster.
          </p>
          <button
            type='button'
            onClick={() => setShowInteractive(true)}
            onFocus={prefetchInteractive}
            onMouseEnter={prefetchInteractive}
            className='btn-primary mt-3 px-4 py-2 text-xs'
          >
            Load interactive 3D brain
          </button>
        </div>
      </div>
    )
  }

  const isLoading = loadedUrl !== interactiveUrl

  return (
    <div className={`relative overflow-hidden rounded-xl border border-brand-400/20 bg-white ${className}`}>
      {isLoading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-white text-sm text-ink-700'>
          <div className='text-center'>
            <div className='loading-spinner mx-auto mb-3' />
            <p>Loading interactive brain plot...</p>
          </div>
        </div>
      )}
      <iframe
        title={title}
        src={interactiveUrl}
        onLoad={() => setLoadedUrl(interactiveUrl)}
        className={`h-full w-full border-0 transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        loading='lazy'
        sandbox='allow-scripts allow-same-origin'
      />
    </div>
  )
}
