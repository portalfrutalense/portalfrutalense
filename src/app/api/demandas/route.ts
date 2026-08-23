import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

async function getUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

async function verificarTurnstile(token: string | undefined, ip: string | null) {
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    })
    const data = await res.json()
    return !!data.success
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json()
    const { descricao, lat, lng, categoria_id, entidade_ids, foto_url, endereco_label, turnstile_token } = body

    if (!descricao || !lat || !lng || !categoria_id || !entidade_ids?.length) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (!Array.isArray(entidade_ids) || entidade_ids.length > 3) {
      return NextResponse.json({ error: 'Máximo de 3 autoridades.' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const turnstileOk = await verificarTurnstile(turnstile_token, ip)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, { status: 400 })
    }

    const { data: perfil } = await supabaseServer.from('perfis').select('nome, cpf, email').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 400 })

    // Garante que o email do Auth fica salvo no perfil
    if (!perfil.email && user.email) {
      await supabaseServer.from('perfis').update({ email: user.email }).eq('id', user.id)
    }

    const { data: demanda, error } = await supabaseServer.from('demandas').insert({
      user_id: user.id,
      morador_nome: perfil.nome,
      morador_cpf: perfil.cpf,
      descricao: descricao.trim(),
      lat,
      lng,
      categoria_id,
      entidade_id: entidade_ids[0], // mantém coluna legada com a primeira autoridade
      foto_url: foto_url || null,
      endereco_label: endereco_label || null,
      status: 'pendente',
    }).select().single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    // Insere vínculos com todas as autoridades selecionadas
    const vinculos = entidade_ids.map((eid: string) => ({
      demanda_id: demanda.id,
      entidade_id: eid,
      status: 'aguardando_resposta',
    }))
    const { error: vinculoError } = await supabaseServer.from('demanda_entidades').insert(vinculos)
    if (vinculoError) {
      console.error('Erro ao inserir demanda_entidades:', vinculoError)
      // Não bloqueia — demanda já foi criada
    }

    const resposta = NextResponse.json({ ok: true, id: demanda.id }, { status: 201 })

    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ia/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET! },
        body: JSON.stringify({ demanda_id: demanda.id }),
      })
    } catch (e) {
      console.error('Erro ao chamar IA:', e)
    }

    return resposta
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data } = await supabaseServer
    .from('demandas')
    .select('*, categoria:categorias_mapa(*), entidade:entidades(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}
