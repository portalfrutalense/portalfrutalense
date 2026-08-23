import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET: valida o token e retorna dados da demanda
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token ausente.' }, { status: 400 })

  // Tenta primeiro na tabela nova (demanda_entidades)
  const { data: vinculo } = await supabaseServer
    .from('demanda_entidades')
    .select('id, status, magic_token_expira_em, entidade:entidades(nome, cargo), demanda:demandas(id, descricao, morador_nome)')
    .eq('magic_token', token)
    .single()

  if (vinculo) {
    if (vinculo.status === 'respondida') {
      return NextResponse.json({ error: 'Esta demanda já foi respondida por você.' }, { status: 409 })
    }
    if (vinculo.magic_token_expira_em && new Date(vinculo.magic_token_expira_em) < new Date()) {
      return NextResponse.json({ error: 'Este link expirou.' }, { status: 410 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const demanda = vinculo.demanda as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entidade = vinculo.entidade as any
    return NextResponse.json({
      id: demanda?.id,
      mensagem: demanda?.descricao,
      morador_nome: demanda?.morador_nome,
      entidade,
      _vinculo_id: vinculo.id, // usado no POST
    })
  }

  // Fallback: tabela legada (demandas com magic_token direto)
  const { data, error } = await supabaseServer
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ ...data, mensagem: (data as any).descricao, _legado: true })
}

// POST: salva a resposta da autoridade
export async function POST(req: NextRequest) {
  try {
    const { token, resposta } = await req.json()

    if (!token || !resposta || resposta.trim().length < 10) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'desconhecido'

    // Tenta tabela nova primeiro
    const { data: vinculo } = await supabaseServer
      .from('demanda_entidades')
      .select('id, status, magic_token_expira_em, demanda_id')
      .eq('magic_token', token)
      .single()

    if (vinculo) {
      if (vinculo.status === 'respondida') {
        return NextResponse.json({ error: 'Já respondida.' }, { status: 409 })
      }
      if (vinculo.magic_token_expira_em && new Date(vinculo.magic_token_expira_em) < new Date()) {
        return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })
      }

      // Salva resposta no vínculo
      const { error: updateVinculo } = await supabaseServer
        .from('demanda_entidades')
        .update({
          resposta: resposta.trim(),
          status: 'respondida',
          respondida_em: new Date().toISOString(),
          resposta_ip: ip,
          magic_token: null,
          magic_token_expira_em: null,
        })
        .eq('id', vinculo.id)

      if (updateVinculo) return NextResponse.json({ error: 'Erro ao salvar resposta.' }, { status: 500 })

      // Atualiza status da demanda para "respondida" se ainda não estiver
      await supabaseServer
        .from('demandas')
        .update({ status: 'respondida' })
        .eq('id', vinculo.demanda_id)
        .neq('status', 'resolvida')

      return NextResponse.json({ ok: true })
    }

    // Fallback legado
    const { data, error } = await supabaseServer
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

    const { error: updateError } = await supabaseServer
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
