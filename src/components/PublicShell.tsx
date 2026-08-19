'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isLanding = pathname === '/'

  if (isAdmin || isLanding) return <>{children}</>

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="text-center text-xs text-gray-400 py-8 mt-12 border-t border-gray-200">
        © {new Date().getFullYear()} Portal Frutalense · Frutal-MG · Transparência e Cidadania
      </footer>
    </>
  )
}
