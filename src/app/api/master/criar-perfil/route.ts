import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { nome, cargo, email, senha, role, categorias } = await req.json()

  if (!nome || !email || !senha || !role) {
    return NextResponse.json({ error: 'nome, email, senha e role são obrigatórios.' }, { status: 400 })
  }
  if (!['autoridade', 'empresa'].includes(role)) {
    return NextResponse.json({ error: 'Role inválido.' }, { status: 400 })
  }

  // 1. Criar conta no Auth
  const { data, error: authError } = await supabaseServer.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: nome.trim() },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const userId = data.user.id

  // 2. Criar perfil
  const { error: perfilError } = await supabaseServer.from('perfis').insert({
    id: userId,
    nome: nome.trim(),
    email,
    cargo: cargo?.trim() || null,
    role,
  })
  if (perfilError) {
    await supabaseServer.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: perfilError.message }, { status: 500 })
  }

  // 3. Se for autoridade, criar também em entidades (mesmo ID) e atribuir categorias
  if (role === 'autoridade') {
    const { error: entError } = await supabaseServer.from('entidades').insert({
      id: userId,
      nome: nome.trim(),
      cargo: cargo?.trim() || '',
      email,
      ativo: true,
    })
    if (entError) {
      await supabaseServer.from('perfis').delete().eq('id', userId)
      await supabaseServer.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: entError.message }, { status: 500 })
    }

    // 4. Atribuir categorias
    //
    // BUG CORRIGIDO (B16-8): uma falha aqui era só logada no servidor — a
    // conta ficava criada normalmente, mas sem NENHUMA categoria vinculada
    // e, na prática, nunca recebe demanda alguma, sem o master perceber
    // (a conta parece ter dado certo). Não vale desfazer a conta inteira
    // por causa disso (ela já é válida, só falta o vínculo) — devolve um
    // aviso, mesmo padrão já usado em /api/master/perfis (DELETE) pra
    // avisos que não são erro fatal.
    let avisoCategorias: string | undefined
    if (Array.isArray(categorias) && categorias.length > 0) {
      const rows = categorias.map((catId: string) => ({ categoria_id: catId, entidade_id: userId }))
      const { error: catError } = await supabaseServer.from('categoria_entidades').insert(rows)
      if (catError) {
        console.error('[master/criar-perfil] falha ao salvar categorias:', catError)
        avisoCategorias = 'A conta foi criada, mas não foi possível salvar as categorias vinculadas — edite o perfil pra tentar de novo, senão essa autoridade não vai receber nenhuma demanda.'
      }
    }
    return NextResponse.json({ ok: true, id: userId, aviso: avisoCategorias })
  }

  return NextResponse.json({ ok: true, id: userId })
}
