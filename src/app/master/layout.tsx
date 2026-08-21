import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Painel Master · CidadanIA Frutal',
}

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

