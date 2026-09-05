import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export const revalidate = 60

/**
 * GET /api/inicio/resumo — pública, sem autenticação. Contagens rápidas
 * pro card "Resumo" da página inicial pós-login — mesmos filtros de
 * visibilidade que cada camada do mapa já usa (ver CamadaEmpregos.tsx,
 * CamadaImoveis.tsx, CamadaPets.tsx, MapaDemandas.tsx).
 */
export async function GET() {
  const [demandas, empregos, imoveis, pets] = await Promise.all([
    supabaseServer.from('demandas').select('id', { count: 'exact', head: true })
      .in('status', ['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida'])
      .eq('oculto', false),
    supabaseServer.from('empregos').select('id', { count: 'exact', head: true })
      .eq('oculto', false).eq('encerrada', false),
    supabaseServer.from('imoveis').select('id', { count: 'exact', head: true })
      .eq('oculto', false),
    supabaseServer.from('pets').select('id', { count: 'exact', head: true })
      .eq('oculto', false),
  ])

  const erro = demandas.error || empregos.error || imoveis.error || pets.error
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  return NextResponse.json({
    demandas: demandas.count || 0,
    empregos: empregos.count || 0,
    imoveis: imoveis.count || 0,
    pets: pets.count || 0,
  })
}
