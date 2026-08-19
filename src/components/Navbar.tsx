'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, Map, Briefcase, Phone } from 'lucide-react'

const links = [
  { href: '/', label: 'Denúncias', icon: Megaphone },
  { href: '/mapa', label: 'Mapa', icon: Map },
  { href: '/vagas', label: 'Vagas', icon: Briefcase },
  { href: '/guia', label: 'Guia Útil', icon: Phone },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="bg-green-700 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-tight">
          🏛️ Portal Frutalense
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${pathname === href
                  ? 'bg-green-900 text-white'
                  : 'hover:bg-green-600 text-green-100'
                }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Mobile nav */}
        <nav className="flex md:hidden gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-xs font-medium transition-colors
                ${pathname === href
                  ? 'bg-green-900 text-white'
                  : 'hover:bg-green-600 text-green-100'
                }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
