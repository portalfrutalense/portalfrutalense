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
  { label: 'Todos', camada: 'todos' },
  { label: 'Demandas Municipais', camada: 'demandas' },
  { label: 'Vagas de Emprego', camada: 'empregos' },
  { label: 'Veículos', camada: 'classificados' },
  { label: 'Imóveis', camada: 'imoveis' },
  { label: 'Área PET', camada: 'pets' },
]

// Mesma lógica do MapaTopBar.tsx (não reaproveitada de lá pra evitar
// import circular — MapaTopBar já importa CAMADAS_NAV deste arquivo).
function iniciais(nome: string | null | undefined, email: string | null | undefined): string {
  if (nome?.trim()) {
    const partes = nome.trim().split(/\s+/)
    const primeira = partes[0]?.[0] || ''
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] || '' : ''
    const resultado = (primeira + ultima).toUpperCase()
    if (resultado) return resultado
  }
  if (email?.trim()) return email.trim()[0].toUpperCase()
  return 'U'
}

function NavCamadas({ user }: { user: unknown }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // BUG CORRIGIDO (pedido do usuário): "todos" virou o padrão de /mapa
  // sem `?camada=` — esse default tinha ficado esquecido em 'demandas',
  // então o chip errado (Demandas) ficava destacado como ativo aqui.
  const camadaAtiva = pathname === '/mapa' ? (searchParams.get('camada') || 'todos') : null
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
  const email = perfil?.email || user?.email || null

  const containerStyle: React.CSSProperties = overlay
    ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5000, background: '#4256c8', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }
    : { position: 'relative', zIndex: 5000, background: '#4256c8', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', height: '56px', display: 'flex', alignItems: 'center', padding: '0 clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }

  return (
    <>
      <nav style={containerStyle}>
        {/* Coluna esquerda — logo */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Link href="/" className="nav-logo-link" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* CORREÇÃO DE PERFORMANCE (PageSpeed Insights): "CIDADANIA.png"
                original (800x200, 24,9 KiB) é maior do que precisa pra
                exibir aqui (280x70 no máximo) — trocado por
                "CIDADANIA-logo.png" (400x100, 4,6 KiB — 2x de folga sobre o
                tamanho real exibido, o suficiente pra telas retina). O
                arquivo original continua intacto em public/, usado por
                src/app/opengraph-image.tsx (geração server-side, não afeta
                o peso da página). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA-logo.png" alt="CidadanIA Frutal" width={400} height={100} className="nav-logo-img" style={{ height: '38px', width: 'auto', display: 'block' }} />
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
              aria-label="Menu"
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', alignItems: 'center', marginRight: '2px' }}
            >
              {/* "Olá, Nome" removido daqui (pedido do usuário): com nome
                  grande, o botão ficava largo demais e comia a logo ao lado
                  em telas estreitas. O nome continua aparecendo dentro do
                  menu, no cabeçalho "Logado como". */}
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

            {/* Estilo copiado do popover de conta do MapaTopBar.tsx (pedido
                do usuário: achou mais bonito que o menu azul que tinha
                antes). Sem a lista de camadas — quem quiser trocar de
                camada entra em "Mapa" e usa os chips flutuantes lá. */}
            {menuMobile && (
              <div style={{ position: 'fixed', top: '56px', right: '8px', width: '230px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 12px 34px rgba(20,30,50,0.2)', padding: '6px', zIndex: 5001 }}>
                <div style={{ padding: '10px 10px 9px', display: 'flex', alignItems: 'center', gap: '9px', borderBottom: '1px solid #f9fafb', marginBottom: '4px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#4256c8', color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {iniciais(perfil?.nome, email)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeExibido}</p>
                    {email && <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</p>}
                  </div>
                </div>
                <Link href="/mapa" onClick={() => setMenuMobile(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
                  Mapa
                </Link>
                <Link href="/perfil" onClick={() => setMenuMobile(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
                  Minhas atividades
                </Link>
                <Link href="/perfil" onClick={() => setMenuMobile(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
                  Minha conta
                </Link>
                <button onClick={() => { setMenuMobile(false); sair() }} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#dc2626', padding: '9px 10px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>
                  Sair
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
          /* Logo maior e centralizada de verdade na faixa (pedido do
             usuário, ajustado no canvas de design) — position:absolute
             ignora a divisão em colunas flex:1/flex:1 do resto da navbar,
             então centraliza em relação à largura toda, não só na coluna
             da esquerda. */
          .nav-logo-link { position: absolute; left: 50%; transform: translateX(-50%); }
          .nav-logo-img { height: 40px !important; }
        }
      `}</style>
    </>
  )
}
