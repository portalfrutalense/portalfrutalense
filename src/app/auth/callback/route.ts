import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Só aceita "next" como caminho relativo dentro do próprio site — nunca uma
 * URL absoluta. Sem essa checagem, "next" concatenado direto com origin
 * (`${origin}${next}`) é vulnerável a open redirect: um valor tipo
 * "@evil.com/x" produz "https://seudominio.com@evil.com/x", que o
 * navegador interpreta como usuário "seudominio.com" no host "evil.com" —
 * redireciona pra fora do site depois do login, clássico vetor de phishing.
 */
function proximaRotaSegura(valor: string | null): string {
  if (valor && valor.startsWith('/') && !valor.startsWith('//')) return valor
  return '/mapa'
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const next = proximaRotaSegura(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession falhou:', error.message)
  }

  // Sem código, ou troca falhou — manda pra landing com um aviso, em vez de
  // silenciosamente fingir que deu certo redirecionando pro mapa mesmo assim.
  return NextResponse.redirect(`${origin}/?erro=login`)
}
