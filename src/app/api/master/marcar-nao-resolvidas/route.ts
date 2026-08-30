import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/master/marcar-nao-resolvidas
 *
 * Marca como 'nao_resolvida' toda demanda em 'aguardando_resposta' ou
 * 'respondida' há mais de 30 dias — usa ia_analisado_em (quando a demanda
 * de fato entrou nesse estado) com fallback para created_at nos poucos
 * registros antigos sem esse campo preenchido. Sem isso, uma demanda
 * aprovada/reaprovada tardiamente contaria os 30 dias a partir da criação,
 * não da aprovação, e podia ser marcada antes de a autoridade ter qualquer
 * chance real de responder.
 *
 * Botão manual no painel master, não um job de cron — mesma escolha já
 * feita para "reprocessar pendentes" (ver /api/master/reprocessar-pendentes).
 */
export async function POST(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidatas, error: erroSelect } = await supabaseServer
    .from('demandas')
    .select('id, ia_analisado_em, created_at')
    .in('status', ['aguardando_resposta', 'respondida'])

  if (erroSelect) return NextResponse.json({ error: erroSelect.message }, { status: 500 })

  const idsParaMarcar = (candidatas || [])
    .filter(d => (d.ia_analisado_em || d.created_at) < limite)
    .map(d => d.id)

  if (idsParaMarcar.length === 0) {
    return NextResponse.json({ ok: true, marcadas: 0 })
  }

  const { error } = await supabaseServer
    .from('demandas')
    .update({ status: 'nao_resolvida' })
    .in('id', idsParaMarcar)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, marcadas: idsParaMarcar.length })
}
