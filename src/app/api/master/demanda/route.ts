import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/master/demanda — lista todas as demandas com email (bypassa RLS)
export async function GET(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const [{ data, error }, { data: perfis }] = await Promise.all([
    supabaseServer
      .from('demandas')
      .select('*, categoria:categorias_mapa(*), entidade:entidades(*), vinculos:demanda_entidades(id, status, resposta, respondida_em, resposta_ip, email_status, email_resend_id, entidade:entidades(nome, cargo))')
      .order('created_at', { ascending: false }),
    supabaseServer.from('perfis').select('id, email'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const emailMap: Record<string, string> = {}
  ;(perfis || []).forEach((p: any) => { if (p.email) emailMap[p.id] = p.email })

  return NextResponse.json((data || []).map((d: any) => ({ ...d, morador_email: emailMap[d.user_id] || null })))
}

// DELETE /api/master/demanda  { demanda_id }
export async function DELETE(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { data: demanda } = await supabaseServer.from('demandas').select('foto_url').eq('id', demanda_id).single()
  if (demanda?.foto_url) {
    try {
      const url = new URL(demanda.foto_url)
      const caminho = url.pathname.split('/demandas-fotos/')[1]
      if (caminho) await supabaseServer.storage.from('demandas-fotos').remove([caminho])
    } catch {
      // URL inválida — segue com a exclusão da demanda mesmo assim
    }
  }

  const { error } = await supabaseServer.from('demandas').delete().eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PATCH /api/master/demanda  { demanda_id, oculto?, descricao? }
export async function PATCH(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id, ...campos } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { error } = await supabaseServer.from('demandas').update(campos).eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
