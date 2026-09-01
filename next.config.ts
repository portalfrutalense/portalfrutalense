import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // BUG CORRIGIDO (B01-2): nenhum cabeçalho de segurança configurado em
  // todo o projeto. Escopo deliberadamente mínimo — não inclui
  // Content-Security-Policy completo, porque isso exigiria mapear com
  // certeza todo host externo usado em produção (Mapbox, Google Fonts,
  // Cloudflare Turnstile, Supabase Storage) sem poder testar ao vivo; um
  // CSP errado quebraria o mapa (a parte mais frágil do sistema, já
  // corrigida várias vezes nesta sessão). Cobre só o que o próprio achado
  // pede como mínimo: nega enquadramento em iframe (clickjacking no painel
  // master) e evita vazar o magic_token de /responder/[token] no cabeçalho
  // Referer pra recursos de terceiros.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
};

export default nextConfig;
