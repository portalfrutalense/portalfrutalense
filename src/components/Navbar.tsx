'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'
import { usePathname, useSearchParams } from 'next/navigation'

// Exportada porque MapaTopBar.tsx (chips flutuantes de camada, dentro do
// próprio mapa) precisa da mesma lista/ordem — evita duas listas que podem
// ficar diferentes com o tempo.
export const CAMADAS_NAV = [
  { label: 'Demandas Municipais', camada: 'demandas' },
  { label: 'Vagas de Emprego', camada: 'empregos' },
  { label: 'Veículos', camada: 'classificados' },
  { label: 'Imóveis', camada: 'imoveis' },
  { label: 'Área PET', camada: 'pets' },
]

function NavCamadas({ user }: { user: unknown }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const camadaAtiva = pathname === '/mapa' ? (searchParams.get('camada') || 'demandas') : null
  if (!user) return null
  return (
    <div className="nav-links" style={{ display: 'flex', alignItems: 'center' }}>
      {CAMADAS_NAV.map(({ label, camada }, i) => {
        const ativo = camadaAtiva === camada
        return (
          <div key={camada} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', margin: '0 2px', userSelect: 'none' }}>|</span>}
            <Link href={`/mapa?camada=${camada}`}
              style={{
                color: 'white',
                fontSize: '13.5px', fontWeight: 500,
                textDecoration: 'none', padding: '5px 12px', borderRadius: '6px',
                whiteSpace: 'nowrap',
                background: ativo ? 'rgba(255,255,255,0.22)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!ativo) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ativo ? 'rgba(255,255,255,0.22)' : 'transparent' }}>
              {label}
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export default function Navbar({ overlay = false, onEntrar }: { overlay?: boolean; onEntrar?: () => void }) {
  const [modalAuth, setModalAuth] = useState(false)
  const [dropdown, setDropdown] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const { user, perfil, sair } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!dropdown) return
    function fecharFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(false)
      }
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [dropdown])

  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  const containerStyle: React.CSSProperties = overlay
    ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5000, background: '#4256c8', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }
    : { position: 'relative', zIndex: 5000, background: '#4256c8', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }

  return (
    <>
      <nav style={containerStyle}>
        {/* Coluna esquerda — logo */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '38px', width: 'auto', display: 'block' }} />
          </Link>
        </div>

        {/* Coluna central — camadas (desktop, só logado) */}
        <Suspense fallback={null}>
          <NavCamadas user={user} />
        </Suspense>

        {/* Coluna direita — auth */}
        <div className="nav-auth" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
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
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '12px', fontWeight: 600, padding: '4px 0', gap: '8px', alignItems: 'center', marginRight: '2px' }}
            >
              <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Olá, {nomeExibido.split(' ')[0]}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                <span style={{ display: 'block', width: '20px', height: '3px', background: 'white', borderRadius: '1px' }} />
                <span style={{ display: 'block', width: '20px', height: '3px', background: 'white', borderRadius: '1px' }} />
                <span style={{ display: 'block', width: '20px', height: '3px', background: 'white', borderRadius: '1px' }} />
              </span>
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
              <div style={{ position: 'fixed', top: '56px', right: '8px', left: '8px', minWidth: '220px', maxWidth: '320px', marginLeft: 'auto', background: '#4256c8', zIndex: 5001, display: 'flex', flexDirection: 'column', padding: '8px 0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
                <div style={{ padding: '12px 20px 10px', borderBottom: '2px solid rgba(255,255,255,0.15)', marginBottom: '4px' }}>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Logado como</p>
                  <p style={{ margin: '2px 0 6px', color: '#fff', fontSize: '15px', fontWeight: 400 }}>{nomeExibido}</p>
                  <Link href="/perfil" onClick={() => setMenuMobile(false)}
                    style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
                    Minha conta
                  </Link>
                </div>
                {CAMADAS_NAV.map(({ label, camada }) => (
                  <Link key={camada} href={`/mapa?camada=${camada}`} onClick={() => setMenuMobile(false)}
                    style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', fontWeight: 500, textDecoration: 'none', padding: '12px 20px' }}>
                    {label}
                  </Link>
                ))}
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.15)', margin: '8px 20px' }} />
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
