import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-brand-400/20 bg-white/70 backdrop-blur-sm shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
