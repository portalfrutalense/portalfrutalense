'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import ModalCPF from './ModalCPF'

// Páginas públicas onde o modal de CPF NÃO deve aparecer
const PAGINAS_PUBLICAS = ['/', '/privacidade', '/termos']

export default function GlobalModals() {
  const { precisaCPF } = useAuth()
  const pathname = usePathname()

  const ehPaginaPublica = PAGINAS_PUBLICAS.includes(pathname)

  if (precisaCPF && !ehPaginaPublica) return <ModalCPF />
  return null
}
