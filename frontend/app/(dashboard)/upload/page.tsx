'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const ALLOWED_EXTENSIONS = new Set(['txt', 'csv', 'tsv'])

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function formatSizeKB(sizeInBytes: number): string {
  return `${(sizeInBytes / 1024).toFixed(2)} KB`
}

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0)
  const [currentUploadName, setCurrentUploadName] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const acceptedExtensions = '.txt, .csv, .tsv'

  const addSelectedFiles = (incoming: File[]) => {
    if (incoming.length === 0) {
      return
    }

    const validFiles: File[] = []
    const invalidNames: string[] = []

    for (const candidate of incoming) {
      const ext = candidate.name.toLowerCase().split('.').pop()
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        invalidNames.push(candidate.name)
        continue
      }
      validFiles.push(candidate)
    }

    setSelectedFiles((previous) => {
      const existing = new Set(previous.map(fileKey))
      const deduped = validFiles.filter((f) => !existing.has(fileKey(f)))
      return [...previous, ...deduped]
    })

    if (invalidNames.length > 0) {
      setError(`Ignored invalid file type: ${invalidNames.join(', ')}. Allowed: .txt, .csv, .tsv.`)
    } else {
      setError('')
    }
  }

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((previous) => previous.filter((_, index) => index !== indexToRemove))
  }

  const clearSelectedFiles = () => {
    setSelectedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addSelectedFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (uploading) return
    setIsDragActive(true)
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (uploading) return
    setIsDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDragActive(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (uploading) return
    setIsDragActive(false)
    addSelectedFiles(Array.from(event.dataTransfer.files ?? []))
  }

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (selectedFiles.length === 0) {
      setError('Select at least one data file before uploading.')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setCurrentUploadIndex(0)
    setCurrentUploadName('')
    setError('')

    const executionIds: string[] = []

    try {
      for (let i = 0; i < selectedFiles.length; i += 1) {
        const nextFile = selectedFiles[i]
        setCurrentUploadIndex(i + 1)
        setCurrentUploadName(nextFile.name)
        setUploadProgress(0)

        const response = await api.uploadFile(nextFile, (percent) => setUploadProgress(percent))
        if (!response.data.execution_id) {
          throw new Error(`Upload response is missing execution ID for ${nextFile.name}.`)
        }
        executionIds.push(response.data.execution_id)
      }

      clearSelectedFiles()

      if (executionIds.length === 1) {
        router.push(`/analysis/${executionIds[0]}/loading?fileName=${encodeURIComponent(selectedFiles[0].name)}`)
      } else {
        router.push('/history')
      }
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        router.push('/login')
        return
      }
      setError(err?.response?.data?.detail || err?.message || 'Upload failed.')
    } finally {
      setUploading(false)
      setCurrentUploadIndex(0)
      setCurrentUploadName('')
    }
  }

  return (
    <div className='page-container w-full max-w-5xl mx-auto'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='section-title'>Upload Data</h1>
          <p className='section-subtitle'>
            Add one or more ROI time-series matrices to start connectivity analysis and prediction.
          </p>
        </div>
        <p className='rounded-full border border-brand-400/20 bg-white/70 px-3 py-1 text-xs font-medium text-ink-700'>
          Research workflow
        </p>
      </div>

      {error && (
        <div className='status-banner status-banner-error'>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleUpload} className='grid gap-5 lg:grid-cols-[1.45fr_0.95fr]'>
        <div className=' space-y-4'>
            <div
              role='button'
              tabIndex={0}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (!uploading) {
                    fileInputRef.current?.click()
                  }
                }
              }}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`min-h-[260px] rounded-2xl border-2 border-dashed p-8 text-center transition ${
                isDragActive
                  ? 'border-brand-600 bg-brand-400/10'
                  : 'border-brand-400/30 bg-white/80 hover:border-brand-600/60 hover:bg-white/90'
              } ${uploading ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
              aria-label='Drag and drop data files here or click to browse'
            >
              <input
                ref={fileInputRef}
                id='roi-file'
                type='file'
                multiple
                accept='.txt,.csv,.tsv'
                disabled={uploading}
                onChange={handleFileChange}
                className='hidden'
              />
              <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-400/30 bg-white/90'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.8'
                  className='h-7 w-7 text-brand-700'
                  aria-hidden='true'
                >
                  <path d='M12 16V5m0 0 4 4m-4-4-4 4' strokeLinecap='round' strokeLinejoin='round' />
                  <path d='M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3' strokeLinecap='round' />
                </svg>
              </div>
              <p className='font-semibold text-ink-900'>Drop your file(s) here</p>
              <p className='mt-2 text-sm text-ink-700'>
                or{' '}
                <span className='font-medium text-brand-700 underline underline-offset-2 decoration-brand-500'>
                  click to browse
                </span>{' '}
                from your device
              </p>
              <p className='mt-3 text-xs text-ink-700'>Accepted formats: {acceptedExtensions}</p>
            </div>

            {selectedFiles.length > 0 && (
              <div className='rounded-xl border border-brand-400/20 bg-white/85 p-3 space-y-2 transition-colors hover:border-brand-600/40'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm font-medium text-ink-950'>Selected files ({selectedFiles.length})</p>
                  <button
                    type='button'
                    onClick={clearSelectedFiles}
                    disabled={uploading}
                    className='text-xs text-ink-700 hover:text-ink-950 underline underline-offset-2 disabled:no-underline disabled:opacity-50'
                  >
                    Clear all
                  </button>
                </div>
                <ul className='space-y-2 max-h-56 overflow-auto pr-1'>
                  {selectedFiles.map((selectedFile, index) => (
                    <li
                      key={fileKey(selectedFile)}
                      className='flex items-center justify-between gap-3 rounded-lg border border-brand-400/20 bg-white/90 px-3 py-2 transition-colors hover:border-brand-600/45'
                    >
                      <div className='min-w-0'>
                        <p className='text-sm font-medium text-ink-900 truncate'>{selectedFile.name}</p>
                        <p className='text-xs text-ink-700'>{formatSizeKB(selectedFile.size)}</p>
                      </div>
                      <button
                        type='button'
                        onClick={() => removeSelectedFile(index)}
                        disabled={uploading}
                        aria-label={`Delete ${selectedFile.name}`}
                        title={`Delete ${selectedFile.name}`}
                        className='shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition-colors hover:border-rose-400 hover:bg-rose-50 disabled:opacity-50'
                      >
                        <svg
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='1.8'
                          className='h-4 w-4'
                          aria-hidden='true'
                        >
                          <path d='M3 6h18' strokeLinecap='round' />
                          <path d='M8 6V4h8v2' strokeLinecap='round' strokeLinejoin='round' />
                          <path d='M19 6l-1 14H6L5 6' strokeLinecap='round' strokeLinejoin='round' />
                          <path d='M10 11v6M14 11v6' strokeLinecap='round' />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {uploading && (
              <div className='rounded-xl border border-brand-400/20 bg-white/80 p-3'>
                <div className='flex items-center justify-between text-xs text-ink-700 mb-2'>
                  <span>
                    Uploading file {currentUploadIndex} of {selectedFiles.length}
                    {currentUploadName ? `: ${currentUploadName}` : ''}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className='w-full rounded-full bg-brand-400/20 h-2.5 overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all duration-300'
                    style={{
                      width: `${uploadProgress}%`,
                      background: 'linear-gradient(120deg, var(--brand-500), var(--brand-700))',
                    }}
                  />
                </div>
              </div>
            )}

            <div className='flex flex-col sm:flex-row gap-3'>
              <button type='submit' disabled={uploading || selectedFiles.length === 0} className='btn-upload-primary flex-1'>
                {uploading ? 'Uploading and analyzing...' : `Upload and analyze (${selectedFiles.length})`}
              </button>
              <button
                type='button'
                disabled={uploading || selectedFiles.length === 0}
                onClick={clearSelectedFiles}
                className='btn-danger disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Clear file list
              </button>
            </div>
          </div>

          <aside className=' space-y-4'>
            <div>
              <p className='text-sm font-semibold text-ink-950'>File Requirements</p>
              <p className='mt-1 text-xs text-ink-700'>Keep matrix orientation and ROI count consistent with your study setup.</p>
            </div>
            <ul className='space-y-2 text-sm text-ink-700'>
              <li className='flex items-start gap-2'>
                <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                Plain-text numeric matrix (.txt, .csv, .tsv)
              </li>
              <li className='flex items-start gap-2'>
                <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                Rows = timepoints, columns = ROI regions
              </li>
              <li className='flex items-start gap-2'>
                <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                Typical input uses 268 ROI columns (Shen atlas)
              </li>
              <li className='flex items-start gap-2'>
                <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                Header rows should be removed before upload
              </li>
              <li className='flex items-start gap-2'>
                <span className='mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-600' />
                Multiple files are uploaded sequentially via the existing API
              </li>
            </ul>
          </aside>
        </form>

        <div className='rounded-xl border border-brand-400/20 bg-white/70 px-4 py-3 text-xs text-ink-700'>
          Tip: If your matrix was exported as ROI x timepoints, the backend auto-detects and transposes it when possible.
        </div>
    </div>
  )
}
