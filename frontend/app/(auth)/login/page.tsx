'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuthStore()

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
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
          <div className='mb-5 flex items-center justify-center gap-3'>
            <div className='brand-mark'>RA</div>
            <p className='font-display text-xl text-ink-950'>ROI Analyzer</p>
          </div>

          <div className='surface-card-strong'>
            <h1 className='font-display text-3xl text-ink-950 text-center'>Welcome Back</h1>
            <p className='section-subtitle text-center mt-2'>
              Sign in to continue your ROI correlation workflow.
            </p>

            {error && (
              <div className='status-banner status-banner-error mt-6'>
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
                  placeholder='Enter your password'
                  className='input-field'
                  autoComplete='current-password'
                />
              </div>

              <button type='submit' disabled={loading} className='btn-primary w-full'>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className='mt-6 rounded-xl border border-brand-400/25 bg-white/70 p-4 text-sm text-ink-700'>
              Need an account?{' '}
              <Link href='/signup' className='font-semibold text-brand-700 hover:text-brand-600'>
                Create one
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
