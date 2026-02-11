'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'

interface DashboardStats {
  total_uploads: number
  completed_analyses: number
  pending_analyses: number
  avg_processing_time: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState(false)
  const { user, logout, loading: authLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    // Wait for auth loading to complete
    if (authLoading) return
    setChecked(true)

    if (!user) {
      router.push('/login')
      return
    }

    const fetchStats = async () => {
      try {
        const response = await api.getDashboardStats()
        setStats(response.data)
      } catch (error: any) {
        // If 403, user not authenticated - redirect to login
        if (error.response?.status === 403) {
          router.push('/login')
          return
        }
        console.error('Failed to fetch stats:', error)
        setStats(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user, router, authLoading])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  // Show loading while checking auth
  if (authLoading || !checked) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-16 w-16 border-4 border-orange-400 border-t-amber-600 mx-auto mb-4'></div>
          <p className='text-amber-900 text-lg font-medium'>Loading...</p>
        </div>
      </div>
    )
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
          <Link href='/dashboard' className='nav-link-active'>Dashboard</Link>
          <Link href='/upload' className='nav-link'>Upload Data</Link>
          <Link href='/statistics' className='nav-link'>Statistics</Link>
          <Link href='/history' className='nav-link'>History</Link>
        </div>

        {/* Page Header */}
        <div className='mb-12'>
          <h2 className='text-4xl font-bold text-amber-900 mb-2'>Dashboard</h2>
          <p className='text-amber-700'>Overview of your analysis activity</p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className='flex justify-center items-center py-16'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-amber-600 mx-auto mb-4'></div>
              <p className='text-amber-900 font-medium'>Loading statistics...</p>
            </div>
          </div>
        ) : stats ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
            {/* Total Uploads */}
            <div className='group bg-gradient-to-br from-blue-100/40 to-blue-50/30 rounded-2xl shadow-lg p-8 border border-blue-200/50 hover:border-blue-300/70 transition-all duration-300 hover:shadow-xl hover:shadow-blue-300/20'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-amber-900 text-sm font-semibold'>Total Uploads</h3>
                <span className='text-3xl'>📤</span>
              </div>
              <p className='text-4xl font-bold text-amber-900'>
                {stats.total_uploads}
              </p>
              <p className='text-blue-600 text-xs mt-3 font-medium'>Files analyzed</p>
            </div>

            {/* Completed Analyses */}
            <div className='group bg-gradient-to-br from-emerald-100/40 to-emerald-50/30 rounded-2xl shadow-lg p-8 border border-emerald-200/50 hover:border-emerald-300/70 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300/20'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-amber-900 text-sm font-semibold'>Completed</h3>
                <span className='text-3xl'>✨</span>
              </div>
              <p className='text-4xl font-bold text-emerald-700'>
                {stats.completed_analyses}
              </p>
              <p className='text-emerald-700/70 text-xs mt-3 font-medium'>Success rate: {((stats.completed_analyses / stats.total_uploads) * 100).toFixed(0)}%</p>
            </div>

            {/* Pending Analyses */}
            <div className='group bg-gradient-to-br from-amber-100/40 to-amber-50/30 rounded-2xl shadow-lg p-8 border border-amber-200/50 hover:border-amber-300/70 transition-all duration-300 hover:shadow-xl hover:shadow-amber-300/20'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-amber-900 text-sm font-semibold'>Processing</h3>
                <span className='text-3xl'>⏳</span>
              </div>
              <p className='text-4xl font-bold text-amber-600'>
                {stats.pending_analyses}
              </p>
              <p className='text-amber-600/70 text-xs mt-3 font-medium'>In queue</p>
            </div>

            {/* Avg Processing Time */}
            <div className='group bg-gradient-to-br from-orange-100/40 to-orange-50/30 rounded-2xl shadow-lg p-8 border border-orange-200/50 hover:border-orange-300/70 transition-all duration-300 hover:shadow-xl hover:shadow-orange-300/20'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-amber-900 text-sm font-semibold'>Avg Time</h3>
                <span className='text-3xl'>⚡</span>
              </div>
              <p className='text-4xl font-bold text-orange-600'>
                {stats.avg_processing_time}s
              </p>
              <p className='text-orange-600/70 text-xs mt-3 font-medium'>Per analysis</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
