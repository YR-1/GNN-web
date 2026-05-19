import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { SessionProvider } from './SessionProvider'
import { QueryProvider } from '@/lib/providers/QueryProvider'

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'MindPulse',
    template: '%s | MindPulse',
  },
  description: 'Advanced brain connectivity analysis platform. Upload fMRI time-series data, predict cognitive outcomes, and explore neural network patterns with graph neural networks.',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    shortcut: ['/icon.png'],
    apple: ['/apple-icon.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' data-scroll-behavior='smooth'>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <a
          href='#main-content'
          className='sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg'
          style={{ color: 'var(--ink-950)' }}
        >
          Skip to main content
        </a>
        <QueryProvider>
          <SessionProvider>{children}</SessionProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
