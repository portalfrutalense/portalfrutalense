import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/master/stats — contagens reais ignorando RLS
export async function GET(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const [demandas, pets, classificados, empregos] = await Promise.all([
    supabaseServer.from('demandas').select('status, oculto'),
    supabaseServer.from('pets').select('tipo, reencontrado, oculto, ia_decisao'),
    supabaseServer.from('classificados').select('tipo_veiculo, vendido, oculto, ia_decisao'),
    supabaseServer.from('empregos').select('encerrada, oculto'),
  ])

  const d = demandas.data || []
  const p = pets.data || []
  const c = classificados.data || []
  const e = empregos.data || []

  // BUG CORRIGIDO: mesma causa raiz de MasterMapaCamadas.tsx — o gatilho de
  // banco grava `ia_decisao = NULL` quando o insert não vem do service_role,
  // mas o caminho normal (POST /api/camadas, que roda como service_role)
  // grava a STRING 'pendente'. `!x.ia_decisao` só reconhecia o primeiro
  // caso, então os cartões "Pendente IA" do dashboard sempre mostravam 0,
  // mesmo com registros de verdade esperando análise.
  const estaPendenteDeIA = (iaDecisao: string | null | undefined) => !iaDecisao || iaDecisao === 'pendente'

  // BUG CORRIGIDO (R2-5): não existia nenhum contador de "rejeitadas pela
  // IA" — com a IA falhando fechado (rejeita quando o parse falha) e o
  // histórico de injeção de prompt já corrigido (Erro #6), o master não
  // tinha nenhuma visibilidade de quantas demandas/pets/classificados
  // estavam sendo rejeitados automaticamente, sem revisão humana nenhuma.
  return NextResponse.json({
    demandas: {
      total:         d.length,
      pendente:      d.filter(x => x.status === 'pendente').length,
      aguardando:    d.filter(x => x.status === 'aguardando_resposta').length,
      respondida:    d.filter(x => x.status === 'respondida').length,
      resolvida:     d.filter(x => x.status === 'resolvida').length,
      nao_resolvida: d.filter(x => x.status === 'nao_resolvida').length,
      denunciada:    d.filter(x => x.status === 'denunciada').length,
      rejeitada_ia:  d.filter(x => x.status === 'rejeitada_ia').length,
      ocultos:       d.filter(x => x.oculto).length,
    },
    pets: {
      total:        p.length,
      perdidos:     p.filter(x => x.tipo === 'perdido' && !x.reencontrado).length,
      achados:      p.filter(x => x.tipo === 'achado').length,
      adocao:       p.filter(x => x.tipo === 'adocao').length,
      reencontrados:p.filter(x => x.reencontrado).length,
      ocultos:      p.filter(x => x.oculto).length,
      pendente_ia:  p.filter(x => estaPendenteDeIA(x.ia_decisao)).length,
      rejeitada_ia: p.filter(x => x.ia_decisao === 'rejeitada').length,
    },
    classificados: {
      total:       c.length,
      ativos:      c.filter(x => !x.vendido && !x.oculto).length,
      vendidos:    c.filter(x => x.vendido).length,
      ocultos:     c.filter(x => x.oculto).length,
      pendente_ia: c.filter(x => estaPendenteDeIA(x.ia_decisao)).length,
      rejeitada_ia: c.filter(x => x.ia_decisao === 'rejeitada').length,
    },
    empregos: {
      total:      e.length,
      ativas:     e.filter(x => !x.encerrada && !x.oculto).length,
      encerradas: e.filter(x => x.encerrada).length,
      ocultas:    e.filter(x => x.oculto).length,
    },
  })
}
