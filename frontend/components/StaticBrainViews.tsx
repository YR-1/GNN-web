'use client'

interface StaticBrainViewsProps {
  markersPngBase64?: string | null
  importanceStaticBrainUrl?: string | null
  showImportanceStaticBrain?: boolean
  listsortStaticBrainUrl?: string | null
  showListSortStaticBrain?: boolean
  scoreShortName: string
}

const VIEWS = ['Sagittal', 'Coronal', 'Axial'] as const

export default function StaticBrainViews({
  markersPngBase64,
  importanceStaticBrainUrl,
  showImportanceStaticBrain = false,
  listsortStaticBrainUrl,
  showListSortStaticBrain = false,
  scoreShortName,
}: StaticBrainViewsProps) {
  const staticBrainUrl = listsortStaticBrainUrl ?? importanceStaticBrainUrl
  const shouldShowImportanceBrain = showListSortStaticBrain || showImportanceStaticBrain

  if (shouldShowImportanceBrain && staticBrainUrl) {
    return (
      <div className='surface-card flex h-full min-h-0 w-full flex-col p-0'>
        <div className='flex h-full min-h-0 w-full flex-1 overflow-hidden bg-white p-0'>
          <div className='relative flex h-full min-h-0 w-full flex-1 overflow-hidden'>
            <div className='flex min-h-0 flex-1 overflow-hidden pb-0'>
              <img
                src={staticBrainUrl}
                alt={`4-panel anatomical ${scoreShortName} model importance brain`}
                className='h-full w-full object-contain'
                loading='lazy'
                decoding='async'
              />
            </div>
            <div className='pointer-events-none absolute inset-0'>
              <p className='absolute text-[10px] text-ink-700' style={{ left: '12%', bottom: '12px' }}>
                Left Sagittal
              </p>
              <p className='absolute text-[10px] text-ink-700' style={{ left: '34%', bottom: '12px' }}>
                Coronal
              </p>
              <p className='absolute text-[10px] text-ink-700' style={{ left: '54%', bottom: '12px' }}>
                Right Sagittal
              </p>
              <p className='absolute text-[10px] text-ink-700' style={{ left: '76%', bottom: '12px' }}>
                Axial
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!markersPngBase64) {
    return (
      <div className='surface-card flex h-48 items-center justify-center text-sm text-ink-700'>
        Static brain views not available
      </div>
    )
  }

  const markersSrc = `data:image/png;base64,${markersPngBase64}`

  return (
    <div className='surface-card flex h-full min-h-0 w-full flex-col p-0'>
      <div className='flex h-full min-h-0 w-full flex-1 overflow-hidden bg-white p-0'>
        <div className='flex h-full min-h-0 w-full'>
          {VIEWS.map((label, i) => (
            <div key={label} className='flex min-h-0 flex-1 items-center justify-center overflow-hidden'>
              <div style={{ width: '300%', height: '100%', marginLeft: `${-i * 100}%` }}>
                <img
                  src={markersSrc}
                  alt={`${label} view for ${scoreShortName}`}
                  className='h-full w-full object-contain'
                  loading='lazy'
                  decoding='async'
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
