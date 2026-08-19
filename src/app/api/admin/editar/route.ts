import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function verificarAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization')
  if (!auth) return false
  const token = auth.replace('Bearer ', '')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return !error && !!data.user
}

export async function POST(req: NextRequest) {
  if (!(await verificarAdmin(req))) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const { id, tipo, campos } = await req.json()
  const tabela = tipo === 'ocorrencia' ? 'ocorrencias' : 'denuncias'
  const { error } = await supabaseAdmin.from(tabela).update(campos).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
