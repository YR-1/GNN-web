'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className='text-center py-8'>Loading chart...</div>,
})

interface AnalysisResults {
  mean: number
  median: number
  std_dev: number
  min: number
  max: number
  quartiles: {
    q25: number
    q50: number
    q75: number
  }
  distribution: {
    row_count: number
    column_count: number
    missing_values: number
  }
}

function StatisticsContent() {
  const [results, setResults] = useState<AnalysisResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const executionId = searchParams.get('executionId')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    if (!executionId) {
      setError('No execution ID provided')
      setLoading(false)
      return
    }

    const fetchResults = async () => {
      try {
        const response = await api.getAnalysis(executionId)
        if (response.data.results) {
          setResults(response.data.results)
        }
      } catch (err: any) {
        setError('Failed to fetch analysis results')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [user, router, executionId])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'>
      {/* Navigation */}
      <nav className='bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50'>
        <div className='max-w-7xl mx-auto px-6 py-4 flex justify-between items-center'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center'>
              <span className='text-white font-bold'>📊</span>
            </div>
            <h1 className='text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'>
              ROI Analyzer
            </h1>
          </div>
          <div className='flex gap-4 items-center'>
            <span className='text-gray-300 text-sm'>{user.email}</span>
            <button
              onClick={handleLogout}
              className='bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-red-500/30'
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
            className='px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-200 border border-white/10 hover:border-white/20 whitespace-nowrap'
          >
            Dashboard
          </Link>
          <Link
            href='/upload'
            className='px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-200 border border-white/10 hover:border-white/20 whitespace-nowrap'
          >
            Upload Data
          </Link>
          <Link
            href='/statistics'
            className='px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold transition-all duration-200 border border-transparent hover:shadow-lg hover:shadow-blue-500/30 whitespace-nowrap'
          >
            Statistics
          </Link>
          <Link
            href='/history'
            className='px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-200 border border-white/10 hover:border-white/20 whitespace-nowrap'
          >
            History
          </Link>
        </div>

        {/* Page Header */}
        <div className='mb-12'>
          <h2 className='text-4xl font-bold text-white mb-2'>Statistics</h2>
          <p className='text-gray-400'>Detailed analysis of your data</p>
        </div>

        {error && (
          <div className='bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4 flex items-center gap-3'>
            <span className='text-xl'>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className='flex justify-center items-center py-16'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-blue-400 mx-auto mb-4'></div>
              <p className='text-gray-400'>Loading analysis results...</p>
            </div>
          </div>
        ) : results ? (
          <div className='space-y-8'>
            {/* Summary Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div className='bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl shadow-lg p-8 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-gray-400 text-sm font-semibold'>Mean</h3>
                  <span className='text-3xl'>📊</span>
                </div>
                <p className='text-4xl font-bold text-blue-400'>
                  {results.mean.toFixed(2)}
                </p>
              </div>
              <div className='bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-2xl shadow-lg p-8 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-gray-400 text-sm font-semibold'>Median</h3>
                  <span className='text-3xl'>📈</span>
                </div>
                <p className='text-4xl font-bold text-emerald-400'>
                  {results.median.toFixed(2)}
                </p>
              </div>
              <div className='bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl shadow-lg p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-gray-400 text-sm font-semibold'>Std Dev</h3>
                  <span className='text-3xl'>📉</span>
                </div>
                <p className='text-4xl font-bold text-purple-400'>
                  {results.std_dev.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Distribution Chart */}
            <div className='bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20'>
              <h2 className='text-2xl font-bold text-white mb-6'>Distribution Chart</h2>
              <Plot
                data={[
                  {
                    x: ['Min', 'Q25', 'Median', 'Q75', 'Max'],
                    y: [
                      results.min,
                      results.quartiles.q25,
                      results.quartiles.q50,
                      results.quartiles.q75,
                      results.max,
                    ],
                    type: 'bar',
                    marker: { color: '#3B82F6' },
                  },
                ]}
                layout={{
                  title: 'Data Distribution',
                  xaxis: { title: 'Statistics' },
                  yaxis: { title: 'Value' },
                  height: 400,
                }}
              />
            </div>

            {/* Quartile Chart */}
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-bold text-gray-900 mb-4'>Quartile Analysis</h2>
              <Plot
                data={[
                  {
                    x: ['Q25', 'Q50', 'Q75'],
                    y: [
                      results.quartiles.q25,
                      results.quartiles.q50,
                      results.quartiles.q75,
                    ],
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { size: 8 },
                  },
                ]}
                layout={{
                  title: 'Quartile Progression',
                  xaxis: { title: 'Quartile' },
                  yaxis: { title: 'Value' },
                  height: 400,
                }}
              />
            </div>

            {/* Data Info */}
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-bold text-gray-900 mb-4'>Data Information</h2>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div>
                  <p className='text-gray-500 text-sm'>Row Count</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {results.distribution.row_count}
                  </p>
                </div>
                <div>
                  <p className='text-gray-500 text-sm'>Column Count</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {results.distribution.column_count}
                  </p>
                </div>
                <div>
                  <p className='text-gray-500 text-sm'>Missing Values</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {results.distribution.missing_values}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function StatisticsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StatisticsContent />
    </Suspense>
  )
}
