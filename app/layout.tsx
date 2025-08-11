import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Greptile Clone - AI Code Review Platform',
  description: 'AI-powered code review and codebase intelligence platform. Catch 3X more bugs, merge PRs 4X faster with full codebase context.',
  keywords: ['ai', 'code review', 'github', 'gitlab', 'developer tools', 'codebase analysis'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  )
} 