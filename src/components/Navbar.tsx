'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'

const FUNCIONALIDADES = [
  { label: 'Demandas Municipais', href: '/mapa' },
  { label: 'Empregos', href: '/mapa' },
  { label: 'Achei/Perdi um Pet', href: '/mapa' },
  { label: 'Classificados', href: '/mapa' },
]

export default function Navbar({ overlay = false, onEntrar }: { overlay?: boolean; onEntrar?: () => void }) {
  const [modalAuth, setModalAuth] = useState(false)
  const [dropdown, setDropdown] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const { user, perfil, sair } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)

  function handleEntrar() {
    if (onEntrar) { onEntrar() } else { setModalAuth(true) }
  }

  useEffect(() => {
    if (!menuMobile) return
    function fecharFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuMobile(false)
      }
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [menuMobile])

  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  const containerStyle: React.CSSProperties = overlay
    ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5000, background: '#4256c8', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }
    : { position: 'relative', zIndex: 5000, background: '#4256c8', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }

  return (
    <>
      <nav style={containerStyle}>
        {/* Logo — sempre presente, mesmo layout em todas as páginas */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 'auto' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '38px', width: 'auto', display: 'block' }} />
        </Link>

        {/* Nav links — desktop, só quando logado, sempre centralizado igual em todas as páginas */}
        {user && (
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
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
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: '200px', zIndex: 5001 }}>
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
            <button onClick={handleEntrar} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
              Entrar
            </button>
          )}
        </div>

        {/* MENU — mobile, só quando logado */}
        {user && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginLeft: 'auto' }}>
            <button
              className="nav-hamburger"
              onClick={() => setMenuMobile(!menuMobile)}
              style={{ display: 'none', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', cursor: 'pointer', color: 'white', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', padding: '5px 10px' }}
            >
              MENU
            </button>

        {/* Auth mobile — só Entrar quando deslogado */}
        <div className="nav-auth-mobile" style={{ display: 'none', alignItems: 'center', marginLeft: 'auto' }}>
          {!user && (
            <button onClick={handleEntrar} style={{ fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
              Entrar
            </button>
          )}
        </div>

            {menuMobile && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '220px', background: '#3347b0', zIndex: 5001, display: 'flex', flexDirection: 'column', padding: '8px 0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
                <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: '4px' }}>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Logado como</p>
                  <p style={{ margin: '2px 0 0', color: '#fff', fontSize: '15px', fontWeight: 700 }}>{nomeExibido}</p>
                </div>
                <Link href="/" onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', textDecoration: 'none', padding: '12px 20px', fontWeight: 500 }}>Início</Link>
                <div style={{ padding: '4px 20px 2px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Funcionalidades</div>
                {FUNCIONALIDADES.map(({ label, href }) => (
                  <Link key={label} href={href} onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', fontWeight: 500, textDecoration: 'none', padding: '12px 20px 12px 28px' }}>
                    {label}
                  </Link>
                ))}
                <Link href="/assistenteia" onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', textDecoration: 'none', padding: '12px 20px', fontWeight: 500 }}>Assistente de IA</Link>
                <Link href="/perfil" onClick={() => setMenuMobile(false)} style={{ color: 'white', fontSize: '15px', textDecoration: 'none', padding: '12px 20px', fontWeight: 500 }}>Minhas atividades</Link>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 20px' }} />
                <button onClick={() => { setMenuMobile(false); sair() }} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', padding: '12px 20px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}

      <style>{`
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .nav-auth { display: none !important; }
          .nav-hamburger { display: flex !important; align-items: center; }
          .nav-auth-mobile { display: flex !important; }
        }
      `}</style>
    </>
  )
}
