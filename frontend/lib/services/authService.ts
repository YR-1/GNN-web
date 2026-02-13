import { api, setAuthToken, removeAuthToken } from '@/lib/api'
import { handleServiceError } from './baseService'

interface AuthResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    email: string
  }
}

export const authService = {
  async signup(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.signup(email, password)
      const data = response.data as AuthResponse

      if (data.access_token) {
        setAuthToken(data.access_token)
        localStorage.setItem('token', data.access_token)
      }

      return data
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.login(email, password)
      const data = response.data as AuthResponse

      if (data.access_token) {
        setAuthToken(data.access_token)
        localStorage.setItem('token', data.access_token)
      }

      return data
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async logout(): Promise<void> {
    try {
      await api.logout()
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error)
    } finally {
      removeAuthToken()
      localStorage.removeItem('token')
    }
  },

  restoreSession(): boolean {
    const token = localStorage.getItem('token')
    if (token) {
      setAuthToken(token)
      return true
    }
    return false
  },

  clearSession(): void {
    removeAuthToken()
    localStorage.removeItem('token')
  },
}
