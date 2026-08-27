import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/mapa', '/assistenteia', '/termos', '/privacidade'],
        disallow: ['/master', '/perfil', '/responder', '/autoridade', '/api'],
      },
    ],
    sitemap: 'https://cidadaniafrutal.com.br/sitemap.xml',
  }
}
