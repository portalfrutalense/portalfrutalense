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
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  try {
    const { id, tipo } = await req.json()
    const tabela = tipo === 'ocorrencia' ? 'ocorrencias' : 'denuncias'
    const { error } = await supabaseAdmin.from(tabela).update({ status: 'rejeitada' }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Erro ao rejeitar.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
