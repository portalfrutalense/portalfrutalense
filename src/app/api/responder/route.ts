import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: valida o token e retorna dados da demanda
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token ausente.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('demandas')
    .select('id, descricao, morador_nome, entidade:entidades(nome, cargo), status, magic_token_expira_em')
    .eq('magic_token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Token inválido ou não encontrado.' }, { status: 404 })
  }

  if (data.status === 'respondida' || data.status === 'resolvida') {
    return NextResponse.json({ error: 'Esta demanda já foi respondida.' }, { status: 409 })
  }

  if (data.magic_token_expira_em && new Date(data.magic_token_expira_em) < new Date()) {
    return NextResponse.json({ error: 'Este link expirou.' }, { status: 410 })
  }

  // Mapeia para o campo que o front-end usa (mensagem → descricao)
  return NextResponse.json({ ...data, mensagem: (data as any).descricao })
}

// POST: salva a resposta da autoridade
export async function POST(req: NextRequest) {
  try {
    const { token, resposta } = await req.json()

    if (!token || !resposta || resposta.trim().length < 10) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('demandas')
      .select('id, status, magic_token_expira_em')
      .eq('magic_token', token)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Token inválido.' }, { status: 404 })
    if (data.status === 'respondida' || data.status === 'resolvida') {
      return NextResponse.json({ error: 'Já respondida.' }, { status: 409 })
    }
    if (data.magic_token_expira_em && new Date(data.magic_token_expira_em) < new Date()) {
      return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'desconhecido'

    const { error: updateError } = await supabaseAdmin
      .from('demandas')
      .update({
        resposta: resposta.trim(),
        status: 'respondida',
        respondido_em: new Date().toISOString(),
        resposta_ip: ip,
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
