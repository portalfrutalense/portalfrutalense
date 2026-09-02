import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { limiteExcedido } from '@/lib/auth-api'

function ipDaRequisicao(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'desconhecido'
}

// GET: valida o token e retorna dados da demanda
//
// BUG CORRIGIDO (B16-3): endpoint público, sem login, sem rate limit — o
// token de 32 bytes torna força bruta impraticável, mas nada impedia
// enumeração em massa (varrer tokens antigos, ou só bater sem parar) nem
// carga desnecessária no banco. Mesmo limitador best-effort já usado em
// /api/chat, /api/demandas etc., agora chaveado por IP (rota pública, sem
// usuário autenticado pra chavear por id).
export async function GET(req: NextRequest) {
  if (limiteExcedido(`responder-get:${ipDaRequisicao(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' }, { status: 429 })
  }

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
    const ip = ipDaRequisicao(req)
    if (limiteExcedido(`responder-post:${ip}`, 10, 10 * 60_000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' }, { status: 429 })
    }

    const { token, resposta } = await req.json()

    // BUG CORRIGIDO (B16-6): só havia mínimo (10 caracteres) — nada impedia
    // um POST de vários MB de texto em "resposta". Teto de 5.000 caracteres
    // (~1 página), bem acima de qualquer resposta legítima de autoridade.
    if (!token || !resposta || resposta.trim().length < 10 || resposta.trim().length > 5000) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

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

    // BUG CORRIGIDO (B16-4, decisão confirmada com o usuário): o token
    // antes ficava vivo pra sempre depois de respondido (só pra mostrar
    // "já foi respondida" em vez de "token inválido" se a autoridade
    // clicasse de novo no mesmo link) — divergindo de
    // /api/autoridade/responder, que já zera o token ao responder. Um link
    // vazado continuava válido (pra essa checagem) no banco pra sempre.
    // Agora os dois caminhos zeram o token do mesmo jeito; clicar de novo
    // no link por e-mail passa a mostrar "token inválido" em vez da
    // mensagem amigável.
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
