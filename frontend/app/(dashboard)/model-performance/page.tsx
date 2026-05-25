'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { modelPerformanceData, ModelPerformance } from '@/lib/model-performance-data'

type SortField = 'behavioralScore' | 'gnnArchitecture' | 'correlation' | 'pValue' | 'mse'
type SortDirection = 'asc' | 'desc' | null

const ARCHITECTURE_COLORS: Record<string, string> = {
  FBNetGen: '#6366f1',
  BrainGNN: '#a855f7',
  'T-RegGNN': '#0d9488',
}

const CONSISTENT_SCORE_LABELS: Record<string, string> = {
  listsort_ageadj: 'ListSort (Working Memory)',
  pmat: 'PMAT (Fluid Intelligence)',
  picseq: 'PicSeq (Picture Sequence Memory)',
  emotsupp_unadj: 'Emotional Support (Empathy & Caring)',
  psqi: 'PSQI (Sleep Quality)',
}

const CONSISTENT_MODEL_ARCHITECTURES: Record<string, string> = {
  pmat: 'BrainGNN',
  emotsupp_unadj: 'T-RegGNN',
  psqi: 'T-RegGNN',
}

const getArchitectureColor = (architecture: string) => ARCHITECTURE_COLORS[architecture] ?? '#64748b'

const normalizePerformanceRow = (row: ModelPerformance): ModelPerformance => ({
  ...row,
  behavioralScore: CONSISTENT_SCORE_LABELS[row.id] ?? row.behavioralScore,
  gnnArchitecture: CONSISTENT_MODEL_ARCHITECTURES[row.id] ?? row.gnnArchitecture,
})

