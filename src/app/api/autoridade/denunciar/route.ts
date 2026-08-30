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

  const { error } = await supabaseServer.from('demandas').update({
    status: 'denunciada',
    ia_motivo: motivo?.trim() || 'Denunciada por uma autoridade.',
  }).eq('id', demanda_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
