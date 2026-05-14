import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { BackButton } from '@/components/BackButton'
import { DocumentationContent } from '@/components/DocumentationContent'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', protected: true },
  { href: '/upload', label: 'Upload Data', protected: true },
  { href: '/predictions', label: 'Predictions', protected: true },
  { href: '/history', label: 'History', protected: true },
  { href: '/model-performance', label: 'Model Performance', protected: true },
  { href: '/documentation', label: 'Documentation', protected: false },
]

export default async function PublicDocumentationPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  return (
    <div className='app-bg'>
      <div className='noise-overlay' aria-hidden='true' />

      <nav className='top-nav'>
        <div className='top-nav-inner'>
          <div className='top-nav-brand'>
            <Image src='/fyp-logo-brain.png' alt='MindPulse' width={50} height={50} className='rounded-lg' />
            <Link href={token ? '/dashboard' : '/'} className='brand-title'>
              MindPulse
            </Link>
          </div>

          <div className='top-nav-tabs' role='tablist' aria-label='Main navigation'>
            {NAV_ITEMS.map((item) => {
              const href = token || !item.protected ? item.href : `/login?from=${encodeURIComponent(item.href)}`
              const isActive = item.href === '/documentation'

              return (
                <Link
                  key={item.href}
                  href={href}
                  role='tab'
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'nav-link-active' : 'nav-link'}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className='top-nav-actions'>
            {token ? (
              <Link href='/dashboard' className='btn-secondary'>
                Open Dashboard
              </Link>
            ) : (
              <div className='flex items-center gap-2'>
                <Link href='/login?from=%2Fdocumentation' className='btn-secondary'>
                  Sign In
                </Link>
                <Link href='/signup?from=%2Fdocumentation' className='btn-primary'>
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main id='main-content' className='page-shell fade-in-up'>
        <BackButton fallbackHref={token ? '/dashboard' : '/'} />
        <DocumentationContent />

        <div className='disclaimer-bar'>
          Research tool - not for clinical diagnosis
        </div>
      </main>
    </div>
  )
}
