'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'

export default function Navbar() {
  const [modalAuth, setModalAuth] = useState(false)
  const { user, perfil, sair } = useAuth()

  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  return (
    <>
      <header style={{ backgroundColor: '#1e3a5f', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '0 16px 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '60px', gap: '12px' }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '38px', width: 'auto', display: 'block' }} />
          </Link>

          {/* Auth — igual em todos os tamanhos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {user ? (
              <>
                <Link href="/perfil" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', textDecoration: 'none' }}>
                  Olá, {nomeExibido}
                </Link>
                <button onClick={sair} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', background: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Sair
                </button>
              </>
            ) : (
              <button onClick={() => setModalAuth(true)} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', background: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}
    </>
  )
}

