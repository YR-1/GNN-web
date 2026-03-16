'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DivProps extends React.HTMLAttributes<HTMLDivElement> {}

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div
      className='fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6'
      role='dialog'
      aria-modal='true'
      onClick={() => onOpenChange(false)}
    >
      <div className='absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]' aria-hidden='true' />
      <div className='relative z-10 w-full max-h-[90vh] overflow-y-auto' onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function DialogContent({ className = '', ...props }: DivProps) {
  return (
    <div
      className={`mx-auto w-full rounded-2xl border border-brand-400/25 bg-white/95 p-5 shadow-xl sm:p-6 ${className}`}
      {...props}
    />
  )
}

export function DialogHeader({ className = '', ...props }: DivProps) {
  return <div className={`space-y-1.5 ${className}`} {...props} />
}

export function DialogTitle({ className = '', ...props }: HeadingProps) {
  return <h2 className={`text-lg font-semibold text-ink-950 ${className}`} {...props} />
}
