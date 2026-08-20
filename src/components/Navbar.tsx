'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'

export default function Navbar() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalAuth, setModalAuth] = useState(false)
  const { user, perfil, sair } = useAuth()

  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  return (
    <>
      <header style={{ backgroundColor: '#1e3a5f', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '0 32px', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', minHeight: '52px' }}>
          {/* Logo */}
          <Link href="/" style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', color: 'white', textDecoration: 'none', letterSpacing: '-0.01em', flexShrink: 0 }}>
            Portal Frutalense
          </Link>

          {/* Auth desktop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="hide-mobile">
            {user ? (
              <>
                <span style={{ fontSize: '13px', color: '#93c5fd' }}>Olá, {nomeExibido}</span>
                <button onClick={sair} style={{ fontSize: '13px', color: '#93c5fd', background: 'none', border: '1px solid #2d5a8f', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
                  Sair
                </button>
              </>
            ) : (
              <button onClick={() => setModalAuth(true)} style={{ fontSize: '13px', color: '#93c5fd', background: 'none', border: '1px solid #2d5a8f', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
                Entrar
              </button>
            )}
          </div>

          {/* Hambúrguer mobile */}
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Menu"
            style={{ display: 'none', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0 4px', fontSize: '22px', alignItems: 'center' }}
            className="show-mobile-flex"
          >
            {menuAberto ? 'Fechar' : 'Menu'}
          </button>
        </div>

        {/* Menu mobile */}
        {menuAberto && (
          <nav style={{ borderTop: '1px solid #2d5a8f', backgroundColor: '#1e3a5f' }} className="show-mobile">
            <div style={{ padding: '12px 16px' }}>
              {user ? (
                <button onClick={sair} style={{ fontSize: '14px', color: '#93c5fd', background: 'none', border: '1px solid #2d5a8f', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', width: '100%' }}>
                  Sair ({nomeExibido})
                </button>
              ) : (
                <button onClick={() => { setMenuAberto(false); setModalAuth(true) }} style={{ fontSize: '14px', fontWeight: 600, color: 'white', background: '#2563eb', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', width: '100%' }}>
                  Entrar com Google
                </button>
              )}
            </div>
          </nav>
        )}

        <style>{`
          @media (max-width: 600px) {
            .hide-mobile { display: none !important; }
            .show-mobile-flex { display: flex !important; }
            .show-mobile { display: block !important; }
          }
          @media (min-width: 601px) {
            .show-mobile-flex { display: none !important; }
            .show-mobile { display: none !important; }
          }
        `}</style>
      </header>

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}
    </>
  )
}
