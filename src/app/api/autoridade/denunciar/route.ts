import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/autoridade/denunciar  { demanda_id, motivo? }
// Não depende de já ter respondido. Some do mapa público pra todo mundo,
// aparece pro master como "denunciada". Reaproveita a coluna ia_motivo
// (sem uso nesse status) pra guardar o motivo dado pela autoridade.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id, motivo } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { data: vinculo } = await supabaseServer
    .from('demanda_entidades')
    .select('id')
    .eq('demanda_id', demanda_id)
    .eq('entidade_id', user.id)
    .single()

  if (!vinculo) return NextResponse.json({ error: 'Demanda não direcionada a você.' }, { status: 403 })

  // BUG CORRIGIDO (B16-2): nada checava o status atual — dava pra denunciar
  // uma demanda já 'resolvida'/'nao_resolvida' (jogando de volta pra
  // moderação algo que já tinha sido encerrado) ou já 'denunciada' (perdendo
  // o `ia_motivo` original, que essa mesma rota reaproveita pra guardar o
  // motivo da denúncia — sobrescrever de novo apaga o motivo da denúncia
  // anterior sem necessidade). Só faz sentido denunciar uma demanda que
  // ainda está em circulação normal.
  const { data: demandaAtual } = await supabaseServer.from('demandas').select('status').eq('id', demanda_id).single()
  if (!demandaAtual || !['aguardando_resposta', 'respondida'].includes(demandaAtual.status)) {
    return NextResponse.json({ error: 'Essa demanda não pode ser denunciada no estado atual.' }, { status: 400 })
  }

  const { error } = await supabaseServer.from('demandas').update({
    status: 'denunciada',
    ia_motivo: motivo?.trim() || 'Denunciada por uma autoridade.',
  }).eq('id', demanda_id)

  if (error) {
    console.error('[autoridade/denunciar]', error)
    return NextResponse.json({ error: 'Não foi possível registrar a denúncia.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
