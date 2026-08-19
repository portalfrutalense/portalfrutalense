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

  try {
    const { id, acao } = await req.json()
    // acao: 'publicar' | 'recusar'

    if (acao === 'publicar') {
      const { error } = await supabaseAdmin
        .from('denuncias')
        .update({ status: 'respondida' })
        .eq('id', id)
      if (error) return NextResponse.json({ error: 'Erro ao publicar resposta.' }, { status: 500 })
    } else if (acao === 'recusar') {
      // Volta para aguardando_resposta, limpa a resposta
      const { error } = await supabaseAdmin
        .from('denuncias')
        .update({ status: 'aguardando_resposta', resposta: null, respondido_em: null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: 'Erro ao recusar resposta.' }, { status: 500 })
    } else {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
