import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verificarAdmin(req: NextRequest): boolean {
  const senha = req.headers.get('x-admin-password')
  return senha === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!verificarAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { id, tipo } = await req.json()
    const tabela = tipo === 'ocorrencia' ? 'ocorrencias' : 'denuncias'

    const { error } = await supabaseAdmin
      .from(tabela)
      .update({ status: 'rejeitada' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Erro ao rejeitar.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
