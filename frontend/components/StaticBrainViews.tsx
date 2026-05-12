'use client'

interface StaticBrainViewsProps {
  markersPngBase64?: string | null
  listsortStaticBrainUrl?: string | null
  showListSortStaticBrain?: boolean
  scoreShortName: string
}

const VIEWS = ['Sagittal', 'Coronal', 'Axial'] as const
const LISTSORT_VIEWS = ['Left sagittal', 'Coronal', 'Right sagittal', 'Axial'] as const

export default function StaticBrainViews({
  markersPngBase64,
  listsortStaticBrainUrl,
  showListSortStaticBrain = false,
  scoreShortName,
}: StaticBrainViewsProps) {
  if (showListSortStaticBrain && listsortStaticBrainUrl) {
    return (
      <div className='surface-card space-y-2'>
        <div>
          <p className='text-xs font-semibold text-ink-800'>Static Brain Views</p>
          <p className='text-[11px] text-ink-600'>
            4-panel anatomical view for global ListSort FBNetGen importance.
          </p>
        </div>
        <div className='rounded-xl border border-brand-400/20 bg-white overflow-hidden'>
          <img
            src={listsortStaticBrainUrl}
            alt='4-panel anatomical ListSort FBNetGen importance brain'
            className='w-full h-auto'
            loading='lazy'
            decoding='async'
          />
          <div className='grid grid-cols-4 border-t border-brand-400/10'>
            {LISTSORT_VIEWS.map((label) => (
              <p key={label} className='text-[10px] text-ink-700 text-center py-1'>
                {label}
              </p>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!markersPngBase64) {
    return (
      <div className='surface-card flex items-center justify-center h-48 text-sm text-ink-700'>
        Static brain views not available
      </div>
    )
  }

  const markersSrc = `data:image/png;base64,${markersPngBase64}`

  return (
    <div className='surface-card space-y-2'>
      <p className='text-xs font-semibold text-ink-800'>Static Brain Views</p>
      <div className='rounded-xl border border-brand-400/20 bg-white overflow-hidden'>
        <div className='flex'>
          {VIEWS.map((label, i) => (
            <div key={label} className='flex-1 overflow-hidden'>
              <div style={{ width: '300%', marginLeft: `${-i * 100}%` }}>
                <img
                  src={markersSrc}
                  alt={`${label} view for ${scoreShortName}`}
                  className='w-full h-auto'
                  loading='lazy'
                  decoding='async'
                />
              </div>
            </div>
          ))}
        </div>
        <div className='flex border-t border-brand-400/10'>
          {VIEWS.map((label) => (
            <p key={label} className='flex-1 text-[10px] text-ink-700 text-center py-1'>
              {label}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
