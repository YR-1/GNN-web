'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

const DEFAULT_REDIRECT_PATH = '/dashboard'
const DEPLOYED_AUTH_CALLBACK_ORIGIN = 'https://gnn-web.vercel.app'
const SESSION_DETECTION_WAIT_MS = 250
const VERIFIED_REDIRECT_DELAY_MS = 1800
type CallbackState = 'confirming' | 'verified' | 'error'

function normalizeOrigin(origin: string) {
  return new URL(origin).origin
}

function isDeployedOrigin(origin: string) {
  return normalizeOrigin(origin) === normalizeOrigin(DEPLOYED_AUTH_CALLBACK_ORIGIN)
}

function getSignupOrigin(value: string | null) {
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return ''
    }

    return url.origin
  } catch {
    return ''
  }
}

function normalizeRedirectPath(value: string | null) {
  if (!value || typeof window === 'undefined') {
    return DEFAULT_REDIRECT_PATH
  }

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) {
      return DEFAULT_REDIRECT_PATH
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_REDIRECT_PATH
  }
}

function getHashParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams()
  }

  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

function waitForSupabaseUrlDetection() {
  return new Promise<void>((resolve) => setTimeout(resolve, SESSION_DETECTION_WAIT_MS))
}

function buildLoginUrl(redirectTo: string) {
  const loginUrl = new URL('/login', window.location.origin)
  loginUrl.searchParams.set('from', redirectTo)
  loginUrl.searchParams.set('verified', '1')
  return `${loginUrl.pathname}${loginUrl.search}`
}

function getEmailOtpType(value: string | null): EmailOtpType {
  const validTypes: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']
  return validTypes.includes(value as EmailOtpType) ? value as EmailOtpType : 'signup'
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackStatus />}>
      <AuthCallback />
    </Suspense>
  )
}

function AuthCallback() {
  const [status, setStatus] = useState<CallbackState>('confirming')
  const [error, setError] = useState('')
  const [loginUrl, setLoginUrl] = useState('/login')
  const [manualReturn, setManualReturn] = useState(false)
  const [returnOrigin, setReturnOrigin] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    let cancelled = false

    const finishConfirmation = async () => {
      const redirectTo = normalizeRedirectPath(searchParams.get('from'))
      const shouldReturnManually = searchParams.get('source') === 'non-deployed'
        || (typeof window !== 'undefined' && !isDeployedOrigin(window.location.origin))
      const signupOrigin = getSignupOrigin(searchParams.get('signup_origin'))

      try {
        const hashParams = getHashParams()
        const authError = searchParams.get('error_description')
          || searchParams.get('error')
          || hashParams.get('error_description')
          || hashParams.get('error')

        if (authError) {
          throw new Error(authError)
        }

        const code = searchParams.get('code')
        let session: Session | null = null

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          session = data.session
        }

        if (!session) {
          const tokenHash = searchParams.get('token_hash')

          if (tokenHash) {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: getEmailOtpType(searchParams.get('type')),
            })
            if (verifyError) throw verifyError
            session = data.session
          }
        }

        if (!session) {
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) throw sessionError
            session = data.session
          }
        }

        if (!session) {
          await waitForSupabaseUrlDetection()
          const { data, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) throw sessionError
          session = data.session
        }

        if (!session) {
          throw new Error('Email confirmed, but no sign-in session was returned.')
        }

        await logout()

        if (!cancelled) {
          setLoginUrl(buildLoginUrl(redirectTo))
          setManualReturn(shouldReturnManually)
          setReturnOrigin(signupOrigin)
          setStatus('verified')
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Email confirmation failed.'
          setStatus('error')
          setError(message)
        }
      }
    }

    void finishConfirmation()

    return () => {
      cancelled = true
    }
  }, [logout, searchParams])

  useEffect(() => {
    if (status !== 'verified' || manualReturn) {
      return
    }

    const timeout = window.setTimeout(() => {
      router.replace(loginUrl)
    }, VERIFIED_REDIRECT_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [loginUrl, manualReturn, router, status])

  return (
    <CallbackStatus
      status={status}
      error={error}
      loginUrl={loginUrl}
      manualReturn={manualReturn}
      returnOrigin={returnOrigin}
    />
  )
}

function CallbackStatus({
  status = 'confirming',
  error = '',
  loginUrl = '/login',
  manualReturn = false,
  returnOrigin = '',
}: {
  status?: CallbackState
  error?: string
  loginUrl?: string
  manualReturn?: boolean
  returnOrigin?: string
}) {
  const isVerified = status === 'verified'
  const isError = status === 'error'

  return (
    <main className='app-bg'>
      <div className='noise-overlay' aria-hidden='true' />
      <section className='auth-shell'>
        <div className='auth-panel fade-in-up'>
          <div className='surface-card-strong w-full'>
            <div className='mb-0 flex items-center justify-center'>
              <Image src='/fyp-logo.png' alt='MindPulse' width={100} height={100} className='rounded-xl' />
            </div>
            <h1 className='font-display text-3xl text-ink-950 text-center'>
              {isError ? 'Confirmation Failed' : isVerified ? 'Email Verified' : 'Confirming Account'}
            </h1>
            <p className='section-subtitle text-center mt-2'>
              {isError
                ? error
                : isVerified
                  ? manualReturn
                    ? `Your account is verified. Go back to ${returnOrigin || 'the app where you signed up'}, then sign in.`
                    : 'Your account is verified. Taking you to sign in...'
                  : 'Checking your confirmation link...'}
            </p>
            {(isError || (isVerified && !manualReturn)) && (
              <Link href={isError ? '/login' : loginUrl} className='btn-primary w-full mt-6'>
                Go to Sign In
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
