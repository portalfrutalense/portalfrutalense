'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import ChatBot from './ChatBot'

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMaster = pathname.startsWith('/master')
  const isLanding = pathname === '/'
  const isMapa = pathname === '/mapa'
  const isAbacaXico = pathname === '/abacaxico'

  // Master, landing e AbacaXico têm seu próprio layout
  if (isMaster || isLanding || isAbacaXico) return <>{children}</>

  if (isMapa) return (
    <div className="mapa-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <main className="mapa-main" style={{ flex: 1, overflow: 'hidden', padding: 'clamp(8px,2vw,16px)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <ChatBot />
      <style>{`
        @media (max-width: 640px) {
          .mapa-shell { height: auto !important; min-height: 100vh; overflow: visible !important; }
          .mapa-main { overflow: visible !important; }
        }
      `}</style>
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
      <ChatBot />
    </>
  )
}

