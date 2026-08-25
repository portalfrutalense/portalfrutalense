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

  await supabaseServer.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', telefone)

  return NextResponse.json({ ok: true })
}
