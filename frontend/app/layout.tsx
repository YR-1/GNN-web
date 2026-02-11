import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from './SessionProvider'

export const metadata: Metadata = {
  title: 'Data Analytics App',
  description: 'Production-ready data analytics platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
