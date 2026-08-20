import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const EMAIL_MASTER = 'portalfrutalense@gmail.com'

async function verificarMaster(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user || user.email !== EMAIL_MASTER) return null
  return user
}

// GET /api/master/demanda — lista todas as demandas (bypassa RLS)
export async function GET(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseServer
    .from('demandas')
    .select('*, categoria:categorias_mapa(*), entidade:entidades(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/master/demanda  { demanda_id }
export async function DELETE(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { error } = await supabaseServer.from('demandas').delete().eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PATCH /api/master/demanda  { demanda_id, oculto?, descricao? }
export async function PATCH(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id, ...campos } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { error } = await supabaseServer.from('demandas').update(campos).eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
