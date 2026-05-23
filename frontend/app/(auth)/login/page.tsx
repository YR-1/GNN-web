'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { useAuthStore } from '@/lib/store'

const formatLoginError = (rawMessage: string) => {
  const message = rawMessage.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }
  if (message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (message.includes('network')) {
    return 'Network error while signing in. Please check your connection.'
  }

  return rawMessage
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, user, loading: authLoading } = useAuthStore()
  const redirectTo = searchParams.get('from') || '/dashboard'
  const verified = searchParams.get('verified') === '1'

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo)
    }
  }, [authLoading, user, router, redirectTo])

  const isSubmitDisabled = submitting || authLoading || !email.trim() || password.length === 0

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitDisabled) return

    setSubmitting(true)
    setError('')

    try {
      await login(email.trim(), password)
      router.replace(redirectTo)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(formatLoginError(message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className='app-bg'>
      <div className='noise-overlay' aria-hidden='true' />
      <section className='auth-shell'>
        <div className='auth-panel fade-in-up'>
          <div className='surface-card-strong w-full'>
            <div className='mb-0 flex items-center justify-center'>
              <Image src='/fyp-logo.png' alt='MindPulse' width={100} height={100} className='rounded-xl' />
            </div>
            <h1 className='font-display text-3xl text-ink-950 text-center'>Welcome Back</h1>
            <p className='section-subtitle text-center mt-2'>
              Sign in to continue your ROI correlation workflow.
            </p>
            <p className='text-xs text-ink-700 text-center mt-2'>
              Your session is kept in this browser for faster return access.
            </p>

            {verified && (
              <div className='status-banner status-banner-success mt-6' role='status'>
                <p>Email verified. Please sign in to continue.</p>
              </div>
            )}

            {error && (
              <div className='status-banner status-banner-error mt-6' role='alert' aria-live='polite'>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className='mt-6 space-y-4'>
              <div>
                <label htmlFor='email' className='block mb-2 text-sm font-semibold text-ink-800'>
                  Email address
                </label>
                <input
                  id='email'
                  type='email'
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder='you@example.com'
                  className='input-field'
                  autoComplete='email'
                  inputMode='email'
                  disabled={submitting || authLoading}
                />
              </div>

              <div>
                <label htmlFor='password' className='block mb-2 text-sm font-semibold text-ink-800'>
                  Password
                </label>
                <div className='relative'>
                  <input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLockOn(false)}
                    placeholder='Enter your password'
                    className='input-field pr-16'
                    autoComplete='current-password'
                    disabled={submitting || authLoading}
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword((prev) => !prev)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-700 hover:text-brand-600'
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {capsLockOn && (
                  <p className='mt-2 text-xs text-amber-700'>Caps Lock is on.</p>
                )}
              </div>

              <button type='submit' disabled={isSubmitDisabled} className='btn-primary w-full'>
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className='mt-6 rounded-xl border border-brand-400/25 bg-white/70 p-4 text-sm text-ink-700'>
              Need an account?{' '}
              <Link href={`/signup?from=${encodeURIComponent(redirectTo)}`} className='font-semibold text-brand-700 hover:text-brand-600'>
                Create one
              </Link>
            </div>

            <div className='mt-6'>
              <BackButton fallbackHref={redirectTo} className='w-full' />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
