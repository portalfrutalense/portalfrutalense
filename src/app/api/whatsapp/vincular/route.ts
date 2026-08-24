import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

async function verificarUsuario(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// POST /api/whatsapp/vincular  { telefone }
export async function POST(req: NextRequest) {
  const user = await verificarUsuario(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { telefone } = await req.json()
  if (!telefone) return NextResponse.json({ error: 'Telefone obrigatório.' }, { status: 400 })

  // Confirma que esse número já não está vinculado a outra conta
  const { data: existente } = await supabaseServer.from('perfis').select('id').eq('whatsapp', telefone).maybeSingle()
  if (existente && existente.id !== user.id) {
    return NextResponse.json({ error: 'Esse número já está vinculado a outra conta.' }, { status: 409 })
  }

  const { error } = await supabaseServer.from('perfis').update({ whatsapp: telefone }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Liga a conversa já existente (se houver) a essa conta
  await supabaseServer.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', telefone)

  return NextResponse.json({ ok: true })
}
