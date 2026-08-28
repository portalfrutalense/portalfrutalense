import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

async function verificarMaster(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return null
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'master') return null
  return user
}

// GET /api/master/stats — contagens reais ignorando RLS
export async function GET(req: NextRequest) {
  const user = await verificarMaster(req)
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

  return NextResponse.json({
    demandas: {
      total:         d.length,
      pendente:      d.filter(x => x.status === 'pendente').length,
      aguardando:    d.filter(x => x.status === 'aguardando_resposta').length,
      respondida:    d.filter(x => x.status === 'respondida').length,
      resolvida:     d.filter(x => x.status === 'resolvida').length,
      nao_resolvida: d.filter(x => x.status === 'nao_resolvida').length,
      denunciada:    d.filter(x => x.status === 'denunciada').length,
      ocultos:       d.filter(x => x.oculto).length,
    },
    pets: {
      total:        p.length,
      perdidos:     p.filter(x => x.tipo === 'perdido' && !x.reencontrado).length,
      achados:      p.filter(x => x.tipo === 'achado').length,
      adocao:       p.filter(x => x.tipo === 'adocao').length,
      reencontrados:p.filter(x => x.reencontrado).length,
      ocultos:      p.filter(x => x.oculto).length,
      pendente_ia:  p.filter(x => !x.ia_decisao).length,
    },
    classificados: {
      total:       c.length,
      ativos:      c.filter(x => !x.vendido && !x.oculto).length,
      vendidos:    c.filter(x => x.vendido).length,
      ocultos:     c.filter(x => x.oculto).length,
      pendente_ia: c.filter(x => !x.ia_decisao).length,
    },
    empregos: {
      total:      e.length,
      ativas:     e.filter(x => !x.encerrada && !x.oculto).length,
      encerradas: e.filter(x => x.encerrada).length,
      ocultas:    e.filter(x => x.oculto).length,
    },
  })
}
