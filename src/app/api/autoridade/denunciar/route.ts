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

// POST /api/autoridade/denunciar  { demanda_id, motivo? }
// Não depende de já ter respondido. Some do mapa público pra todo mundo,
// aparece pro master como "denunciada". Reaproveita a coluna ia_motivo
// (sem uso nesse status) pra guardar o motivo dado pela autoridade.
export async function POST(req: NextRequest) {
  const user = await verificarUsuario(req)
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
