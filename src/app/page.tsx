import Link from 'next/link'
import Navbar from '@/components/Navbar'

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      <Navbar />

      {/* HERO */}
      <section style={{
        backgroundImage: "url('/fundo.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: 'clamp(480px, 70vh, 720px)',
        display: 'flex',
        alignItems: 'center',
        padding: 'clamp(64px, 8vw, 96px) clamp(24px, 5vw, 48px) clamp(56px, 7vw, 80px)',
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {/* Escurece a foto pra dar contraste ao texto */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(10,15,30,0.82) 0%, rgba(10,15,30,0.55) 45%, rgba(10,15,30,0.2) 100%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
          {/* Coluna esquerda: logo + título + subtítulo */}
          <div style={{ maxWidth: '720px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: 'clamp(36px, 5vw, 48px)', width: 'auto', display: 'block', marginBottom: '20px' }} />

            {/* Headline */}
            <h1 style={{
              fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
              fontSize: 'clamp(20px, 3vw, 34px)',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              marginBottom: '24px',
              textShadow: '0 2px 16px rgba(0,0,0,0.25)',
            }}>
              Navegue por Frutal<br />
              <span style={{ color: '#8ea2f5' }}>Explore tudo ao seu redor</span>
            </h1>

            {/* Subtítulo */}
            <p style={{
              fontSize: '17px',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.7,
              maxWidth: '520px',
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
      `}</style>
    </div>
  )
}

