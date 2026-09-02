import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/master/marcar-nao-resolvidas
 *
 * Marca como 'nao_resolvida' toda demanda em 'aguardando_resposta' há mais
 * de 30 dias — usa ia_analisado_em (quando a demanda de fato entrou nesse
 * estado) com fallback para created_at nos poucos registros antigos sem
 * esse campo preenchido. Sem isso, uma demanda aprovada/reaprovada
 * tardiamente contaria os 30 dias a partir da criação, não da aprovação, e
 * podia ser marcada antes de a autoridade ter qualquer chance real de
 * responder.
 *
 * BUG CORRIGIDO (B22-7, decisão confirmada com o usuário): antes incluía
 * também demandas 'respondida' — uma demanda que a autoridade JÁ respondeu
 * virava 'não resolvida' sozinha só por ninguém ter clicado em
 * "resolvida"/"não resolvida" depois, o que não é o mesmo problema que este
 * job existe pra resolver (autoridade que nunca respondeu). Só
 * 'aguardando_resposta' conta agora.
 *
 * Botão manual no painel master, não um job de cron — mesma escolha já
 * feita para "reprocessar pendentes" (ver /api/master/reprocessar-pendentes).
 */
export async function POST(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // BUG CORRIGIDO (B22-15): `select()` sem paginação para no limite padrão
  // do PostgREST (1.000 linhas) — com mais de mil demandas acumuladas em
  // 'aguardando_resposta' (plausível com o tempo, é um estado que só sai
  // por ação humana), o job passava a ignorar em silêncio tudo que não
  // coubesse na primeira página. Busca em páginas de 1.000 até esgotar.
  const candidatas: { id: string; ia_analisado_em: string | null; created_at: string }[] = []
  const TAMANHO_PAGINA = 1000
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error: erroSelect } = await supabaseServer
      .from('demandas')
      .select('id, ia_analisado_em, created_at')
      .eq('status', 'aguardando_resposta')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (erroSelect) return NextResponse.json({ error: erroSelect.message }, { status: 500 })
    candidatas.push(...(data || []))
    if (!data || data.length < TAMANHO_PAGINA) break
  }

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
