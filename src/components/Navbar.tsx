'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/denuncias', label: 'Denúncias' },
  { href: '/mapa', label: 'Mapa de Ocorrências' },
  { href: '/vagas', label: 'Vagas de Emprego' },
  { href: '/guia', label: 'Guia Útil' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <header style={{ backgroundColor: '#1e3a5f', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', minHeight: '52px' }}>
        {/* Logo */}
        <Link href="/" style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', padding: '0 20px 0 0', color: 'white', textDecoration: 'none', letterSpacing: '-0.01em', flexShrink: 0 }}>
          Portal Frutalense
        </Link>

        {/* Links desktop */}
        <nav style={{ display: 'flex', alignItems: 'stretch' }} className="hide-mobile">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: '14px', fontWeight: 500,
              borderRight: '1px solid #2d5a8f', color: pathname === href ? 'white' : '#93c5fd',
              backgroundColor: pathname === href ? '#1e40af' : 'transparent', textDecoration: 'none',
            }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Botão hambúrguer mobile */}
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          aria-label="Menu"
          style={{ display: 'none', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0 4px', fontSize: '22px', alignItems: 'center' }}
          className="show-mobile-flex"
        >
          {menuAberto ? '✕' : '☰'}
        </button>
      </div>

      {/* Menu mobile expandido */}
      {menuAberto && (
        <nav style={{ borderTop: '1px solid #2d5a8f', backgroundColor: '#1e3a5f' }} className="show-mobile">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuAberto(false)} style={{
              display: 'block', padding: '14px 16px', fontSize: '15px', fontWeight: 500,
              color: pathname === href ? 'white' : '#93c5fd',
              backgroundColor: pathname === href ? '#1e40af' : 'transparent',
              textDecoration: 'none', borderBottom: '1px solid #2d5a8f',
            }}>
              {label}
            </Link>
          ))}
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
  )
}
