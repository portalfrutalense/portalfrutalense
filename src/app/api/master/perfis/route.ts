import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

async function verificarMaster(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseServer.auth.getUser(token)
  if (!user) return null
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'master') return null
  return user
}

// GET — lista todos os perfis
export async function GET(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseServer
    .from('perfis')
    .select('*')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// PATCH — editar nome/cpf/email ou bloquear
export async function PATCH(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id, ...campos } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

  const { error } = await supabaseServer.from('perfis').update(campos).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — excluir perfil + usuário do auth
export async function DELETE(req: NextRequest) {
  const master = await verificarMaster(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

  // Impede auto-exclusão
  if (id === master.id) return NextResponse.json({ error: 'Não é possível excluir a própria conta pelo painel.' }, { status: 400 })

  await supabaseServer.from('perfis').delete().eq('id', id)
  const { error } = await supabaseServer.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
