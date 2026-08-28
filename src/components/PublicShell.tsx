'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import ChatBot from './ChatBot'

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMaster = pathname.startsWith('/master')
  const isLanding = pathname === '/'
  const isMapa = pathname === '/mapa'
  const isLucas = pathname === '/assistenteia'
  const isDashboard = pathname === '/dashboard'

  // Trava html/body de verdade no /mapa — evita scroll/rubber-band nativo do
  // navegador (que empurra a navbar pra trás da barra de endereço em mobile)
  useEffect(() => {
    if (!isMapa) return
    const html = document.documentElement
    const body = document.body
    html.classList.add('mapa-lock-body')
    body.classList.add('mapa-lock-body')
    return () => {
      html.classList.remove('mapa-lock-body')
      body.classList.remove('mapa-lock-body')
    }
  }, [isMapa])

  // Master, landing, Lucas e dashboard têm seu próprio layout
  if (isMaster || isLanding || isLucas || isDashboard) return <>{children}</>

  if (isMapa) return (
    <div className="mapa-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <main className="mapa-main" style={{ flex: 1, overflow: 'hidden', padding: 'clamp(8px,2vw,16px)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <ChatBot />
      <style>{`
        html.mapa-lock-body, body.mapa-lock-body {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100svh;
          overflow: hidden;
          overscroll-behavior: none;
        }
        @media (max-width: 640px) {
          .mapa-shell { height: 100svh !important; overflow: hidden !important; overscroll-behavior: none !important; }
          .mapa-main { overflow: hidden !important; padding: 0 !important; }
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

      <ChatBot />
    </>
  )
}

