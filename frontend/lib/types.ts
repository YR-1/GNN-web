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
  model_architecture?: string
  value_scale?: string
  normalized_value?: number
  target_scaler?: string
  source?: string
}

export interface ExplainedEdge {
  source_roi: number
  target_roi: number
  source_label?: string
  target_label?: string
  importance: number
  window_count?: number
}

export interface ROIImportance {
  roi_index: number
  label: string
  importance: number
}

export interface ExplainedWindow {
  window_index: number
  importance: number
  prediction: number
}

export interface ExplainedScore {
  score_id: string
  model_file?: string
  source?: string
  top_edges: ExplainedEdge[]
  roi_importance: ROIImportance[]
  top_windows: ExplainedWindow[]
  n_graph_windows?: number
  method?: string
}

export interface ModelRegistryEntry {
  filename: string
  path: string
  exists: boolean
}

export interface TimeSeriesLine {
  roi_index: number
  label: string
  values: number[]
}

export interface TimeSeriesPayload {
  source: string
  default_view: string
  tr_index: number[]
  global_signal: number[]
  roi_series: TimeSeriesLine[]
}

// ===== Correlation Results =====
export interface CorrelationResults {
  n_rois: number
  n_timepoints: number
  correlation_matrix: number[][]
  plotly_json?: PlotlyJson | null
  file_size: number
  file_name: string
  nilearn_connectome_html?: string | null
  importance_brain_urls?: Record<string, string>
  importance_static_brain_urls?: Record<string, string>
  listsort_importance_brain_url?: string | null
  listsort_importance_static_brain_url?: string | null
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
  explained_scores?: ExplainedScore[]
  prediction_errors?: string[]
  graph_window_count?: number
  model_registry_dir?: string
  model_registry?: Record<string, ModelRegistryEntry>
  time_series?: TimeSeriesPayload
  error?: string
}

// ===== Analysis & Execution =====
export interface AnalysisResponse {
  status: string
  execution_id: string
  results?: CorrelationResults & { error?: string }
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

