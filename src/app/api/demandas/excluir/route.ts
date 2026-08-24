import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

async function getUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function pathDaFoto(fotoUrl: string): string | null {
  try {
    const url = new URL(fotoUrl)
    const parts = url.pathname.split('/demandas-fotos/')
    return parts[1] || null
  } catch {
    return null
  }
}

// POST /api/demandas/excluir  { demanda_id }
// Exclui a demanda do próprio usuário logado, limpando a foto do Storage junto.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { demanda_id } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { data: demanda } = await supabaseServer.from('demandas').select('id, user_id, foto_url').eq('id', demanda_id).single()
  if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada.' }, { status: 404 })
  if (demanda.user_id !== user.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })

  if (demanda.foto_url) {
    const caminho = pathDaFoto(demanda.foto_url)
    if (caminho) await supabaseServer.storage.from('demandas-fotos').remove([caminho])
  }

  const { error } = await supabaseServer.from('demandas').delete().eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
