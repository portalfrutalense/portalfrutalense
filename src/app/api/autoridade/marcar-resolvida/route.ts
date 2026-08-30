import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/autoridade/marcar-resolvida  { demanda_id }
// Só permite se a autoridade já respondeu o próprio vínculo naquela demanda.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { data: vinculo } = await supabaseServer
    .from('demanda_entidades')
    .select('id, resposta')
    .eq('demanda_id', demanda_id)
    .eq('entidade_id', user.id)
    .single()

  if (!vinculo) return NextResponse.json({ error: 'Demanda não direcionada a você.' }, { status: 403 })
  if (!vinculo.resposta) return NextResponse.json({ error: 'Responda a demanda antes de marcar como resolvida.' }, { status: 400 })

  const { error } = await supabaseServer.from('demandas').update({ status: 'resolvida' }).eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
