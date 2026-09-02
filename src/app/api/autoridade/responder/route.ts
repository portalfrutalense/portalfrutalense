import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/autoridade/responder  { vinculo_id, resposta }
// Mesma lógica de POST /api/responder, mas autenticada por sessão em vez de magic_token.
// Invalida o magic_token do vínculo também — se ela responder por aqui, o link do
// e-mail correspondente passa a acusar "já respondida" pra quem clicar nele depois.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const { vinculo_id, resposta } = await req.json()
    // BUG CORRIGIDO (B16-6): só havia mínimo (10 caracteres) — nada impedia
    // um POST de vários MB de texto em "resposta". Mesmo teto aplicado em
    // /api/responder (5.000 caracteres, bem acima de qualquer resposta
    // legítima de autoridade).
    if (!vinculo_id || !resposta || resposta.trim().length < 10 || resposta.trim().length > 5000) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const { data: vinculo } = await supabaseServer
      .from('demanda_entidades')
      .select('id, entidade_id, status, demanda_id')
      .eq('id', vinculo_id)
      .single()

    if (!vinculo) return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 })
    if (vinculo.entidade_id !== user.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    if (vinculo.status === 'respondida') return NextResponse.json({ error: 'Já respondida.' }, { status: 409 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'desconhecido'

    const { error: updateError } = await supabaseServer
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

    if (updateError) return NextResponse.json({ error: 'Erro ao salvar resposta.' }, { status: 500 })

    // Nunca sobrescreve "resolvida" nem "denunciada" — esta última fica em
    // moderação até o master decidir; sem essa segunda trava, responder por
    // um vínculo ainda válido tirava a demanda do limbo sozinho.
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
