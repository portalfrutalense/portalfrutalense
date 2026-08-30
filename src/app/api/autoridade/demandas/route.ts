import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/autoridade/demandas — lista as demandas direcionadas à autoridade logada
export async function GET(req: NextRequest) {
  const user = await getUser(req)
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
  // O tipo que o cliente do Supabase infere pro relacionamento aninhado
  // modela "demanda" como array (não sabe, sem os tipos gerados do schema,
  // que é um-pra-um) — mas em runtime vem objeto único, como o código
  // sempre tratou. A interface abaixo reflete o formato real, não o
  // inferido, pra não arriscar mudar o comportamento por causa do tipo.
  interface VinculoComDemanda { demanda?: { status?: string } | null }
  const vinculos = (data || []) as unknown as VinculoComDemanda[]
  const visiveis = vinculos.filter((v) => {
    const statusDemanda = v.demanda?.status
    return statusDemanda && !['pendente', 'rejeitada_ia'].includes(statusDemanda)
  })

  return NextResponse.json(visiveis)
}
