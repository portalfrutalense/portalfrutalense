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

// GET /api/autoridade/demandas — lista as demandas direcionadas à autoridade logada
export async function GET(req: NextRequest) {
  const user = await verificarUsuario(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseServer
    .from('demanda_entidades')
    .select(`
      id, status, resposta, respondida_em,
      demanda:demandas(id, descricao, endereco_label, foto_url, morador_nome, status, created_at, categoria:categorias_mapa(nome, cor))
    `)
    .eq('entidade_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Só mostra vínculos cuja demanda já passou pela análise (não mostra pendente/rejeitada_ia)
  const visiveis = (data || []).filter((v: any) => {
    const statusDemanda = v.demanda?.status
    return statusDemanda && !['pendente', 'rejeitada_ia'].includes(statusDemanda)
  })

  return NextResponse.json(visiveis)
}
