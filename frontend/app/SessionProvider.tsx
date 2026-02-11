'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((state) => state.restoreSession)

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  return <>{children}</>
}
