import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Painel Master · Fala Frutal',
}

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

