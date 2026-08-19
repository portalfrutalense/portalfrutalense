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
            <Link href="/denuncias" style={{
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
              + Registrar Denúncia
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/mapa" style={{
              background: 'transparent',
              color: '#1e3a5f',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              padding: '13px 26px',
              borderRadius: '8px',
              border: '1.5px solid #e2e8f0',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              Ver o Mapa
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
          Quatro formas de participar da cidade
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>

          {/* Denúncias */}
          <Link href="/denuncias" style={{ textDecoration: 'none' }}>
            <div style={cardStyle}>
              <div style={iconStyle('#eff6ff')}>
                <svg width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                </svg>
              </div>
              <div style={cardTitle}>Denúncias</div>
              <div style={cardDesc}>Registre cobranças diretas a vereadores, prefeito e órgãos públicos. As autoridades respondem publicamente.</div>
              <div style={cardLink('#1e3a5f')}>Acessar →</div>
            </div>
          </Link>

          {/* Mapa */}
          <Link href="/mapa" style={{ textDecoration: 'none' }}>
            <div style={cardStyle}>
              <div style={iconStyle('#eff6ff')}>
                <svg width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div style={cardTitle}>Mapa de Ocorrências</div>
              <div style={cardDesc}>Sinalize buracos, alagamentos e problemas de infraestrutura urbana. Veja o que a cidade inteira está reportando.</div>
              <div style={cardLink('#1e3a5f')}>Acessar →</div>
            </div>
          </Link>

          {/* Vagas */}
          <div style={cardStyleSoon}>
            <div style={iconStyle('#f8fafc')}>
              <svg width="20" height="20" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div style={{ ...cardTitle, color: '#94a3b8' }}>Vagas de Emprego</div>
            <div style={cardDesc}>Encontre oportunidades de trabalho em Frutal e região. Empresas locais publicam vagas diretamente aqui.</div>
            <div style={cardLink('#94a3b8')}>Em breve</div>
          </div>

          {/* Guia */}
          <div style={cardStyleSoon}>
            <div style={iconStyle('#f8fafc')}>
              <svg width="20" height="20" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div style={{ ...cardTitle, color: '#94a3b8' }}>Guia Útil</div>
            <div style={cardDesc}>Telefones, endereços e serviços essenciais de Frutal-MG reunidos em um só lugar. Útil para todo morador.</div>
            <div style={cardLink('#94a3b8')}>Em breve</div>
          </div>

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
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          © {new Date().getFullYear()} · Frutal-MG · Transparência e Cidadania
        </span>
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

const cardStyleSoon: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  borderLeft: '4px solid #e2e8f0',
  padding: '26px 26px 22px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  height: '100%',
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
