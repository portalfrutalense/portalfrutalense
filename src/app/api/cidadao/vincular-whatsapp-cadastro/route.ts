import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!authRes.ok) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const user = await authRes.json()
  if (!user?.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { telefone } = await req.json()
  if (!telefone) return NextResponse.json({ error: 'Telefone obrigatório.' }, { status: 400 })

  // A Evolution API às vezes omite o 9º dígito de celulares BR (553491500046 em vez de 5534991500046)
  // Tenta os dois formatos para garantir o vínculo
  const alternativo = telefone.length === 13
    ? telefone.slice(0, 4) + telefone.slice(5)   // remove o 9: 5534991500046 → 553491500046
    : telefone.slice(0, 4) + '9' + telefone.slice(4) // adiciona o 9: 553491500046 → 5534991500046

  const [r1, r2] = await Promise.all([
    supabaseServer.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', telefone).select('id'),
    supabaseServer.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', alternativo).select('id'),
  ])

  const conversaVinculada = (r1.data?.length ?? 0) > 0 || (r2.data?.length ?? 0) > 0

  return NextResponse.json({ ok: true, conversaVinculada })
}
