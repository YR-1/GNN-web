'use client'

import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

interface CorrelationMatrixProps {
  data: {
    n_rois: number
    n_timepoints: number
    correlation_matrix: number[][]
    plotly_json: any
    file_size: number
    file_name: string
  }
  fileName: string
}

export default function CorrelationMatrix({ data, fileName }: CorrelationMatrixProps) {
  const plotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (plotRef.current && data.plotly_json) {
      try {
        // Use the Plotly JSON from backend
        Plotly.newPlot(plotRef.current, data.plotly_json.data, data.plotly_json.layout, {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
        })
      } catch (error) {
        console.error('Error rendering Plotly chart:', error)
      }
    }

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current)
      }
    }
  }, [data])

  const downloadAsJSON = () => {
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `correlation_matrix_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadAsCSV = () => {
    const csvContent = data.correlation_matrix
      .map(row => row.map(v => v.toFixed(4)).join('\t'))
      .join('\n')
    const dataBlob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `correlation_matrix_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='bg-white rounded-lg shadow p-8'>
      <div className='mb-6'>
        <h2 className='text-2xl font-bold text-gray-900 mb-2'>Correlation Matrix Analysis</h2>
        <p className='text-gray-600 text-sm'>
          File: <span className='font-mono'>{fileName}</span>
        </p>
      </div>

      {/* Statistics */}
      <div className='grid grid-cols-2 gap-4 mb-6'>
        <div className='p-4 bg-blue-50 rounded border border-blue-200'>
          <p className='text-gray-600 text-sm'>Number of ROIs</p>
          <p className='text-2xl font-bold text-blue-600'>{data.n_rois}</p>
        </div>
        <div className='p-4 bg-green-50 rounded border border-green-200'>
          <p className='text-gray-600 text-sm'>Timepoints</p>
          <p className='text-2xl font-bold text-green-600'>{data.n_timepoints}</p>
        </div>
      </div>

      {/* Plot Container */}
      <div className='mb-6 border rounded-lg overflow-hidden bg-gray-50'>
        <div ref={plotRef} style={{ width: '100%', height: '600px' }} />
      </div>

      {/* Download Options */}
      <div className='flex gap-4'>
        <button
          onClick={downloadAsJSON}
          className='flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium'
        >
          Download as JSON
        </button>
        <button
          onClick={downloadAsCSV}
          className='flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium'
        >
          Download as CSV
        </button>
      </div>

      {/* Statistics Info */}
      <div className='mt-6 p-4 bg-gray-100 rounded text-sm text-gray-700'>
        <p className='font-semibold mb-2'>Matrix Statistics:</p>
        <ul className='space-y-1'>
          <li>• Matrix size: {data.n_rois} × {data.n_rois}</li>
          <li>• File size: {(data.file_size / 1024).toFixed(2)} KB</li>
          <li>• Correlation range: [-1, 1]</li>
          <li>• Color: Blue = negative, Red = positive correlation</li>
        </ul>
      </div>
    </div>
  )
}
