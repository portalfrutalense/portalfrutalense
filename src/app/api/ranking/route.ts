import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export const revalidate = 60

/**
 * GET /api/ranking — pública, sem autenticação. Ranking de autoridades por
 * demandas respondidas (/ranking). Retorna todas as autoridades ativas,
 * mesmo as com 0 demandas destinadas (decisão confirmada com o usuário).
 *
 * "destinadas" = total de vínculos em demanda_entidades pra essa autoridade.
 * "respondidas" = os vínculos com status='respondida' (autoridade de fato
 * respondeu — histórico completo, não filtrado por período).
 */
export async function GET() {
  const [{ data: entidades, error: erroEntidades }, { data: vinculos, error: erroVinculos }] = await Promise.all([
    supabaseServer.from('entidades').select('id, nome, cargo, foto_url').eq('ativo', true),
    supabaseServer.from('demanda_entidades').select('entidade_id, status'),
  ])

  if (erroEntidades) return NextResponse.json({ error: erroEntidades.message }, { status: 500 })
  if (erroVinculos) return NextResponse.json({ error: erroVinculos.message }, { status: 500 })

  const contagem = new Map<string, { destinadas: number; respondidas: number }>()
  for (const v of vinculos || []) {
    const atual = contagem.get(v.entidade_id) || { destinadas: 0, respondidas: 0 }
    atual.destinadas += 1
    if (v.status === 'respondida') atual.respondidas += 1
    contagem.set(v.entidade_id, atual)
  }

  const ranking = (entidades || []).map(e => {
    const c = contagem.get(e.id) || { destinadas: 0, respondidas: 0 }
    // 0/0 mostra 0% (decisão confirmada com o usuário), não "sem dado".
    const taxa = c.destinadas > 0 ? Math.round((c.respondidas / c.destinadas) * 100) : 0
    return {
      id: e.id,
      nome: e.nome,
      cargo: e.cargo,
      foto_url: e.foto_url || null,
      destinadas: c.destinadas,
      respondidas: c.respondidas,
      taxa,
    }
  })

  return NextResponse.json({ ranking })
}
