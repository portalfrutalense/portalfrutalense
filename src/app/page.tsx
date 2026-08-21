import Link from 'next/link'
import Navbar from '@/components/Navbar'

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      <Navbar />

      {/* HERO */}
      <section style={{
        background: '#ffffff',
        padding: 'clamp(64px, 8vw, 96px) clamp(24px, 5vw, 48px) clamp(56px, 7vw, 80px)',
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid #e2e8f0',
      }}>
        {/* Grid decorativo */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(#dbeafe 1px, transparent 1px), linear-gradient(90deg, #dbeafe 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          opacity: 0.35,
          pointerEvents: 'none',
        }} />
        {/* Fade na base */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '140px',
          background: 'linear-gradient(to top, #ffffff, transparent)',
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
            color: '#0f2440',
            marginBottom: '24px',
          }}>
            Frutal fala,<br />
            <span style={{ color: '#2563eb' }}>a tecnologia resolve!</span>
          </h1>

          {/* Subtítulo */}
          <p style={{
            fontSize: '17px',
            color: '#64748b',
            lineHeight: 1.7,
            maxWidth: '520px',
            marginBottom: '40px',
          }}>
            Registre demandas, sinalize problemas urbanos e acompanhe as respostas das autoridades.
            Tudo em um lugar, aberto para toda a cidade ver.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/mapa" style={{
              background: '#1e3a5f',
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

