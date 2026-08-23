import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

async function verificarUsuario(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return null
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  return user
}

// POST /api/autoridade/responder  { vinculo_id, resposta }
// Mesma lógica de POST /api/responder, mas autenticada por sessão em vez de magic_token.
// Invalida o magic_token do vínculo também — se ela responder por aqui, o link do
// e-mail correspondente passa a acusar "já respondida" pra quem clicar nele depois.
export async function POST(req: NextRequest) {
  const user = await verificarUsuario(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const { vinculo_id, resposta } = await req.json()
    if (!vinculo_id || !resposta || resposta.trim().length < 10) {
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

    await supabaseServer
      .from('demandas')
      .update({ status: 'respondida' })
      .eq('id', vinculo.demanda_id)
      .neq('status', 'resolvida')

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
