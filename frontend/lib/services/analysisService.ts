import { api } from '@/lib/api'
import { CorrelationResults } from '@/lib/types'
import { handleServiceError } from './baseService'

export interface AnalysisResponse {
  status: string
  execution_id: string
  results?: CorrelationResults
}

export interface HistoryItem {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

export interface DashboardStats {
  total_uploads: number
  completed_analyses: number
  pending_analyses: number
  avg_processing_time: number
  total_analyses?: number
  failed_analyses?: number
  recent_uploads: RecentUpload[]
  dashboard_metrics?: Array<{
    id: string
    label: string
    shortLabel: string
    range: [number, number]
    average: number
    trend: number
    distribution: number[]
    cohortSplit: [number, number]
    confidence: number
    reliability: string
    insight: string
    topRegions: Array<{ name: string; contribution: number }>
    sampleSize: number
  }>
}

export interface RecentUpload {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

export interface StatusResponse {
  execution_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  message?: string
  result?: CorrelationResults
}

export interface UploadContentPreview {
  upload_id: string
  content: string
  n_lines: number
  n_chars: number
  truncated: boolean
}

export const analysisService = {
  async getAnalysis(executionId: string): Promise<AnalysisResponse> {
    try {
      const response = await api.getAnalysis(executionId)
      return response.data as AnalysisResponse
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async getStatus(executionId: string): Promise<StatusResponse> {
    try {
      const response = await api.getStatus(executionId)
      return response.data as StatusResponse
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async getHistory(): Promise<HistoryItem[]> {
    try {
      const response = await api.getHistory()
      return response.data as HistoryItem[]
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async getCompletedHistory(): Promise<HistoryItem[]> {
    try {
      const history = await this.getHistory()
      return history.filter((item) => item.status === 'completed' && item.execution_id)
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async getUploadContent(
    uploadId: string,
    options?: { maxLines?: number; maxChars?: number }
  ): Promise<UploadContentPreview> {
    try {
      const response = await api.getUploadContent(uploadId, {
        max_lines: options?.maxLines,
        max_chars: options?.maxChars,
      })
      return response.data as UploadContentPreview
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await api.getDashboardStats()
      return response.data as DashboardStats
    } catch (error) {
      return handleServiceError(error)
    }
  },

  async retryAnalysis(executionId: string): Promise<AnalysisResponse> {
    try {
      const response = await api.retryAnalysis(executionId)
      return response.data as AnalysisResponse
    } catch (error) {
      return handleServiceError(error)
    }
  },
}
