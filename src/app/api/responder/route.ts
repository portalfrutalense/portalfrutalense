import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET: valida o token e retorna dados da demanda
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token ausente.' }, { status: 400 })

  const { data: vinculo, error } = await supabaseServer
    .from('demanda_entidades')
    .select('id, status, magic_token_expira_em, entidade:entidades(nome, cargo), demanda:demandas(id, descricao, morador_nome, endereco_label, foto_url)')
    .eq('magic_token', token)
    .single()

  if (error || !vinculo) {
    return NextResponse.json({ error: 'Token inválido ou não encontrado.' }, { status: 404 })
  }

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
    endereco_label: demanda?.endereco_label,
    foto_url: demanda?.foto_url,
    entidade,
  })
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

    const { data: vinculo, error: buscaError } = await supabaseServer
      .from('demanda_entidades')
      .select('id, status, magic_token_expira_em, demanda_id')
      .eq('magic_token', token)
      .single()

    if (buscaError || !vinculo) return NextResponse.json({ error: 'Token inválido.' }, { status: 404 })
    if (vinculo.status === 'respondida') {
      return NextResponse.json({ error: 'Já respondida.' }, { status: 409 })
    }
    if (vinculo.magic_token_expira_em && new Date(vinculo.magic_token_expira_em) < new Date()) {
      return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })
    }

    // Salva resposta no vínculo (mantém token para exibir mensagem correta se acessar novamente)
    const { error: updateVinculo } = await supabaseServer
      .from('demanda_entidades')
      .update({
        resposta: resposta.trim(),
        status: 'respondida',
        respondida_em: new Date().toISOString(),
        resposta_ip: ip,
      })
      .eq('id', vinculo.id)

    if (updateVinculo) return NextResponse.json({ error: 'Erro ao salvar resposta.' }, { status: 500 })

    // Atualiza status da demanda para "respondida" se ainda não estiver —
    // nunca sobrescreve "resolvida" nem "denunciada" (esta última fica em
    // moderação até o master decidir; sem essa segunda trava, responder
    // por um vínculo ainda válido tirava a demanda do limbo sozinho)
    await supabaseServer
      .from('demandas')
      .update({ status: 'respondida' })
      .eq('id', vinculo.demanda_id)
      .neq('status', 'resolvida')
      .neq('status', 'denunciada')

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
