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
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '720px' }}>
          {/* Headline */}
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            fontSize: 'clamp(40px, 6vw, 68px)',
            fontWeight: 800,
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: '24px',
            textShadow: '0 2px 16px rgba(0,0,0,0.25)',
          }}>
            Frutal fala,<br />
            <span style={{ color: '#8ea2f5' }}>a tecnologia resolve!</span>
          </h1>

          {/* Subtítulo */}
          <p style={{
            fontSize: '17px',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.7,
            maxWidth: '520px',
            marginBottom: '40px',
            textShadow: '0 1px 8px rgba(0,0,0,0.2)',
          }}>
            A plataforma completa de Frutal. Registre demandas urbanas, acesse serviços locais,
            acompanhe a cidade e tire dúvidas em tempo real com o Lucas, nosso assistente de IA.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
            }}>
              Ver o Mapa de Demandas
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
      `}</style>
    </div>
  )
}

