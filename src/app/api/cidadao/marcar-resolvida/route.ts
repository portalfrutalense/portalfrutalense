import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/cidadao/marcar-resolvida  { demanda_id }
// O próprio autor marca a demanda como resolvida. Mesma checagem de estado
// elegível já aplicada na UI (perfil/page.tsx) e reforçada pelo gatilho de
// banco restringir_status_demanda — validada aqui também, em vez de escrever
// direto do client, pro erro chegar com uma mensagem clara em vez de estourar
// como falha genérica de UPDATE bloqueado pelo gatilho.
const ESTADOS_ELEGIVEIS = ['aguardando_resposta', 'respondida', 'nao_resolvida']

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { demanda_id } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { data: demanda } = await supabaseServer.from('demandas').select('id, user_id, status').eq('id', demanda_id).single()
  if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada.' }, { status: 404 })
  if (demanda.user_id !== user.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
  if (!ESTADOS_ELEGIVEIS.includes(demanda.status)) {
    return NextResponse.json({ error: 'Esta demanda não pode ser marcada como resolvida no estado atual.' }, { status: 409 })
  }

  const { error } = await supabaseServer.from('demandas').update({ status: 'resolvida' }).eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
