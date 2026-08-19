import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: valida o token e retorna dados da denúncia
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token ausente.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('denuncias')
    .select('id, mensagem, morador_nome, entidade:entidades(nome, cargo), status, magic_token_expira_em')
    .eq('magic_token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Token inválido ou não encontrado.' }, { status: 404 })
  }

  if (data.status === 'respondida' || data.status === 'aguardando_aprovacao_resposta') {
    return NextResponse.json({ error: 'Esta denúncia já foi respondida.' }, { status: 409 })
  }

  if (data.magic_token_expira_em && new Date(data.magic_token_expira_em) < new Date()) {
    return NextResponse.json({ error: 'Este link expirou.' }, { status: 410 })
  }

  return NextResponse.json(data)
}

// POST: salva a resposta da autoridade
export async function POST(req: NextRequest) {
  try {
    const { token, resposta } = await req.json()

    if (!token || !resposta || resposta.trim().length < 10) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    // Valida token e data de expiração
    const { data, error } = await supabaseAdmin
      .from('denuncias')
      .select('id, status, magic_token_expira_em')
      .eq('magic_token', token)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Token inválido.' }, { status: 404 })
    if (data.status === 'respondida' || data.status === 'aguardando_aprovacao_resposta') return NextResponse.json({ error: 'Já respondida.' }, { status: 409 })
    if (data.magic_token_expira_em && new Date(data.magic_token_expira_em) < new Date()) {
      return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })
    }

    // Salva resposta — fica aguardando aprovação do admin
    const { error: updateError } = await supabaseAdmin
      .from('denuncias')
      .update({
        resposta: resposta.trim(),
        status: 'aguardando_aprovacao_resposta',
        respondido_em: new Date().toISOString(),
        magic_token: null,
        magic_token_expira_em: null,
      })
      .eq('id', data.id)

    if (updateError) return NextResponse.json({ error: 'Erro ao salvar resposta.' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
