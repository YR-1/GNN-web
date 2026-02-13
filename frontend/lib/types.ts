// ===== Plotly & Visualization =====
export interface PlotlyJson {
  data: unknown[]
  layout: Record<string, unknown>
}

export interface ConnectomeLink {
  source_roi: number
  target_roi: number
  weight: number
  abs_weight: number
  sign: 'positive' | 'negative'
  source_label?: string
  target_label?: string
}

// ===== Predictions =====
export interface PredictedScore {
  score_id: string
  value: number
  ci95_lower?: number
  ci95_upper?: number
  n_graph_windows?: number
  model_file?: string
  source?: string
}

// ===== Correlation Results =====
export interface CorrelationResults {
  n_rois: number
  n_timepoints: number
  correlation_matrix: number[][]
  plotly_json: PlotlyJson
  file_size: number
  file_name: string
  nilearn_connectome_html?: string | null
  top_links?: ConnectomeLink[]
  top_link_count?: number
  connectome_library?: string
  connectome_coordinates_source?: string
  connectome_error?: string | null
  nilearn_markers_png_base64?: string | null
  markers_library?: string
  markers_view?: string
  markers_error?: string | null
  predicted_scores?: PredictedScore[]
  prediction_errors?: string[]
  graph_window_count?: number
  error?: string
}

// ===== Analysis & Execution =====
export interface AnalysisResponse {
  status: string
  execution_id: string
  results?: CorrelationResults
}

export type ExecutionStatusValue = 'queued' | 'processing' | 'completed' | 'failed'

export interface StatusResponse {
  execution_id: string
  status: ExecutionStatusValue
  message?: string
  result?: CorrelationResults
}

// ===== History & Uploads =====
export interface HistoryItem {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

export interface UploadContentPreview {
  upload_id: string
  content: string
  n_lines: number
  n_chars: number
  truncated: boolean
}

export interface UploadResponse {
  upload_id: string
  execution_id: string
  file_name: string
  status: string
}

// ===== Dashboard =====
export interface RecentUpload {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

export interface DashboardStats {
  total_uploads: number
  total_analyses: number
  completed_analyses: number
  failed_analyses: number
  recent_uploads: RecentUpload[]
}

// ===== Statistics =====
export interface MatrixSummary {
  mean: number
  median: number
  min: number
  max: number
  positiveRatio: number
}

// ===== Authentication =====
export interface User {
  id: string
  email: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

