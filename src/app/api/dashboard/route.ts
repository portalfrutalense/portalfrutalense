import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth-api'

// GET /api/dashboard — atividades do usuário logado + ranking de autoridades
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // Ranking de autoridades: todas as entidades com contagem de demandas e respostas
  const { data: entidades } = await supabaseServer
    .from('entidades')
    .select('id, nome, cargo, ativo')
    .eq('ativo', true)
    .order('nome')

  const { data: vinculos } = await supabaseServer
    .from('demanda_entidades')
    .select('entidade_id, status')

  const ranking = (entidades || []).map(ent => {
    const deles = (vinculos || []).filter(v => v.entidade_id === ent.id)
    const respondidas = deles.filter(v => v.status === 'respondida' || v.status === 'resolvida').length
    return {
      id: ent.id,
      nome: ent.nome,
      cargo: ent.cargo,
      total: deles.length,
      respondidas,
    }
  }).sort((a, b) => b.respondidas - a.respondidas || b.total - a.total)

  // Atividades do usuário
  const [demandas, classificados, pets] = await Promise.all([
    supabaseServer.from('demandas').select('status').eq('user_id', user.id),
    supabaseServer.from('classificados').select('id').eq('user_id', user.id),
    supabaseServer.from('pets').select('id').eq('user_id', user.id),
  ])

  const d = demandas.data || []
  const atividades = {
    demandas: d.length,
    aguardando: d.filter(x => x.status === 'pendente' || x.status === 'aguardando_resposta').length,
    respondidas: d.filter(x => x.status === 'respondida').length,
    resolvidas: d.filter(x => x.status === 'resolvida').length,
    classificados: (classificados.data || []).length,
    pets: (pets.data || []).length,
  }

  return NextResponse.json({ ranking, atividades })
}
