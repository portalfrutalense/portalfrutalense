import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Painel Master · Portal Frutalense',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f8' }}>
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 16px' }}>
        {children}
      </main>
    </div>
  )
}
