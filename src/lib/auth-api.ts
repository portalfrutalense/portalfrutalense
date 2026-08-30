import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { supabaseServer } from '@/lib/supabase-server'

/** Usuário autenticado a partir do Bearer token, ou null. */
export async function getUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

/**
 * Usuário autenticado E com role='master' no perfil, ou null.
 * Centraliza o que antes estava duplicado (quase) idêntico em ~15 rotas
 * de /api/master/* e /api/autoridade/* — qualquer correção de auth agora
 * vale para todas elas de uma vez.
 */
export async function getMasterUser(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return null
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'master') return null
  return user
}

export function ipDaRequisicao(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

/**
 * Compara dois segredos em tempo constante — `!==` vaza, por timing, quantos
 * caracteres do início bateram, o que facilita (um pouco) adivinhar a chave
 * certa por tentativa e erro. Usado para comparar chaves internas fixas
 * (x-internal-key, webhook secrets), nunca para senha de usuário (essa passa
 * pelo Supabase Auth, que já trata isso).
 */
export function segredoValido(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Limitador de taxa best-effort, em memória — NÃO é garantia real em produção
 * serverless: cada instância fria do Vercel tem sua própria memória, então um
 * atacante distribuído entre instâncias pode passar disso. Serve para conter
 * abuso trivial de um mesmo processo/IP martelando a rota em sequência, não
 * para proteção robusta. Uma solução real exigiria um store compartilhado
 * (Upstash Redis, Vercel KV) — não configurado neste projeto.
 */
const _janelasRate = new Map<string, { contagem: number; expiraEm: number }>()
let _proximaLimpeza = 0

/** Varre e descarta entradas já expiradas — sem isso o Map só cresce
 * (cada chave nova nunca é removida, só sobrescrita se repetir). Roda no
 * máximo 1x por minuto, disparada de carona numa chamada normal, pra não
 * precisar de um timer/cron separado só pra isso. */
function limparExpiradas() {
  const agora = Date.now()
  if (agora < _proximaLimpeza) return
  _proximaLimpeza = agora + 60_000
  for (const [chave, janela] of _janelasRate) {
    if (agora > janela.expiraEm) _janelasRate.delete(chave)
  }
}

export function limiteExcedido(chave: string, maxPorJanela: number, janelaMs: number): boolean {
  limparExpiradas()
  const agora = Date.now()
  const atual = _janelasRate.get(chave)
  if (!atual || agora > atual.expiraEm) {
    _janelasRate.set(chave, { contagem: 1, expiraEm: agora + janelaMs })
    return false
  }
  atual.contagem++
  return atual.contagem > maxPorJanela
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
