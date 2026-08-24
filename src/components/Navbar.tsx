'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'

const FUNCIONALIDADES = [
  { label: 'Demandas Municipais', href: '/mapa' },
  { label: 'Empregos', href: '/mapa' },
  { label: 'Achei/Perdi um Pet', href: '/mapa' },
  { label: 'Classificados', href: '/mapa' },
]

export default function Navbar({ overlay = false }: { overlay?: boolean }) {
  const [modalAuth, setModalAuth] = useState(false)
  const [dropdown, setDropdown] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const { user, perfil, sair } = useAuth()

  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  const containerStyle: React.CSSProperties = overlay
    ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, background: '#4256c8', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }
    : { position: 'relative', background: '#4256c8', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', height: '60px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }

  return (
    <>
      <nav style={containerStyle}>
        {/* Logo — só na barra normal (não overlay), a landing já tem sua própria imagem grande */}
        {!overlay && (
          <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '38px', width: 'auto', display: 'block' }} />
          </Link>
        )}

        {/* Nav links — desktop, só quando logado */}
        {user && (
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '4px', position: overlay ? 'absolute' : 'static', left: overlay ? '50%' : undefined, transform: overlay ? 'translateX(-50%)' : undefined, marginLeft: overlay ? undefined : '24px' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 500, textDecoration: 'none', padding: '6px 14px', borderRadius: '6px' }}>
              Início
            </Link>
            {/* Funcionalidades com dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdown(!dropdown)}
                style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Funcionalidades
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{dropdown ? '▲' : '▼'}</span>
              </button>
              {dropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: '200px', zIndex: 30 }}>
                  {FUNCIONALIDADES.map(({ label, href }) => (
                    <Link key={label} href={href} onClick={() => setDropdown(false)}
                      style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: '#111827', textDecoration: 'none', fontWeight: 500, borderBottom: '1px solid #f3f4f6' }}>
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/assistenteia" style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 500, textDecoration: 'none', padding: '6px 14px', borderRadius: '6px' }}>
              Assistente de IA
            </Link>
            <Link href="/perfil" style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 500, textDecoration: 'none', padding: '6px 14px', borderRadius: '6px' }}>
              Minhas atividades
            </Link>
          </div>
        )}

        {/* Auth — desktop */}
        <div className="nav-auth" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: 'auto' }}>
          {user ? (
            <>
              <Link href="/perfil" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', textDecoration: 'none', whiteSpace: 'nowrap', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Olá, {nomeExibido}
              </Link>
              <button onClick={sair} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
                Sair
              </button>
            </>
          ) : (
            <button onClick={() => setModalAuth(true)} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
              Entrar
            </button>
          )}
        </div>

        {/* Hambúrguer — mobile, só quando logado (só há links pra mostrar quando logado) */}
        {user && (
          <button
            className="nav-hamburger"
            onClick={() => setMenuMobile(!menuMobile)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '22px', padding: '4px', flexShrink: 0 }}
          >
            {menuMobile ? '✕' : '☰'}
          </button>
        )}

        {/* Auth mobile — Olá Nome + Sair */}
        <div className="nav-auth-mobile" style={{ display: 'none', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          {user ? (
            <>
              <Link href="/perfil" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', textDecoration: 'none', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Olá, {nomeExibido}
              </Link>
              <button onClick={sair} style={{ fontSize: '12px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                Sair
              </button>
            </>
          ) : (
            <button onClick={() => setModalAuth(true)} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
              Entrar
            </button>
          )}
        </div>

        {/* Menu mobile expandido */}
        {user && menuMobile && (
          <div style={{ position: 'absolute', top: overlay ? '56px' : '60px', left: 0, right: 0, background: '#3347b0', zIndex: 30, display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
            <Link href="/" onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', textDecoration: 'none', padding: '12px 20px', fontWeight: 500 }}>Início</Link>
            <div style={{ padding: '12px 20px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Funcionalidades</div>
            {FUNCIONALIDADES.map(({ label, href }) => (
              <Link key={label} href={href} onClick={() => setMenuMobile(false)} style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', textDecoration: 'none', padding: '10px 20px 10px 32px' }}>
                {label}
              </Link>
            ))}
            <Link href="/assistenteia" onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', textDecoration: 'none', padding: '12px 20px', fontWeight: 500 }}>Assistente de IA</Link>
            <Link href="/perfil" onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', textDecoration: 'none', padding: '12px 20px', fontWeight: 500 }}>Minhas atividades</Link>
          </div>
        )}
      </nav>

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}

      <style>{`
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .nav-auth { display: none !important; }
          .nav-hamburger { display: block !important; }
          .nav-auth-mobile { display: flex !important; }
        }
      `}</style>
    </>
  )
}
