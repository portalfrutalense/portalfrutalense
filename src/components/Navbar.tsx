'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Denúncias' },
  { href: '/mapa', label: 'Mapa' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/guia', label: 'Guia Útil' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header style={{ backgroundColor: '#1e3a5f' }} className="text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-0 flex items-stretch justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight flex items-center py-4 pr-8 border-r border-blue-800">
          Portal Frutalense
        </Link>

        <nav className="flex items-stretch">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-5 text-sm font-medium border-r border-blue-800 transition-colors
                ${pathname === href
                  ? 'text-white'
                  : 'text-blue-200 hover:text-white'
                }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
