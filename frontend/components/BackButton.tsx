'use client'

import { useRouter } from 'next/navigation'

type BackButtonProps = {
  fallbackHref?: string
  label?: string
  className?: string
}

export function BackButton({ fallbackHref = '/', label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      type='button'
      onClick={handleBack}
      className={`btn-primary ${className}`.trim()}
    >
      {label}
    </button>
  )
}
