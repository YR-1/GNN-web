'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'

const CorrelationMatrix = dynamic(() => import('@/components/CorrelationMatrix'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-96"><div className="text-gray-500">Loading chart...</div></div>,
})

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [analysisResults, setAnalysisResults] = useState<any | null>(null)
  const { user, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file extension
      if (!selectedFile.name.endsWith('.txt')) {
        setError('Only .txt files are allowed')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a TXT file')
      return
    }

    setUploading(true)
    setError('')

    try {
      const response = await api.uploadFile(file)
      setUploadId(response.data.upload_id)
      setExecutionId(response.data.execution_id || response.data.upload_id)
      setFile(null)
      
      // Poll for results
      pollForResults(response.data.execution_id || response.data.upload_id)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const pollForResults = async (execId: string, attempts = 0) => {
    if (attempts > 30) {
      setError('Analysis took too long. Please check back later.')
      return
    }

    try {
      const response = await api.getAnalysis(execId)
      if (response.data.status === 'completed') {
        setAnalysisResults(response.data.results)
      } else if (response.data.status === 'failed') {
        setError(`Analysis failed: ${response.data.results?.error || 'Unknown error'}`)
      } else {
        // Still processing, poll again
        setTimeout(() => pollForResults(execId, attempts + 1), 1000)
      }
    } catch (err: any) {
      setError('Failed to fetch analysis results')
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
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
          <Link
            href='/dashboard'
            className='nav-link'
          >
            Dashboard
          </Link>
          <Link
            href='/upload'
            className='nav-link-active'
          >
            Upload Data
          </Link>
          <Link
            href='/statistics'
            className='nav-link'
          >
            Statistics
          </Link>
          <Link
            href='/history'
            className='nav-link'
          >
            History
          </Link>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* Upload Form */}
          <div className='bg-white/50 backdrop-blur-md rounded-2xl shadow-lg p-8 border border-white/40 hover:border-white/60 transition-all duration-300'>
            <div className='mb-8'>
              <h2 className='text-3xl font-bold text-amber-900 mb-2'>Upload Data</h2>
              <p className='text-amber-700'>Upload your ROI time-series data for correlation analysis</p>
            </div>

            {error && (
              <div className='bg-rose-300/40 border border-rose-300/60 text-rose-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-3'>
                <span className='text-xl'>⚠️</span>
                <p>{error}</p>
              </div>
            )}

            {uploadId && !analysisResults && (
              <div className='bg-blue-200/40 border border-blue-200/60 text-blue-900 px-4 py-3 rounded-lg mb-4 flex items-center gap-3'>
                <span className='animate-spin'>⏳</span>
                <div>
                  <p className='font-semibold'>Processing...</p>
                  <p className='text-sm text-blue-800'>Analyzing correlation matrix</p>
                </div>
              </div>
            )}

            {uploadId && analysisResults && (
              <div className='bg-emerald-200/40 border border-emerald-200/60 text-emerald-900 px-4 py-3 rounded-lg mb-4 flex items-center gap-3'>
                <span className='text-xl'>✨</span>
                <div>
                  <p className='font-semibold'>Analysis Complete!</p>
                  <p className='text-sm text-emerald-800'>
                    {analysisResults.n_rois} ROIs • {analysisResults.n_timepoints} timepoints
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleUpload} className='space-y-6'>
              <div>
                <label className='block text-amber-900 font-semibold mb-3'>
                  Select TXT File
                </label>
                <div className='relative'>
                  <input
                    type='file'
                    accept='.txt'
                    onChange={handleFileChange}
                    disabled={uploading}
                    className='w-full px-4 py-3 bg-white/30 border-2 border-white/30 rounded-lg text-amber-900 placeholder-amber-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:opacity-50 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-400 file:text-white hover:file:bg-orange-500'
              />
                </div>
                {file && (
                  <div className='mt-3 p-3 bg-orange-100/40 rounded-lg border border-orange-200/60'>
                    <p className='text-sm text-amber-900'>
                      <span className='font-semibold'>📄 {file.name}</span>
                      <span className='ml-2 text-amber-700'>({(file.size / 1024).toFixed(2)} KB)</span>
                    </p>
                  </div>
                )}
              </div>

              <button
                type='submit'
                disabled={uploading || !file}
                className='w-full bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-orange-300/40 flex items-center justify-center gap-2'
              >
                {uploading ? (
                  <>
                    <span className='animate-spin'>⏳</span>
                    Uploading & Analyzing...
                  </>
                ) : (
                  <>
                    <span>⬆️</span>
                    Upload & Analyze
                  </>
                )}
              </button>
            </form>

            <div className='mt-8 p-4 bg-orange-100/30 border border-orange-200/50 rounded-lg'>
              <p className='text-amber-900 font-semibold mb-3 flex items-center gap-2'>
                <span>ℹ️</span> Expected Format
              </p>
              <ul className='space-y-2 text-amber-800 text-sm'>
                <li className='flex items-center gap-2'>
                  <span className='text-orange-500'>•</span>
                  Tab or space-separated values
                </li>
                <li className='flex items-center gap-2'>
                  <span className='text-orange-500'>•</span>
                  T × N_ROI (timepoints × ROI regions)
                </li>
                <li className='flex items-center gap-2'>
                  <span className='text-orange-500'>•</span>
                  Common: 268 ROIs (Shen atlas)
                </li>
                <li className='flex items-center gap-2'>
                  <span className='text-orange-500'>•</span>
                  Numeric values only
                </li>
              </ul>
            </div>
          </div>

          {/* Correlation Matrix Visualization */}
          {analysisResults && (
            <div className='bg-white/50 backdrop-blur-md rounded-2xl shadow-lg p-8 border border-white/40 hover:border-white/60 transition-all duration-300'>
              <div className='mb-6'>
                <h2 className='text-2xl font-bold text-amber-900'>Correlation Matrix</h2>
                <p className='text-amber-700 text-sm mt-1'>{analysisResults.file_name}</p>
              </div>
              <CorrelationMatrix 
                data={analysisResults}
                fileName={analysisResults.file_name}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

