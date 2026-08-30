import type { MetadataRoute } from 'next'

// Datas fixas de última alteração de conteúdo (não "agora" a cada geração —
// senão o campo não serve pra nada: nunca informa ao buscador quando o
// conteúdo de fato mudou, sempre diz "mudou agora mesmo").
const ULTIMA_ATUALIZACAO_HOME = new Date('2026-08-30')
const ULTIMA_ATUALIZACAO_TERMOS = new Date('2026-08-30')
const ULTIMA_ATUALIZACAO_PRIVACIDADE = new Date('2026-08-30')

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://cidadaniafrutal.com.br'

  return [
    {
      url: base,
      lastModified: ULTIMA_ATUALIZACAO_HOME,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // /mapa e /assistenteia exigem login — não entram aqui: um visitante ou
    // rastreador sem sessão bate num redirecionamento, não em conteúdo real.
    {
      url: `${base}/termos`,
      lastModified: ULTIMA_ATUALIZACAO_TERMOS,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/privacidade`,
      lastModified: ULTIMA_ATUALIZACAO_PRIVACIDADE,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
