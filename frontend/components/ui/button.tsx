import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}

export function Button({
  children,
  size = 'md',
  variant = 'default',
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const variantClasses: Record<string, string> = {
    default: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    outline: 'border border-brand-600 text-brand-600 hover:bg-blue-50 bg-transparent',
    secondary: 'bg-white text-brand-700 hover:bg-gray-50 shadow-sm',
    ghost: 'bg-transparent text-ink-800 hover:bg-slate-100 shadow-none',
  }

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
