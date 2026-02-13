'use client'

interface StaticBrainViewsProps {
  markersPngBase64?: string | null
  scoreShortName: string
}

const VIEWS = ['Sagittal', 'Coronal', 'Axial'] as const

export default function StaticBrainViews({ markersPngBase64, scoreShortName }: StaticBrainViewsProps) {
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