export default function ModelPerformancePage() {
  const [performanceData, setPerformanceData] = useState<ModelPerformance[]>(
    modelPerformanceData.map(normalizePerformanceRow)
  )
  const [loadError, setLoadError] = useState('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await api.getModelPerformance()
        if (Array.isArray(response.data) && response.data.length > 0) {
          setPerformanceData((response.data as ModelPerformance[]).map(normalizePerformanceRow))
        }
      } catch (error) {
        setLoadError('Unable to load model performance from backend. Showing local fallback data.')
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
    if (correlation >= 0.3) return '#059669'
    if (correlation >= 0.2) return '#3b82f6'
    return '#64748b'
  }

  return (
    <div className='overflow-hidden rounded-[1.9rem] border border-slate-200/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
      <header className='bg-[linear-gradient(180deg,rgba(245,248,255,0.96),rgba(239,244,255,0.92))] px-5 py-4 sm:px-6'>
        <div className='flex flex-wrap items-end justify-between gap-x-6 gap-y-1'>
          <div>
            <h1 className='font-display text-[1.32rem] font-semibold text-slate-950 sm:text-[1.42rem]'>
              Model Performance
            </h1>
          
          </div>
          <p className='text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400'>
            Click any column to sort
          </p>
        </div>
      </header>

      <div className='bg-white p-4 sm:p-5'>
        {loadError && (
          <div className='status-banner status-banner-warning mb-4'>
            <p>{loadError}</p>
          </div>
        )}

        <div className='overflow-x-auto rounded-xl border border-slate-200 shadow-sm'>
          <Table>
            <TableHeader>
              <TableRow className='border-slate-200 bg-slate-100 hover:bg-slate-100'>
                <TableHead className='h-11 px-4 text-blue-900'>
                  <Button
                    variant='ghost'
                    onClick={() => handleSort('behavioralScore')}
                    className='hover:bg-blue-100 p-0 h-auto font-semibold flex items-center'
                  >
                    Behavioral Score
                    {getSortIcon('behavioralScore')}
                  </Button>
                </TableHead>
                <TableHead className='h-11 px-4 text-blue-900'>
                  <Button
                    variant='ghost'
                    onClick={() => handleSort('gnnArchitecture')}
                    className='hover:bg-blue-100 p-0 h-auto font-semibold flex items-center'
                  >
                    GNN Architecture
                    {getSortIcon('gnnArchitecture')}
                  </Button>
                </TableHead>
                <TableHead className='h-11 px-4 text-blue-900 text-right'>
                  <Button
                    variant='ghost'
                    onClick={() => handleSort('correlation')}
                    className='hover:bg-blue-100 p-0 h-auto font-semibold flex items-center ml-auto'
                  >
                    Correlation (r)
                    {getSortIcon('correlation')}
                  </Button>
                </TableHead>
                <TableHead className='h-11 px-4 text-blue-900 text-right'>
                  <Button
                    variant='ghost'
                    onClick={() => handleSort('pValue')}
                    className='hover:bg-blue-100 p-0 h-auto font-semibold flex items-center ml-auto'
                  >
                    p-value
                    {getSortIcon('pValue')}
                  </Button>
                </TableHead>
                <TableHead className='h-11 px-4 text-blue-900 text-right'>
                  <Button
                    variant='ghost'
                    onClick={() => handleSort('mse')}
                    className='hover:bg-blue-100 p-0 h-auto font-semibold flex items-center ml-auto'
                  >
                    MAE
                    {getSortIcon('mse')}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((model, index) => (
                <TableRow
                  key={model.id}
                  className={`border-slate-100 transition-colors hover:bg-blue-50 ${
                    index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                  }`}
                >
                  <TableCell className='px-4 py-3 font-medium text-slate-900'>
                    {model.behavioralScore}
                  </TableCell>
                  <TableCell className='px-4 py-3'>
                    <span
                      className='inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'
                      style={{
                        backgroundColor: `${getArchitectureColor(model.gnnArchitecture)}15`,
                        color: getArchitectureColor(model.gnnArchitecture),
                      }}
                    >
                      {model.gnnArchitecture}
                    </span>
                  </TableCell>
                  <TableCell className='px-4 py-3 text-right'>
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
                  <TableCell className='px-4 py-3 text-right text-slate-700 font-mono text-sm'>
                    {model.pValue < 0.001 ? '< 0.001' : model.pValue.toFixed(5)}
                  </TableCell>
                  <TableCell className='px-4 py-3 text-right text-slate-700 font-mono text-sm'>
                    {model.mse.toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className='mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4'>
          <h4 className='text-sm font-semibold text-slate-900'>What the metrics mean</h4>
          <dl className='mt-3 grid gap-3 sm:grid-cols-3'>
            <div className='rounded-lg border border-slate-200 bg-white p-3'>
              <dt className='text-xs font-semibold text-slate-800'>Correlation (r)</dt>
              <dd className='mt-1 text-xs leading-relaxed text-slate-600'>
                How closely predicted scores track the actual scores across subjects. In fMRI
                brain-behavior prediction, r values above 0.3 can indicate a meaningful signal.
              </dd>
            </div>
            <div className='rounded-lg border border-slate-200 bg-white p-3'>
              <dt className='text-xs font-semibold text-slate-800'>p-value</dt>
              <dd className='mt-1 text-xs leading-relaxed text-slate-600'>
                The chance the correlation appeared at random. Lower is better &mdash; below 0.05 is
                considered statistically significant.
              </dd>
            </div>
            <div className='rounded-lg border border-slate-200 bg-white p-3'>
              <dt className='text-xs font-semibold text-slate-800'>MAE</dt>
              <dd className='mt-1 text-xs leading-relaxed text-slate-600'>
                Mean Absolute Error &mdash; the average absolute gap between predicted and actual
                scores. Lower means more accurate predictions.
              </dd>
            </div>
          </dl>

          <div className='mt-4 border-t border-slate-200 pt-3'>
            <p className='text-xs font-semibold text-slate-800'>Correlation strength</p>
            <div className='mt-2 grid gap-3 text-xs sm:grid-cols-3'>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#059669' }} />
                <span className='text-slate-600'>Meaningful signal (r &gt;= 0.30)</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#3b82f6' }} />
                <span className='text-slate-600'>Weak signal (r &gt;= 0.20)</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='w-3 h-3 rounded' style={{ backgroundColor: '#64748b' }} />
                <span className='text-slate-600'>Limited signal (r &lt; 0.20)</span>
              </div>
            </div>
          </div>

          <p className='mt-3 text-[11px] italic text-slate-500'>
            Correlation (r) is reported as Spearman&rsquo;s rank correlation.
          </p>
        </div>
      </div>
    </div>
  )
}
