import axios from 'axios'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

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
  uploadFile: (file: File, onUploadProgress?: (percent: number) => void) => {
    const formData = new FormData()
    formData.append('file', file)
    const authHeader = apiClient.defaults.headers.common['Authorization']
    return apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      onUploadProgress: onUploadProgress
        ? (event) => {
            const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0
            onUploadProgress(percent)
          }
        : undefined,
    })
  },
  getAnalysis: (executionId: string) =>
    apiClient.get(`/api/analysis/${executionId}`),
  getStatus: (executionId: string) =>
    apiClient.get(`/api/status/${executionId}`),
  getHistory: () => apiClient.get('/api/history'),
  deleteHistoryItems: (uploadIds: string[]) =>
    apiClient.delete('/api/history', {
      data: { upload_ids: uploadIds },
      timeout: 15000,
    }),
  getUploadContent: (uploadId: string, params?: { max_lines?: number; max_chars?: number }) =>
    apiClient.get(`/api/upload/${uploadId}/content`, { params }),
  getDashboardStats: () => apiClient.get('/api/dashboard'),
  getModelPerformance: () => apiClient.get('/api/model-performance'),
  retryAnalysis: (executionId: string) =>
    apiClient.post(`/api/retry/${executionId}`),
}
