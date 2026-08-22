import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PublicShell from '@/components/PublicShell'
import AuthProvider from '@/components/AuthProvider'
import GlobalModals from '@/components/GlobalModals'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CidadanIA Frutal',
  description: 'Plataforma de cidadania, transparência e gestão de demandas públicas em Frutal-MG',
  verification: {
    google: 'lPI_-xfdqfhBGjByM6htLkimhgUlfUZsy8pIVK99K_0',
  },
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
      <body className={`${inter.className} bg-[#f9fafb] min-h-screen`}>
        <AuthProvider>
          <GlobalModals />
          <PublicShell>
            {children}
          </PublicShell>
        </AuthProvider>
      </body>
    </html>
  )
}

