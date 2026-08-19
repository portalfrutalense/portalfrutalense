'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Denuncias' },
  { href: '/mapa', label: 'Mapa' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/guia', label: 'Guia Util' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header style={{ backgroundColor: '#1e3a5f', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', padding: '16px 24px 16px 0', borderRight: '1px solid #2d5a8f', color: 'white', textDecoration: 'none' }}>
          Portal Frutalense
        </Link>

        <nav style={{ display: 'flex', alignItems: 'stretch' }}>
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 500,
                borderRight: '1px solid #2d5a8f',
                color: pathname === href ? 'white' : '#bfdbfe',
                backgroundColor: pathname === href ? '#1e40af' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
