'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'

interface HistoryItem {
  upload_id: string
  file_name: string
  uploaded_at: string
  status: string
  execution_id?: string
}

interface AnalysisResult {
  execution_id: string
  file_name: string
  num_rois?: number
  num_timepoints?: number
  pearson_mean?: number
  pearson_median?: number
  ledoit_wolf_mean?: number
  ledoit_wolf_median?: number
  timestamp?: string
}

interface UploadContentPreview {
  upload_id: string
  file_name: string
  content: string
  truncated: boolean
  lines_returned: number
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<{ [key: string]: AnalysisResult }>({})
  const [loadingAnalysis, setLoadingAnalysis] = useState<{ [key: string]: boolean }>({})
  const [contentData, setContentData] = useState<{ [key: string]: UploadContentPreview }>({})
  const [loadingContent, setLoadingContent] = useState<{ [key: string]: boolean }>({})
  const [contentError, setContentError] = useState<{ [key: string]: string }>({})
  const [showContent, setShowContent] = useState<{ [key: string]: boolean }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { user, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    const fetchHistory = async () => {
      try {
        const response = await api.getHistory()
        setHistory(response.data)
      } catch (err: any) {
        setError('Failed to fetch history')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [user, router])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const fetchAnalysisData = async (executionId: string) => {
    if (analysisData[executionId]) return

    setLoadingAnalysis((prev) => ({ ...prev, [executionId]: true }))
    try {
      const response = await api.getAnalysis(executionId)
      setAnalysisData((prev) => ({
        ...prev,
        [executionId]: response.data,
      }))
    } catch (err) {
      console.error('Failed to fetch analysis data:', err)
    } finally {
      setLoadingAnalysis((prev) => ({ ...prev, [executionId]: false }))
    }
  }

  const fetchFileContent = async (uploadId: string) => {
    if (contentData[uploadId]) return

    setLoadingContent((prev) => ({ ...prev, [uploadId]: true }))
    setContentError((prev) => ({ ...prev, [uploadId]: '' }))
    try {
      const response = await api.getUploadContent(uploadId, { max_lines: 200, max_chars: 20000 })
      setContentData((prev) => ({
        ...prev,
        [uploadId]: response.data,
      }))
    } catch (err) {
      setContentError((prev) => ({ ...prev, [uploadId]: 'Failed to load file content' }))
    } finally {
      setLoadingContent((prev) => ({ ...prev, [uploadId]: false }))
    }
  }

  const toggleContent = (uploadId: string) => {
    setShowContent((prev) => {
      const next = !prev[uploadId]
      if (next && !contentData[uploadId]) {
        fetchFileContent(uploadId)
      }
      return { ...prev, [uploadId]: next }
    })
  }

  const toggleExpanded = (uploadId: string, executionId?: string) => {
    setExpandedId(expandedId === uploadId ? null : uploadId)
    if (expandedId !== uploadId && executionId && !analysisData[executionId]) {
      fetchAnalysisData(executionId)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅'
      case 'processing':
        return '⏳'
      case 'queued':
        return '📋'
      case 'failed':
        return '❌'
      default:
        return '❓'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
      case 'processing':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-200'
      case 'queued':
        return 'bg-amber-500/20 border-amber-500/50 text-amber-200'
      case 'failed':
        return 'bg-red-500/20 border-red-500/50 text-red-200'
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-200'
    }
  }



  if (!user) return null

  return (
    <div className='min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50'>
      {/* Navigation */}
      <nav className='bg-white/50 backdrop-blur-md border-b border-white/40 sticky top-0 z-50'>
        <div className='max-w-7xl mx-auto px-6 py-4 flex justify-between items-center'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-600 rounded-lg flex items-center justify-center shadow-md'>
              <span className='text-white font-bold'>📊</span>
            </div>
            <h1 className='text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent'>
              ROI Analyzer
            </h1>
          </div>
          <div className='flex gap-4 items-center'>
            <span className='text-amber-900 text-sm font-medium'>{user.email}</span>
            <button
              onClick={handleLogout}
              className='bg-rose-300/60 hover:bg-rose-400/70 text-rose-800 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-rose-300/30 font-medium'
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className='max-w-7xl mx-auto px-6 py-12'>
        {/* Navigation Tabs */}
        <div className='flex gap-3 mb-12 overflow-x-auto pb-2'>
          <Link href='/dashboard' className='nav-link'>Dashboard</Link>
          <Link href='/upload' className='nav-link'>Upload Data</Link>
          <Link href='/statistics' className='nav-link'>Statistics</Link>
          <Link href='/history' className='nav-link-active'>History</Link>
        </div>

        {/* Page Header */}
        <div className='mb-12'>
          <h2 className='text-4xl font-bold text-amber-900 mb-2'>Upload History</h2>
          <p className='text-amber-700'>View all your uploaded files and analysis results</p>
        </div>

        {error && (
          <div className='bg-rose-300/40 border border-rose-300/60 text-rose-800 px-4 py-3 rounded-lg mb-8 flex items-center gap-3'>
            <span className='text-xl'>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* History Cards */}
        {loading ? (
          <div className='flex justify-center items-center py-20'>
            <div className='animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-amber-600'></div>
            <p className='text-amber-900 ml-4 font-medium'>Loading files...</p>
          </div>
        ) : history.length === 0 ? (
          <div className='bg-white/50 backdrop-blur-md rounded-2xl border border-white/40 p-12 text-center'>
            <p className='text-amber-900 mb-4 text-lg'>📁 No files uploaded yet</p>
            <Link href='/upload' className='text-orange-600 hover:text-orange-700 font-semibold text-lg'>
              Upload your first file →
            </Link>
          </div>
        ) : (
          <div className='space-y-4'>
            {history.map((item) => (
              <div
                key={item.upload_id}
                className='bg-white/50 backdrop-blur-md rounded-2xl border border-white/40 overflow-hidden hover:border-white/60 transition-all duration-200'
              >
                {/* File Card Header */}
                <button
                  onClick={() => toggleExpanded(item.upload_id, item.execution_id)}
                  className='w-full p-6 hover:bg-orange-100/20 transition-colors duration-200 text-left'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex items-start gap-4 flex-1'>
                      {/* Status Icon */}
                      <div className='text-3xl mt-1'>{getStatusIcon(item.status)}</div>

                      {/* File Info */}
                      <div className='flex-1'>
                        <h3 className='text-xl font-bold text-amber-900 mb-2'>{item.file_name}</h3>
                        <div className='flex items-center gap-4 text-sm text-amber-700'>
                          <span>📅 {new Date(item.uploaded_at).toLocaleDateString()}</span>
                          <span>🕐 {new Date(item.uploaded_at).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-block px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadge(
                          item.status
                        )} whitespace-nowrap`}
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </div>

                    {/* Expand Icon */}
                    <div className='ml-4 text-gray-400 text-xl'>
                      {expandedId === item.upload_id ? '▼' : '▶'}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === item.upload_id && (
                  <div className='border-t border-white/30 bg-orange-100/20 p-6'>
                    <div className='space-y-6'>
                      {item.status === 'completed' && item.execution_id ? (
                        loadingAnalysis[item.execution_id] ? (
                          <div className='flex items-center justify-center py-8'>
                            <div className='animate-spin rounded-full h-8 w-8 border-3 border-orange-400 border-t-amber-600 mr-3'></div>
                            <p className='text-amber-900 font-medium'>Loading analysis results...</p>
                          </div>
                        ) : analysisData[item.execution_id] ? (
                          <div className='space-y-6'>
                            {/* File Stats */}
                            <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                              {analysisData[item.execution_id].num_rois && (
                                <div className='bg-blue-200/40 rounded-lg p-4 border border-blue-200/60'>
                                  <p className='text-amber-900 text-sm'>📊 ROIs</p>
                                  <p className='text-2xl font-bold text-blue-700'>
                                    {analysisData[item.execution_id].num_rois}
                                  </p>
                                </div>
                              )}
                              {analysisData[item.execution_id].num_timepoints && (
                                <div className='bg-purple-200/40 rounded-lg p-4 border border-purple-200/60'>
                                  <p className='text-amber-900 text-sm'>⏱️ Timepoints</p>
                                  <p className='text-2xl font-bold text-purple-700'>
                                    {analysisData[item.execution_id].num_timepoints}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Correlation Stats */}
                            <div>
                              <h4 className='text-lg font-semibold text-amber-900 mb-4'>📈 Correlation Analysis</h4>
                              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                {analysisData[item.execution_id].pearson_mean !== undefined && (
                                  <div className='bg-emerald-200/40 rounded-lg p-3 border border-emerald-200/60'>
                                    <p className='text-amber-900 text-xs'>Pearson Mean</p>
                                    <p className='text-lg font-bold text-emerald-700'>
                                      {analysisData[item.execution_id].pearson_mean?.toFixed(3)}
                                    </p>
                                  </div>
                                )}
                                {analysisData[item.execution_id].pearson_median !== undefined && (
                                  <div className='bg-emerald-200/40 rounded-lg p-3 border border-emerald-200/60'>
                                    <p className='text-amber-900 text-xs'>Pearson Median</p>
                                    <p className='text-lg font-bold text-emerald-700'>
                                      {analysisData[item.execution_id].pearson_median?.toFixed(3)}
                                    </p>
                                  </div>
                                )}
                                {analysisData[item.execution_id].ledoit_wolf_mean !== undefined && (
                                  <div className='bg-amber-200/40 rounded-lg p-3 border border-amber-200/60'>
                                    <p className='text-amber-900 text-xs'>Ledoit-Wolf Mean</p>
                                    <p className='text-lg font-bold text-amber-700'>
                                      {analysisData[item.execution_id].ledoit_wolf_mean?.toFixed(3)}
                                    </p>
                                  </div>
                                )}
                                {analysisData[item.execution_id].ledoit_wolf_median !== undefined && (
                                  <div className='bg-amber-200/40 rounded-lg p-3 border border-amber-200/60'>
                                    <p className='text-amber-900 text-xs'>Ledoit-Wolf Median</p>
                                    <p className='text-lg font-bold text-amber-700'>
                                      {analysisData[item.execution_id].ledoit_wolf_median?.toFixed(3)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action Button */}
                            <Link
                              href={`/statistics?executionId=${item.execution_id}`}
                              className='inline-block bg-gradient-to-r from-orange-400 to-amber-500 text-white font-semibold px-6 py-3 rounded-xl hover:from-orange-500 hover:to-amber-600 transition-all duration-200 shadow-lg shadow-orange-300/30 hover:shadow-orange-400/40'
                            >
                              View Full Analysis & Heatmap →
                            </Link>
                          </div>
                        ) : (
                          <p className='text-amber-900'>No analysis data available</p>
                        )
                      ) : item.status === 'processing' || item.status === 'queued' ? (
                        <div className='flex items-center gap-3 text-amber-800'>
                          <div className='animate-spin rounded-full h-5 w-5 border-2 border-orange-400 border-t-transparent'></div>
                          <p>
                            {item.status === 'processing'
                              ? 'Processing your file... This may take a few moments.'
                              : 'File is queued for processing.'}
                          </p>
                        </div>
                      ) : (
                        <p className='text-rose-700'>⚠️ Analysis failed. Please try uploading again.</p>
                      )}

                      {/* File Preview */}
                      <div className='bg-white/60 rounded-xl border border-white/60 p-4'>
                        <div className='flex items-center justify-between mb-3'>
                          <h4 className='text-lg font-semibold text-amber-900'>📄 File Preview</h4>
                          <button
                            onClick={() => toggleContent(item.upload_id)}
                            className='text-sm font-semibold text-orange-700 hover:text-orange-800 bg-white/60 px-3 py-1 rounded-lg border border-white/60'
                          >
                            {showContent[item.upload_id] ? 'Hide' : 'View'}
                          </button>
                        </div>

                        {!showContent[item.upload_id] && (
                          <p className='text-amber-700 text-sm'>Preview the first 200 lines of your uploaded file.</p>
                        )}

                        {showContent[item.upload_id] && loadingContent[item.upload_id] && (
                          <div className='flex items-center gap-2 text-amber-800'>
                            <div className='animate-spin rounded-full h-4 w-4 border-2 border-orange-400 border-t-transparent'></div>
                            <span>Loading file content...</span>
                          </div>
                        )}

                        {showContent[item.upload_id] && contentError[item.upload_id] && (
                          <p className='text-rose-700 text-sm'>{contentError[item.upload_id]}</p>
                        )}

                        {showContent[item.upload_id] && contentData[item.upload_id] && (
                          <div className='mt-3'>
                            <pre className='whitespace-pre-wrap text-xs text-amber-900 bg-orange-50/60 border border-orange-200/60 rounded-lg p-3 max-h-64 overflow-auto'>
                              {contentData[item.upload_id].content}
                            </pre>
                            {contentData[item.upload_id].truncated && (
                              <p className='text-amber-700 text-xs mt-2'>
                                Preview truncated to {contentData[item.upload_id].lines_returned} lines.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
