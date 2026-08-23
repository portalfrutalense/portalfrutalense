'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ModalAuth from '@/components/ModalAuth'

export default function LandingPage() {
  const [modalAuth, setModalAuth] = useState(false)
  const { user, perfil, sair } = useAuth()
  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  // Trava html/body de verdade — página inicial nunca rola, nem 1px
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('landing-lock-body')
    body.classList.add('landing-lock-body')
    return () => {
      html.classList.remove('landing-lock-body')
      body.classList.remove('landing-lock-body')
    }
  }, [])

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", height: '100dvh', overflow: 'hidden' }}>

      {/* HERO — página inteira, sem navbar, sem scroll */}
      <section style={{
        backgroundImage: "url('/fundo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: 'clamp(16px, 4vh, 96px) clamp(20px, 5vw, 48px) clamp(16px, 4vh, 80px)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Escurece a foto pra dar contraste ao texto */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(10,15,30,0.82) 0%, rgba(10,15,30,0.55) 45%, rgba(10,15,30,0.2) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Auth — canto superior direito, no lugar da navbar */}
        <div style={{ position: 'absolute', top: 'clamp(12px, 3vh, 24px)', right: 'clamp(16px, 4vw, 32px)', zIndex: 2, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user ? (
            <>
              <Link href="/perfil" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', textDecoration: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                Olá, {nomeExibido}
              </Link>
              <button onClick={sair} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Sair
              </button>
            </>
          ) : (
            <button onClick={() => setModalAuth(true)} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Entrar
            </button>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', paddingBottom: 'clamp(24px, 6vh, 80px)' }}>

          {/* Coluna esquerda: logo + título + subtítulo */}
          <div style={{ maxWidth: '720px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: 'clamp(160px, 24vh, 320px)', width: 'auto', maxWidth: '100%', display: 'block', marginBottom: 'clamp(10px, 2vh, 20px)' }} />

            {/* Headline */}
            <h1 style={{
              fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
              fontSize: 'clamp(20px, 3vw, 36px)',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              marginBottom: 'clamp(10px, 2vh, 24px)',
              textShadow: '0 2px 16px rgba(0,0,0,0.25)',
            }}>
              Navegue por Frutal<br />
              <span style={{ color: '#8ea2f5' }}>Explore tudo ao seu redor</span>
            </h1>

            {/* Subtítulo */}
            <p style={{
              fontSize: 'clamp(13px, 2vh, 17px)',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.6,
              maxWidth: '520px',
              margin: 0,
              textShadow: '0 1px 8px rgba(0,0,0,0.2)',
            }}>
              Uma plataforma visual e interativa onde cada pino é uma oportunidade ou solução.
              Mude as camadas do mapa para cobrar melhorias públicas, achar empregos, localizar
              pets, entre outras. O Lucas (nosso assistente IA) te guia em cada passo.
            </p>
          </div>

          {/* Coluna direita: botão */}
          <Link href="/mapa" style={{
            background: '#4256c8',
            color: 'white',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            padding: '13px 26px',
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            Ver o Mapa de Demandas
          </Link>
        </div>
      </section>

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        html.landing-lock-body, body.landing-lock-body {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100svh;
          overflow: hidden;
          overscroll-behavior: none;
        }
      `}</style>
    </div>
  )
}
