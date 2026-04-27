import { create } from 'zustand'
import { supabase } from './supabase'
import { setAuthToken, removeAuthToken } from './api'
import { AnalysisResponse, User as BaseUser } from './types'

interface User extends BaseUser {
  access_token: string
}

const AUTH_SESSION_DURATION_MS = 60 * 60 * 1000
const AUTH_EXPIRES_AT_KEY = 'auth_expires_at'
let authExpiryTimer: ReturnType<typeof setTimeout> | null = null

// Helper to set auth cookie for middleware
function setAuthCookie(token: string, maxAgeSeconds = 60 * 60) {
  document.cookie = `token=${token}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

// Helper to remove auth cookie
function removeAuthCookie() {
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

function setAuthExpiry() {
  localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(Date.now() + AUTH_SESSION_DURATION_MS))
}

function clearAuthExpiry() {
  localStorage.removeItem(AUTH_EXPIRES_AT_KEY)
}

function clearAuthExpiryTimer() {
  if (authExpiryTimer) {
    clearTimeout(authExpiryTimer)
    authExpiryTimer = null
  }
}

function scheduleAuthExpiry(onExpire: () => void, maxAgeSeconds: number) {
  clearAuthExpiryTimer()
  if (maxAgeSeconds > 0) {
    authExpiryTimer = setTimeout(onExpire, maxAgeSeconds * 1000)
  }
}

function getRemainingSessionSeconds() {
  const expiresAt = Number(localStorage.getItem(AUTH_EXPIRES_AT_KEY))
  if (!Number.isFinite(expiresAt)) {
    return 0
  }

  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
}

interface AuthStore {
  user: User | null
  loading: boolean
  signup: (email: string, password: string) => Promise<boolean>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => {
  const expireSession = async () => {
    await supabase.auth.signOut()
    removeAuthToken()
    removeAuthCookie()
    clearAuthExpiry()
    clearAuthExpiryTimer()
    set({ user: null })
  }

  const scheduleLogout = (maxAgeSeconds = 60 * 60) => {
    scheduleAuthExpiry(() => {
      void expireSession()
    }, maxAgeSeconds)
  }

  return {
    user: null,
    // Start in loading state so protected routes wait for session restore on first paint.
    loading: true,

    signup: async (email: string, password: string) => {
      set({ loading: true })
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        const token = data.session?.access_token
        if (token) {
          setAuthExpiry()
          setAuthToken(token)
          setAuthCookie(token)
          scheduleLogout()
          set({
            user: {
              id: data.user?.id || '',
              email,
              access_token: token,
            },
          })
          return true
        }

        removeAuthToken()
        removeAuthCookie()
        clearAuthExpiry()
        clearAuthExpiryTimer()
        set({ user: null })
        return false
      } finally {
        set({ loading: false })
      }
    },

    login: async (email: string, password: string) => {
      set({ loading: true })
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        const token = data.session?.access_token || ''
        setAuthExpiry()
        setAuthToken(token)
        setAuthCookie(token)
        scheduleLogout()
        set({
          user: {
            id: data.user?.id || '',
            email,
            access_token: token,
          },
        })
      } finally {
        set({ loading: false })
      }
    },

    logout: expireSession,

    setUser: (user) => set({ user }),

    restoreSession: async () => {
      set({ loading: true })
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Session restore error:', error)
          throw error
        }

        if (data.session?.user) {
          const remainingSessionSeconds = getRemainingSessionSeconds()
          if (remainingSessionSeconds <= 0) {
            await expireSession()
            return
          }

          console.log('Session restored for user:', data.session.user.email)
          const token = data.session.access_token
          setAuthToken(token)
          setAuthCookie(token, remainingSessionSeconds)
          scheduleLogout(remainingSessionSeconds)
          set({
            user: {
              id: data.session.user.id,
              email: data.session.user.email || '',
              access_token: token,
            },
          })
        } else {
          console.log('No session found')
          removeAuthToken()
          removeAuthCookie()
          clearAuthExpiry()
          clearAuthExpiryTimer()
          set({ user: null })
        }
      } catch (error) {
        console.error('Failed to restore session:', error)
        removeAuthToken()
        removeAuthCookie()
        clearAuthExpiry()
        clearAuthExpiryTimer()
        set({ user: null })
      } finally {
        set({ loading: false })
      }
    },
  }
})

interface AnalysisStore {
  active_analysis: AnalysisResponse | null
  latest_analysis: AnalysisResponse | null
  setActiveAnalysis: (analysis: AnalysisResponse | null) => void
  setLatestAnalysis: (analysis: AnalysisResponse | null) => void
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  active_analysis: null,
  latest_analysis: null,
  setActiveAnalysis: (analysis) => set({ active_analysis: analysis }),
  setLatestAnalysis: (analysis) => set({ latest_analysis: analysis }),
}))

