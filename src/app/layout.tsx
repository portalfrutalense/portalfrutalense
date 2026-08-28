import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import PublicShell from '@/components/PublicShell'
import AuthProvider from '@/components/AuthProvider'
import GlobalModals from '@/components/GlobalModals'

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
    shortcut: '/favicon.ico',
  },
  title: 'CidadanIA Frutal',
  description: 'Explore os mapas interativos da cidade para cobrar serviços públicos, encontrar oportunidades, empregos, ajudar a encontrar pets e apoiar causas locais.',
  alternates: {
    canonical: 'https://cidadaniafrutal.com.br',
  },
  openGraph: {
    title: 'CidadanIA Frutal',
    description: 'Explore os mapas interativos da cidade para cobrar serviços públicos, encontrar oportunidades, empregos, ajudar a encontrar pets e apoiar causas locais.',
    url: 'https://cidadaniafrutal.com.br',
    siteName: 'CidadanIA Frutal',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CidadanIA Frutal',
    description: 'Explore os mapas interativos da cidade para cobrar serviços públicos, encontrar oportunidades, empregos, ajudar a encontrar pets e apoiar causas locais.',
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

