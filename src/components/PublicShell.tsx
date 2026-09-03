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
  // Usado só no preconnect do /mapa abaixo — lido da mesma env var que
  // supabase-browser.ts usa pra criar o client, em vez de hardcodear o
  // domínio do projeto aqui.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

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
          qualquer componente) porque só o /mapa usa esses domínios.
          BUG CORRIGIDO (2ª rodada do PageSpeed Insights): sem o atributo
          `crossorigin`, esses dois `<link>` apareciam de novo no relatório
          como "pré-conexão não usada" — o navegador abre uma conexão HTTP
          "normal" (com credenciais) quando falta esse atributo, mas as
          chamadas reais que o MapLibre faz pra buscar tile/estilo são
          `fetch`/`XHR` sem credenciais (anônimas); como o tipo de conexão
          não bate, o navegador não reaproveita a que foi pré-aberta e abre
          outra do zero — a pré-conexão vira trabalho desperdiçado em vez de
          economia. `crossOrigin="anonymous"` alinha os dois. Também
          adicionados aqui: o preconnect pro Supabase (Storage), terceiro
          "candidato" apontado no mesmo relatório — as fotos dos pins
          (demandas/pets/classificados/imóveis) vêm de lá — e pro
          `ibasemaps-api.arcgis.com`, que é quem serve os tiles de satélite
          em si (o domínio com mais requisições de todos aqui) e não estava
          preconectado antes, apesar de já estarem os outros dois domínios
          do Esri (só sprite/rótulo, bem menos tráfego que os tiles). */}
      <link rel="preconnect" href="https://cdn.arcgis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://basemapstyles-api.arcgis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://ibasemaps-api.arcgis.com" crossOrigin="anonymous" />
      {supabaseUrl && <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />}
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

