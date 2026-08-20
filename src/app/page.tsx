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
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#eff6ff',
            border: '1px solid #dbeafe',
            color: '#2563eb',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '5px 14px',
            borderRadius: '100px',
            marginBottom: '28px',
          }}>
            <span style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%', display: 'inline-block' }} />
            Frutal-MG · Transparência e Cidadania
          </div>

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
            Frutal fala.<br />
            <span style={{ color: '#2563eb' }}>O poder ouve.</span>
          </h1>

          {/* Subtítulo */}
          <p style={{
            fontSize: '17px',
            color: '#64748b',
            lineHeight: 1.7,
            maxWidth: '520px',
            marginBottom: '40px',
          }}>
            Registre denúncias, sinalize problemas urbanos e acompanhe as respostas das autoridades.
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
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div style={{
        background: '#1e3a5f',
        padding: 'clamp(20px, 3vw, 28px) clamp(24px, 5vw, 48px)',
        display: 'flex',
        gap: 'clamp(24px, 4vw, 48px)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {[
          { num: '100%', label: 'Gratuito e público' },
          { num: 'Frutal-MG', label: 'Minas Gerais' },
          { num: 'Aberto', label: 'Sem cadastro para ver' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(24px, 4vw, 48px)' }}>
            {i > 0 && <div style={{ width: '1px', background: 'rgba(255,255,255,0.12)', alignSelf: 'stretch', minHeight: '36px' }} />}
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{s.num}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CARDS DE SEÇÕES */}
      <section style={{ padding: 'clamp(48px, 6vw, 72px) clamp(24px, 5vw, 48px) clamp(64px, 8vw, 88px)', maxWidth: '1080px', margin: '0 auto' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563eb', marginBottom: '10px' }}>
          O que você encontra aqui
        </p>
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          fontSize: 'clamp(24px, 3.5vw, 34px)',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.025em',
          marginBottom: '44px',
        }}>
          Participe da cidade
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>

          {/* Mapa de Demandas */}
          <Link href="/mapa" style={{ textDecoration: 'none' }}>
            <div style={cardStyle}>
              <div style={iconStyle('#eff6ff')}>
                <svg width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div style={cardTitle}>Mapa de Demandas</div>
              <div style={cardDesc}>Registre demandas diretamente às autoridades públicas. Sinalize problemas urbanos, cobre respostas e acompanhe tudo no mapa.</div>
              <div style={cardLink('#1e3a5f')}>Acessar →</div>
            </div>
          </Link>


        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: '#0f2440',
        padding: '28px clamp(24px, 5vw, 48px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: '15px', color: 'white' }}>
          Portal Frutalense
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            © {new Date().getFullYear()} · Frutal-MG
          </span>
          <Link href="/privacidade" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Privacidade</Link>
          <Link href="/termos" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Termos de Uso</Link>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
      `}</style>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  borderLeft: '4px solid #1e3a5f',
  padding: '26px 26px 22px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  height: '100%',
  transition: 'box-shadow 0.2s',
  cursor: 'pointer',
}


function iconStyle(bg: string): React.CSSProperties {
  return {
    width: '42px',
    height: '42px',
    background: bg,
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}

const cardTitle: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
  fontSize: '16px',
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-0.01em',
}

const cardDesc: React.CSSProperties = {
  fontSize: '13.5px',
  color: '#64748b',
  lineHeight: 1.65,
  flex: 1,
}

function cardLink(color: string): React.CSSProperties {
  return {
    fontSize: '12.5px',
    fontWeight: 600,
    color,
    marginTop: '6px',
  }
}
