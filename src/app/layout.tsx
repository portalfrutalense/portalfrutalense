import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PublicShell from '@/components/PublicShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Portal Frutalense',
  description: 'Plataforma de cidadania, transparência e gestão de demandas públicas em Frutal-MG',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#f4f6f8] min-h-screen`}>
        <PublicShell>
          {children}
        </PublicShell>
      </body>
    </html>
  )
}
