import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

async function verificarMaster(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return null
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'master') return null
  return user
}

// GET /api/master/entidades — lista entidades com e-mail (bypassa restrição pública de coluna)
export async function GET(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseServer
    .from('entidades')
    .select('id, nome, cargo, email, ativo')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
