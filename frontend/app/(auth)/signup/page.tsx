'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const router = useRouter()
  const { signup } = useAuthStore()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const hasSession = await signup(email, password)
      if (hasSession) {
        router.push('/dashboard')
        return
      }
      setConfirmed(true)
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  // Show confirmation message
  if (confirmed) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center px-4 py-8'>
        <div className='w-full max-w-md'>
          <div className='bg-white/50 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 p-8 text-center'>
            <div className='text-6xl mb-6 animate-bounce'>✨</div>
            <h1 className='text-3xl font-bold text-amber-900 mb-4'>Account Created!</h1>
            <p className='text-amber-800 mb-6'>
              Check your inbox to confirm your email before signing in.
            </p>
            <button
              onClick={() => router.push('/login')}
              className='w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white font-semibold py-3 rounded-xl hover:from-orange-500 hover:to-amber-600 transition-all duration-200 shadow-lg shadow-orange-300/30 hover:shadow-orange-400/40'
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center px-4 py-8'>
      <div className='w-full max-w-md'>
        {/* Logo */}
        <div className='flex justify-center mb-8'>
          <div className='w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-300/40'>
            <span className='text-4xl'>🧠</span>
          </div>
        </div>

        {/* Form Container */}
        <div className='bg-white/50 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 p-8'>
          <h1 className='text-3xl font-bold text-amber-900 mb-2 text-center'>Join ROI Analyzer</h1>
          <p className='text-amber-700 text-center mb-8'>Create your account to get started</p>

          {error && (
            <div className='bg-rose-300/40 border border-rose-300/60 text-rose-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3'>
              <span className='text-xl'>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className='space-y-5'>
            <div>
              <label className='block text-amber-900 font-medium mb-2'>Email Address</label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full px-4 py-3 bg-white/30 border border-white/40 rounded-lg text-amber-900 placeholder-amber-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200'
                placeholder='you@example.com'
              />
            </div>

            <div>
              <label className='block text-amber-900 font-medium mb-2'>Password</label>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='w-full px-4 py-3 bg-white/30 border border-white/40 rounded-lg text-amber-900 placeholder-amber-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200'
                placeholder='••••••••'
              />
            </div>

            <button
              type='submit'
              disabled={loading}
              className='w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white font-semibold py-3 rounded-xl hover:from-orange-500 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-300/30 hover:shadow-orange-400/40'
            >
              {loading ? (
                <span className='flex items-center justify-center gap-2'>
                  <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent'></div>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className='relative mt-6 mb-6'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-white/30'></div>
            </div>
            <div className='relative flex justify-center text-sm'>
              <span className='px-2 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-amber-700 font-medium'>Already a member?</span>
            </div>
          </div>

          <Link
            href='/login'
            className='block w-full text-center bg-white/30 hover:bg-white/50 text-amber-900 font-semibold py-3 rounded-lg border border-white/40 hover:border-white/60 transition-all duration-200'
          >
            Sign In
          </Link>
        </div>

        {/* Footer */}
        <p className='text-center text-amber-700 text-sm mt-8 font-medium'>
          By creating an account, you agree to our{' '}
          <a href='#' className='text-orange-600 hover:text-orange-700'>
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  )
}
