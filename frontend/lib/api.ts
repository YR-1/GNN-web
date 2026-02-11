import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const setAuthToken = (token: string) => {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const removeAuthToken = () => {
  delete apiClient.defaults.headers.common['Authorization']
}

// API endpoints
export const api = {
  // Auth
  signup: (email: string, password: string) =>
    apiClient.post('/api/auth/signup', { email, password }),
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),
  logout: () => apiClient.post('/api/auth/logout'),

  // Analytics
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const authHeader = apiClient.defaults.headers.common['Authorization']
    return apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(authHeader && { 'Authorization': authHeader }),
      },
    })
  },
  getAnalysis: (executionId: string) =>
    apiClient.get(`/api/analysis/${executionId}`),
  getStatus: (executionId: string) =>
    apiClient.get(`/api/status/${executionId}`),
  getHistory: () => apiClient.get('/api/history'),
  getUploadContent: (uploadId: string, params?: { max_lines?: number; max_chars?: number }) =>
    apiClient.get(`/api/upload/${uploadId}/content`, { params }),
  getDashboardStats: () => apiClient.get('/api/dashboard'),
}
