import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

async function verificarUsuario(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return null
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  return user
}

// POST /api/autoridade/marcar-resolvida  { demanda_id }
// Só permite se a autoridade já respondeu o próprio vínculo naquela demanda.
export async function POST(req: NextRequest) {
  const user = await verificarUsuario(req)
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
