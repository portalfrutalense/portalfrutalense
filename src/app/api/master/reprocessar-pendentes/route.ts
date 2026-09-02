import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/master/reprocessar-pendentes
 *
 * A criação de demanda dispara a análise de IA em fire-and-forget
 * (POST /api/demandas não espera /api/ia/analisar terminar). Se essa
 * chamada falhar por qualquer motivo — timeout, Gemini fora do ar, erro
 * de rede — a demanda fica presa em 'pendente' para sempre: nunca é
 * analisada, nunca notifica autoridade. O mesmo vale para pets/classificados.
 *
 * Botão manual no painel master, em vez de rodar sozinho num cron — dispara
 * a análise de novo pra tudo que estiver pendente há mais de 10 minutos.
 */
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const base = process.env.SITE_URL || 'http://localhost:3000'
  const chaveInterna = process.env.INTERNAL_SECRET || ''

  // BUG CORRIGIDO (B22-12): sem limite de lote, um acúmulo grande de
  // pendentes (ex: Gemini fora do ar por horas) disparava uma chamada em
  // paralelo pra cada um, todas aguardadas (`await Promise.all(disparos)`)
  // antes de responder — arriscando estourar `maxDuration = 60` e derrubar
  // a requisição inteira no meio, sem o master saber quantas realmente
  // saíram. Limita cada categoria a um lote por clique; se sobrar mais que
  // isso, é só clicar de novo (idempotente — o filtro é sempre "pendente há
  // mais de 10 minutos").
  const LOTE = 20
  const [{ data: demandas }, { data: pets }, { data: classificados }] = await Promise.all([
    supabaseServer.from('demandas').select('id').eq('status', 'pendente').lt('created_at', limite).limit(LOTE),
    supabaseServer.from('pets').select('id').eq('ia_decisao', 'pendente').lt('created_at', limite).limit(LOTE),
    supabaseServer.from('classificados').select('id').eq('ia_decisao', 'pendente').lt('created_at', limite).limit(LOTE),
  ])

  const disparos: Promise<unknown>[] = []

  for (const d of demandas || []) {
    disparos.push(
      fetch(`${base}/api/ia/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': chaveInterna },
        body: JSON.stringify({ demanda_id: d.id }),
      }).catch((e) => console.error(`[reprocessar] demanda ${d.id} falhou:`, e))
    )
  }
  for (const p of pets || []) {
    disparos.push(
      fetch(`${base}/api/ia/analisar-pet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': chaveInterna },
        body: JSON.stringify({ pet_id: p.id }),
      }).catch((e) => console.error(`[reprocessar] pet ${p.id} falhou:`, e))
    )
  }
  for (const c of classificados || []) {
    disparos.push(
      fetch(`${base}/api/ia/analisar-classificado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': chaveInterna },
        body: JSON.stringify({ classificado_id: c.id }),
      }).catch((e) => console.error(`[reprocessar] classificado ${c.id} falhou:`, e))
    )
  }

  await Promise.all(disparos)

  return NextResponse.json({
    ok: true,
    reprocessadas: { demandas: demandas?.length || 0, pets: pets?.length || 0, classificados: classificados?.length || 0 },
  })
}
