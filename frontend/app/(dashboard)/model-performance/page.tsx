'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { modelPerformanceData, ModelPerformance } from '@/lib/model-performance-data'

type SortField = 'behavioralScore' | 'correlation' | 'pValue' | 'mse'
type SortDirection = 'asc' | 'desc' | null

export default function ModelPerformancePage() {
  const [performanceData, setPerformanceData] = useState<ModelPerformance[]>(modelPerformanceData)
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await api.getModelPerformance()
        if (Array.isArray(response.data) && response.data.length > 0) {
          setPerformanceData(response.data as ModelPerformance[])
        }
      } catch (error) {
        setLoadError('Unable to load model performance from backend. Showing local fallback data.')
      } finally {
        setLoadingData(false)
      }
    }

    void fetchPerformanceData()
  }, [])

  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return performanceData

    return [...performanceData].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })
  }, [performanceData, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className='w-4 h-4 ml-1 text-slate-400' />
    if (sortDirection === 'asc') return <ArrowUp className='w-4 h-4 ml-1 text-blue-600' />
    return <ArrowDown className='w-4 h-4 ml-1 text-blue-600' />
  }

  const getBarColor = (correlation: number) => {
    if (correlation >= 0.85) return '#059669'
    if (correlation >= 0.75) return '#3b82f6'
    if (correlation >= 0.65) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className='page-container space-y-6'>
      <header>
        <h1 className='section-title'>Model Performance</h1>
        <p className='section-subtitle max-w-3xl'>
          Performance metrics computed on a held-out test set. Each model predicts a behavioral score from
          fMRI functional connectivity patterns using graph neural network architectures.
        </p>
      </header>

      <Card className='bg-white border-blue-100 shadow-sm'>
        <div className='bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-100 p-5'>
          <h2 className='text-blue-900 font-semibold'>Model Performance Metrics</h2>
          <p className='text-sm text-slate-600 mt-2'>
            Click column headers to sort.
          </p>
        </div>

        <div className='p-5'>
          {loadError && (
            <div className='status-banner status-banner-warning mb-4'>
              <p>{loadError}</p>
            </div>
          )}

          {loadingData && (
            <div className='text-center py-6'>
              <div className='loading-spinner mx-auto mb-3' />
              <p className='text-ink-800 text-sm'>Loading model performance...</p>
            </div>
          )}

          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow className='border-blue-100 hover:bg-transparent'>
                  <TableHead className='text-blue-900'>
                    <Button
                      variant='ghost'
                      onClick={() => handleSort('behavioralScore')}
                      className='hover:bg-blue-50 p-0 h-auto font-medium flex items-center'
                    >
                      Behavioral Score
                      {getSortIcon('behavioralScore')}
                    </Button>
                  </TableHead>
                  <TableHead className='text-blue-900 text-right'>
                    <Button
                      variant='ghost'
                      onClick={() => handleSort('correlation')}
                      className='hover:bg-blue-50 p-0 h-auto font-medium flex items-center ml-auto'
                    >
                      Correlation (r)
                      {getSortIcon('correlation')}
                    </Button>
                  </TableHead>
                  <TableHead className='text-blue-900 text-right'>
                    <Button
                      variant='ghost'
                      onClick={() => handleSort('pValue')}
                      className='hover:bg-blue-50 p-0 h-auto font-medium flex items-center ml-auto'
                    >
                      p-value
                      {getSortIcon('pValue')}
                    </Button>
                  </TableHead>
                  <TableHead className='text-blue-900 text-right'>
                    <Button
                      variant='ghost'
                      onClick={() => handleSort('mse')}
                      className='hover:bg-blue-50 p-0 h-auto font-medium flex items-center ml-auto'
                    >
                      MSE
                      {getSortIcon('mse')}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((model) => (
                  <TableRow key={model.id} className='border-blue-50 hover:bg-blue-50/50 transition-colors'>
                    <TableCell className='text-slate-900'>{model.behavioralScore}</TableCell>
                    <TableCell className='text-right'>
                      <span
                        className='font-mono text-sm px-2 py-1 rounded'
                        style={{
                          backgroundColor: `${getBarColor(model.correlation)}15`,
                          color: getBarColor(model.correlation),
                        }}
                      >
                        {model.correlation.toFixed(3)}
                      </span>
                    </TableCell>
                    <TableCell className='text-right text-slate-700 font-mono text-sm'>
                      {model.pValue < 0.001 ? '< 0.001' : model.pValue.toFixed(5)}
                    </TableCell>
                    <TableCell className='text-right text-slate-700 font-mono text-sm'>
                      {model.mse.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200'>
            <h4 className='text-sm text-slate-900 mb-3 font-semibold'>Performance Indicators</h4>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-xs'>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#059669' }} />
                <span className='text-slate-600'>Excellent (r &gt;= 0.85)</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#3b82f6' }} />
                <span className='text-slate-600'>Good (r &gt;= 0.75)</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#f59e0b' }} />
                <span className='text-slate-600'>Moderate (r &gt;= 0.65)</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#ef4444' }} />
                <span className='text-slate-600'>Fair (r &lt; 0.65)</span>
              </div>
            </div>
          </div>
        </div>
      </Card>


      <div className='text-center text-sm text-slate-500 py-2'>
        <p>Models trained using graph neural networks on functional connectivity data</p>
        <p className='mt-1'>Test set: N=50 subjects, held-out from training</p>
      </div>
    </div>
  )
}
