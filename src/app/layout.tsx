import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import PublicShell from '@/components/PublicShell'
import AuthProvider from '@/components/AuthProvider'
import GlobalModals from '@/components/GlobalModals'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { SheetProvider } from '@/contexts/SheetContext'

const inter = Inter({ subsets: ['latin'] })

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  // Ancora as URLs absolutas (og:image etc.) no domínio canônico, sem www
  metadataBase: new URL('https://cidadaniafrutal.com.br'),
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
  },
  title: 'CidadanIA Frutal',
  description: 'Explore os mapas interativos para ver e registrar demandas de serviços públicos, encontrar vagas de empregos, anunciar e comprar veículos e imóveis e ajudar a encontrar e adotar pets.',
  // Sem "alternates.canonical" fixo aqui: como esse campo não é sobrescrito
  // automaticamente por página, deixá-lo no layout raiz fazia todo o site
  // (inclusive /termos e /privacidade) apontar seu canonical pra home —
  // dizendo ao Google que essas páginas eram cópias dela. Cada página que
  // precisar de canonical próprio declara o dela (ver termos/privacidade).
  openGraph: {
    title: 'CidadanIA Frutal',
    description: 'Explore os mapas interativos para ver e registrar demandas de serviços públicos, encontrar vagas de empregos, anunciar e comprar veículos e imóveis e ajudar a encontrar e adotar pets.',
    url: 'https://cidadaniafrutal.com.br',
    siteName: 'CidadanIA Frutal',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CidadanIA Frutal',
    description: 'Explore os mapas interativos para ver e registrar demandas de serviços públicos, encontrar vagas de empregos, anunciar e comprar veículos e imóveis e ajudar a encontrar e adotar pets.',
  },
  verification: {
    google: 'lPI_-xfdqfhBGjByM6htLkimhgUlfUZsy8pIVK99K_0',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4256c8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} ${jakarta.variable} bg-[#f9fafb] min-h-screen`}>
        <ServiceWorkerRegister />
        <AuthProvider>
          <SheetProvider>
            <GlobalModals />
            <PublicShell>
              {children}
            </PublicShell>
          </SheetProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

