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
  const isAssistenteIA = pathname === '/assistenteia'

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

  // Master, landing e Lucas têm seu próprio layout
  if (isMaster || isLanding || isAssistenteIA) return <>{children}</>

  // "Mapa Grandão": a Navbar sai do fluxo desta página — sidebar e mapa
  // (dentro de `children`) passam a ocupar a tela inteira; logo, camadas e
  // conta do usuário viram elementos flutuando por cima do próprio mapa
  // (ver MapaTopBar.tsx e a logo fixa no topo do sidebar, em MapaDemandas.tsx).
  if (isMapa) return (
    <div className="mapa-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Preconnect pros domínios do Esri (tiles de satélite + rótulos do
          mapa) — achado no relatório do PageSpeed Insights ("candidatos a
          pré-conexão", ~600ms de economia estimada de LCP juntos). Só
          aparece aqui (React 19 hoista <link> pra <head> sozinho, de
          qualquer componente) porque só o /mapa usa esses domínios. */}
      <link rel="preconnect" href="https://cdn.arcgis.com" />
      <link rel="preconnect" href="https://basemapstyles-api.arcgis.com" />
      {/* Navbar padrão (com o menu hamburguer) só no mobile — pedido do
          usuário: o MapaTopBar.tsx perdeu o card azul de logo/avatar que
          tinha antes, e essa faixa fixa assumiu o lugar dele. Desktop
          continua sem Navbar aqui (mesmo motivo de sempre: a sidebar do
          mapa já tem sua própria logo, ver MapaDemandas.tsx). */}
      <div className="mapa-navbar-mobile" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 5000 }}>
        <Navbar />
      </div>
      <main className="mapa-main" style={{ flex: 1, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <ChatBot />
      <style>{`
        .mapa-navbar-mobile { display: none; }
        @media (max-width: 640px) {
          .mapa-navbar-mobile { display: block; }
        }
        html.mapa-lock-body, body.mapa-lock-body {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100svh;
          overflow: hidden;
          overscroll-behavior: none;
          /* BUG CORRIGIDO: a regra global (globals.css) deixa
             "scrollbar-gutter: stable" no <html> — essa propriedade reserva
             o espaço da barra mesmo com overflow:hidden (só é ignorada com
             overflow:visible), então sobrava uma faixa vazia do lado
             direito, com cara de barra de scroll, mesmo sem nunca haver
             scroll de verdade no /mapa. Desliga só aqui. */
          scrollbar-gutter: auto;
        }
        @media (max-width: 640px) {
          .mapa-shell { height: 100svh !important; overflow: hidden !important; overscroll-behavior: none !important; }
          .mapa-main { overflow: hidden !important; }
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

