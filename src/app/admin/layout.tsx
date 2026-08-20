import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Painel Master · Portal Frutalense',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
