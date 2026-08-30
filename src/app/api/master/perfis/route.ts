import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// GET — lista todos os perfis
export async function GET(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseServer
    .from('perfis')
    .select('*')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// PATCH — editar campos do perfil (e entidade se for autoridade)
export async function PATCH(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id, categorias, ...campos } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

  // Autoridades legadas (só existem em "entidades", sem perfil/conta Auth) não têm usuário
  // no Supabase Auth para sincronizar — checa antes de tentar, senão o updateUserById falha.
  const [{ data: perfil }, { data: entidade }] = await Promise.all([
    supabaseServer.from('perfis').select('role').eq('id', id).single(),
    supabaseServer.from('entidades').select('id').eq('id', id).single(),
  ])
  const temAuth = !!perfil

  // Sincronizar email com auth se alterado (só quando existe conta Auth de fato)
  if (campos.email && temAuth) {
    const { error: authError } = await supabaseServer.auth.admin.updateUserById(id, { email: campos.email, email_confirm: true })
    if (authError) return NextResponse.json({ error: `Erro ao atualizar email: ${authError.message}` }, { status: 500 })
  }

  // Atualizar perfil (autoridade legada não tem linha em "perfis" — update simplesmente não afeta nada)
  const camposPerfil = { ...campos }
  delete camposPerfil.categorias
  const { error: perfilError } = await supabaseServer.from('perfis').update(camposPerfil).eq('id', id)
  if (perfilError) return NextResponse.json({ error: perfilError.message }, { status: 500 })

  // Se for autoridade (novo fluxo com perfil, ou legada só em "entidades"), sincronizar entidade também
  const ehAutoridade = perfil?.role === 'autoridade' || !!entidade
  if (ehAutoridade) {
    const camposEnt: any = {}
    if (campos.nome) camposEnt.nome = campos.nome
    if (campos.cargo) camposEnt.cargo = campos.cargo
    if (campos.email) camposEnt.email = campos.email
    if (Object.keys(camposEnt).length > 0) {
      await supabaseServer.from('entidades').update(camposEnt).eq('id', id)
    }

    // Atualizar categorias se fornecidas
    if (Array.isArray(categorias)) {
      await supabaseServer.from('categoria_entidades').delete().eq('entidade_id', id)
      if (categorias.length > 0) {
        const rows = categorias.map((catId: string) => ({ categoria_id: catId, entidade_id: id }))
        await supabaseServer.from('categoria_entidades').insert(rows)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE — excluir perfil + entidade (se autoridade) + fotos + demandas + auth
export async function DELETE(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  if (id === master.id) return NextResponse.json({ error: 'Não é possível excluir a própria conta pelo painel.' }, { status: 400 })

  // Buscar perfil e entidade para saber o que existe
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', id).single()
  const { data: entidade } = await supabaseServer.from('entidades').select('id').eq('id', id).single()

  const ehAutoridade = perfil?.role === 'autoridade' || !!entidade
  const temPerfil = !!perfil
  const temAuth = temPerfil // só tem auth user se tem perfil (novo fluxo)

  // Remover categorias e entidade se for autoridade (novo ou legado)
  if (ehAutoridade) {
    await supabaseServer.from('categoria_entidades').delete().eq('entidade_id', id)
    await supabaseServer.from('entidades').delete().eq('id', id)
  }

  // Se não tem perfil (autoridade legada), encerra aqui
  if (!temPerfil) return NextResponse.json({ ok: true })

  await supabaseServer.from('perfis').delete().eq('id', id)

  if (temAuth) {
    const { error } = await supabaseServer.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
