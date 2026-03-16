'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'Upload Data' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/model-performance', label: 'Model Performance' },
  { href: '/statistics', label: 'Statistics' },
  { href: '/history', label: 'History' },
]

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, loading: authLoading } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className='app-bg flex items-center justify-center min-h-screen'>
        <div className='surface-card text-center'>
          <div className='loading-spinner mx-auto mb-3' />
          <p className='text-sm text-ink-800'>Restoring your session...</p>
        </div>
      </div>
    )
  }

  // Middleware handles redirects, but show nothing if no user (shouldn't happen)
  if (!user) return null

  const userEmail = user.email ?? 'user@example.com'
  const compactEmail = userEmail.length > 28 ? `${userEmail.slice(0, 25)}...` : userEmail
  const userInitial = userEmail.charAt(0).toUpperCase()

  return (
    <div className='app-bg'>
      <div className='noise-overlay' aria-hidden='true' />

      <nav className='top-nav'>
        <div className='top-nav-inner'>
          <div className='top-nav-brand'>
            <Image src='/fyp-logo-brain.png' alt='MindPulse' width={50} height={50} className='rounded-lg' />
            <Link href='/dashboard' className='brand-title'>
              MindPulse
            </Link>
          </div>

          <div className='top-nav-tabs' role='tablist' aria-label='Main navigation'>
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role='tab'
                  aria-selected={active}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'nav-link-active' : 'nav-link'}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className='top-nav-actions'>
            <div className='account-panel'>
              <div className='account-avatar' aria-hidden='true'>
                {userInitial}
              </div>
              <span className='account-email' title={userEmail}>
                {compactEmail}
              </span>
              <button type='button' className='account-signout' onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main id='main-content' className='page-shell fade-in-up'>
        {children}

        <div className='disclaimer-bar'>
          Research tool - not for clinical diagnosis
        </div>
      </main>
    </div>
  )
}

