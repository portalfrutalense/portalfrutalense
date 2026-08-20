'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMaster = pathname.startsWith('/master')
  const isLanding = pathname === '/'

  const isMapa = pathname === '/mapa'

  if (isMaster || isLanding) return <>{children}</>

  if (isMapa) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <main style={{ flex: 1, overflow: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="text-center text-xs text-gray-400 py-8 mt-12 border-t border-gray-200">
        © {new Date().getFullYear()} Fala Frutal · Frutal-MG · Transparência e Cidadania
      </footer>
    </>
  )
}

