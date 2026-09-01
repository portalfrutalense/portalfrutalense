import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE — cancela cadastro incompleto: remove o usuário do Auth sem ter perfil ainda
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Garante que não tem perfil completo — não deixa excluir conta ativa por engano.
  // BUG CORRIGIDO: a trava usava "tem CPF" como sinônimo de "conta completa",
  // mas autoridade/empresa/master NUNCA têm CPF (regra do próprio sistema) —
  // uma chamada direta a esta rota com o token de uma autoridade apagava a
  // conta dela inteira, sem confirmação nenhuma. A trava correta é o `role`:
  // só é "cadastro incompleto de cidadão" quando não tem role nenhum ainda
  // (conta recém-criada) ou já é 'cidadao', igual à checagem `precisaCPF` do
  // AuthProvider. Qualquer outro role bloqueia incondicionalmente.
  const { data: perfil } = await supabaseServer.from('perfis').select('cpf, role').eq('id', user.id).maybeSingle()
  if (perfil && perfil.role !== 'cidadao' && perfil.role != null) {
    return NextResponse.json({ error: 'Conta já registrada.' }, { status: 400 })
  }
  if (perfil?.cpf) return NextResponse.json({ error: 'Conta já registrada.' }, { status: 400 })

  const { error } = await supabaseServer.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
