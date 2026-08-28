import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CidadanIA Frutal',
    short_name: 'CidadanIA',
    description: 'Mapas interativos da cidade de Frutal-MG',
    start_url: '/',
    display: 'standalone',
    background_color: '#4256c8',
    theme_color: '#4256c8',
    icons: [
      {
        src: '/favicon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/favicon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
