'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const restoreSession = useAuthStore((state) => state.restoreSession)

  useEffect(() => {
    if (pathname === '/auth/callback') {
      return
    }

    restoreSession()
  }, [pathname, restoreSession])

  return <>{children}</>
}
