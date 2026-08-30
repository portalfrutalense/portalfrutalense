import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/camadas/excluir  { camada: 'pets'|'classificados'|'empregos', id }
 *
 * Exclui um registro do próprio dono, limpando a(s) foto(s) do Storage
 * antes de apagar a linha — mesmo cuidado que MapaDemandas.tsx (excluirPet,
 * excluirClassificado, excluirEmprego) nunca teve: essas funções apagavam
 * a linha direto do client (Supabase), sem tocar no Storage, deixando as
 * fotos órfãs pra sempre. Já existia essa mesma limpeza pro caminho do
 * master (PATCH/DELETE /api/master/camada) — faltava só pro dono do
 * registro excluir a própria publicação com a mesma garantia.
 */

type Camada = 'pets' | 'classificados' | 'empregos'
const TABELAS: Record<Camada, string> = { pets: 'pets', classificados: 'classificados', empregos: 'empregos' }
const BUCKETS: Record<Camada, string> = { pets: 'pets-fotos', classificados: 'classificados-fotos', empregos: 'empregos-fotos' }

function caminhoNoBucket(fotoUrl: string, bucket: string): string | null {
  try {
    const url = new URL(fotoUrl)
    const parts = url.pathname.split(`/${bucket}/`)
    return parts[1] || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { camada, id } = await req.json()
  if (!camada || !(camada in TABELAS) || !id) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }
  const c = camada as Camada
  const bucket = BUCKETS[c]

  const campoFoto = c === 'classificados' ? 'fotos' : c === 'pets' ? 'foto_url' : 'logo_url'
  const { data: registro } = await supabaseServer.from(c).select(`id, user_id, ${campoFoto}`).eq('id', id).single()
  if (!registro) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((registro as any).user_id !== user.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })

  if (c === 'classificados') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fotos = ((registro as any).fotos || []) as string[]
    const caminhos = fotos.map((url) => caminhoNoBucket(url, bucket)).filter((p): p is string => !!p)
    if (caminhos.length > 0) await supabaseServer.storage.from(bucket).remove(caminhos).catch(() => {})
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (registro as any)[campoFoto] as string | null
    const caminho = url && caminhoNoBucket(url, bucket)
    if (caminho) await supabaseServer.storage.from(bucket).remove([caminho]).catch(() => {})
  }

  const { error } = await supabaseServer.from(TABELAS[c]).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
