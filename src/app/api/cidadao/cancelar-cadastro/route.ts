import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE — cancela cadastro incompleto: remove o usuário do Auth sem ter perfil ainda
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Garante que não tem perfil completo — não deixa excluir conta ativa por engano
  const { data: perfil } = await supabaseServer.from('perfis').select('cpf').eq('id', user.id).maybeSingle()
  if (perfil?.cpf) return NextResponse.json({ error: 'Conta já registrada.' }, { status: 400 })

  const { error } = await supabaseServer.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
