import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE — cancela cadastro incompleto: remove o usuário do Auth sem ter perfil ainda
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!authRes.ok) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const user = await authRes.json()
  if (!user?.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Garante que não tem perfil completo — não deixa excluir conta ativa por engano
  const { data: perfil } = await supabaseServer.from('perfis').select('cpf').eq('id', user.id).maybeSingle()
  if (perfil?.cpf) return NextResponse.json({ error: 'Conta já registrada.' }, { status: 400 })

  const { error } = await supabaseServer.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
