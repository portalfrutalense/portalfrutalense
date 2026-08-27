import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Usuário autenticado a partir do Bearer token, ou null. */
export async function getUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export function ipDaRequisicao(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

/**
 * Valida o token do Turnstile no siteverify da Cloudflare.
 * Sem esta chamada server-side o widget é decorativo — o token do
 * navegador nunca é conferido e o formulário segue aberto a bots.
 */
export async function verificarTurnstile(token: string | undefined, ip: string | null) {
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    })
    const data = await res.json()
    return !!data.success
  } catch {
    return false
  }
}
