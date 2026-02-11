import { create } from 'zustand'
import { supabase } from './supabase'
import { setAuthToken, removeAuthToken } from './api'

interface User {
  id: string
  email: string
  access_token: string
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
  loading: false,

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
      }
    } catch (error) {
      console.error('Failed to restore session:', error)
      removeAuthToken()
    } finally {
      set({ loading: false })
    }
  },
}))

