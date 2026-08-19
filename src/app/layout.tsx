import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Portal Frutalense',
  description: 'Plataforma de cidadania, transparência e gestão de demandas públicas em Frutal-MG',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center text-sm text-gray-400 py-8 mt-12 border-t">
          © {new Date().getFullYear()} Portal Frutalense · Frutal-MG · Transparência e Cidadania
        </footer>
      </body>
    </html>
  )
}
