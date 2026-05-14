'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { useAuthStore } from '@/lib/store'

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signup } = useAuthStore()
  const redirectTo = searchParams.get('from') || '/dashboard'

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const hasSession = await signup(email, password)
      if (hasSession) {
        router.push(redirectTo)
        return
      }
      setConfirmed(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className='app-bg'>
      <div className='noise-overlay' aria-hidden='true' />
      <section className='page-shell min-h-screen flex items-center justify-center'>
        <div className='w-full max-w-md fade-in-up'>
          <div className='flex items-center justify-center'>
            <Image src='/fyp-logo.png' alt='MindPulse' width={200} height={200} className='rounded-xl' />
          </div>

          <div className='surface-card-strong'>
            {confirmed ? (
              <>
                <h1 className='font-display text-3xl text-ink-950 text-center'>Account Created</h1>
                <p className='section-subtitle text-center mt-2'>
                  Verify your email, then sign in to continue.
                </p>
                <button type='button' className='btn-primary w-full mt-6' onClick={() => router.push(`/login?from=${encodeURIComponent(redirectTo)}`)}>
                  Go to Sign In
                </button>
                <div className='mt-6'>
                  <BackButton fallbackHref={redirectTo} className='w-full' />
                </div>
              </>
            ) : (
              <>
                <h1 className='font-display text-3xl text-ink-950 text-center'>Create Account</h1>
                <p className='section-subtitle text-center mt-2'>
                  Start uploading ROI time-series files in minutes.
                </p>

                {error && (
                  <div className='status-banner status-banner-error mt-6'>
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleSignup} className='mt-6 space-y-4'>
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
                    />
                  </div>

                  <div>
                    <label htmlFor='password' className='block mb-2 text-sm font-semibold text-ink-800'>
                      Password
                    </label>
                    <input
                      id='password'
                      type='password'
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder='Create a secure password'
                      className='input-field'
                      autoComplete='new-password'
                    />
                  </div>

                  <button type='submit' disabled={loading} className='btn-primary w-full'>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>

                <div className='mt-6 rounded-xl border border-brand-400/25 bg-white/70 p-4 text-sm text-ink-700'>
                  Already registered?{' '}
                  <Link href={`/login?from=${encodeURIComponent(redirectTo)}`} className='font-semibold text-brand-700 hover:text-brand-600'>
                    Sign in
                  </Link>
                </div>

                <div className='mt-6'>
                  <BackButton fallbackHref={redirectTo} className='w-full' />
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
