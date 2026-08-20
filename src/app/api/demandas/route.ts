import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

// Verifica se o usuário está autenticado
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

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json()
    const { descricao, lat, lng, categoria_id, entidade_id, foto_url, endereco_label } = body

    if (!descricao || !lat || !lng || !categoria_id || !entidade_id) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    // Busca perfil do usuário
    const { data: perfil } = await supabaseAdmin.from('perfis').select('nome, cpf').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 400 })

    // Insere a demanda
    const { data: demanda, error } = await supabaseAdmin.from('demandas').insert({
      user_id: user.id,
      morador_nome: perfil.nome,
      morador_cpf: perfil.cpf,
      descricao: descricao.trim(),
      lat,
      lng,
      categoria_id,
      entidade_id,
      foto_url: foto_url || null,
      endereco_label: endereco_label || null,
      status: 'pendente',
    }).select().single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    // Dispara análise da IA em background (não bloqueia a resposta)
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ia/analisar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.ADMIN_PASSWORD! },
      body: JSON.stringify({ demanda_id: demanda.id }),
    }).catch(console.error)

    return NextResponse.json({ ok: true, id: demanda.id }, { status: 201 })
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

  // Busca demandas do usuário
  const { data } = await supabaseAdmin
    .from('demandas')
    .select('*, categoria:categorias_mapa(*), entidade:entidades(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}
