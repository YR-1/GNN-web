import { create } from 'zustand'
import { supabase } from './supabase'
import { setAuthToken, removeAuthToken } from './api'
import { User as BaseUser } from './types'

interface User extends BaseUser {
  access_token: string
}

// Helper to set auth cookie for middleware
function setAuthCookie(token: string) {
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
}

// Helper to remove auth cookie
function removeAuthCookie() {
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
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

export const useAuthStore = create<AuthStore>((set) => ({
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
        setAuthToken(token)
        setAuthCookie(token)
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
      setAuthToken(token)
      setAuthCookie(token)
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

  logout: async () => {
    await supabase.auth.signOut()
    removeAuthToken()
    removeAuthCookie()
    set({ user: null })
  },

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
        console.log('Session restored for user:', data.session.user.email)
        const token = data.session.access_token
        setAuthToken(token)
        setAuthCookie(token)
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
        set({ user: null })
      }
    } catch (error) {
      console.error('Failed to restore session:', error)
      removeAuthToken()
      removeAuthCookie()
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },
}))

