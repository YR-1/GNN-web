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
      const hasSession = await signup(email, password, redirectTo)
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
      <section className='auth-shell'>
        <div className='auth-panel fade-in-up'>
          <div className='surface-card-strong w-full'>
            {confirmed ? (
              <>
                <div className='mb-0 flex items-center justify-center'>
                  <Image src='/fyp-logo.png' alt='MindPulse' width={100} height={100} className='rounded-xl' />
                </div>
                <h1 className='font-display text-3xl text-ink-950 text-center'>Waiting for Verification</h1>
                <p className='section-subtitle text-center mt-2'>
                  We sent a confirmation link to {email}. Open the email and click the link to verify your account.
                </p>
                <p className='text-xs text-ink-700 text-center mt-2'>
                  After verification, we will bring you back to sign in.
                </p>
                <div className='mt-6'>
                  <BackButton fallbackHref={redirectTo} className='w-full' />
                </div>
              </>
            ) : (
              <>
                <div className='mb-0 flex items-center justify-center'>
                  <Image src='/fyp-logo.png' alt='MindPulse' width={100} height={100} className='rounded-xl' />
                </div>
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
