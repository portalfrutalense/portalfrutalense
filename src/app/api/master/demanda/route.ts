import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/master/demanda?offset=0&limit=50 — lista demandas paginadas, com email (bypassa RLS)
//
// BUG CORRIGIDO (B22-15, decisão confirmada com o usuário): sem limite
// nenhum, essa lista (com joins de categoria/entidade/vínculos) crescia sem
// teto — além do limite de 1.000 linhas do PostgREST (que fazia demandas
// antigas sumirem em silêncio da tela do master), carregar tudo de uma vez
// no navegador ficaria cada vez mais pesado conforme o sistema crescesse.
// Agora pagina de verdade: `offset`/`limit` na query, resposta traz
// `hasMore` pro front saber se ainda tem mais pra pedir com "Carregar mais".
export async function GET(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)
  const limite = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))

  // BUG CORRIGIDO: `select('*', ...)` trazia TODAS as colunas de `demandas`
  // pro navegador do master, incluindo `magic_token`/`magic_token_expira_em`
  // (coluna legada) — nunca lidos por nenhuma linha de `master/page.tsx`
  // (confirmado por busca). Uma sessão de master comprometida entregava,
  // de brinde, os tokens que permitem responder no lugar de qualquer
  // autoridade. Lista explícita agora, com só o que a tela realmente usa.
  const { data, error } = await supabaseServer
    .from('demandas')
    .select('id, user_id, morador_nome, morador_cpf, categoria_id, entidade_id, descricao, lat, lng, endereco_label, foto_url, status, ia_decisao, ia_motivo, resposta, respondido_em, link_enviado, oculto, created_at, protocolo, email_resend_id, email_status, categoria:categorias_mapa(*), entidade:entidades(*), vinculos:demanda_entidades(id, status, resposta, respondida_em, resposta_ip, email_status, email_resend_id, entidade:entidades(nome, cargo))')
    .order('created_at', { ascending: false })
    .range(offset, offset + limite - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((data || []).map((d: { user_id: string | null }) => d.user_id).filter((id): id is string => !!id))]
  const { data: perfis } = userIds.length > 0
    ? await supabaseServer.from('perfis').select('id, email').in('id', userIds)
    : { data: [] as { id: string; email: string | null }[] }

  const emailMap: Record<string, string> = {}
  ;(perfis || []).forEach((p: { id: string; email: string | null }) => { if (p.email) emailMap[p.id] = p.email })

  return NextResponse.json({
    data: (data || []).map((d: { user_id: string }) => ({ ...d, morador_email: emailMap[d.user_id] || null })),
    hasMore: (data || []).length === limite,
  })
}

// DELETE /api/master/demanda  { demanda_id }
export async function DELETE(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const { data: demanda } = await supabaseServer.from('demandas').select('foto_url').eq('id', demanda_id).single()
  if (demanda?.foto_url) {
    try {
      const url = new URL(demanda.foto_url)
      const caminho = url.pathname.split('/demandas-fotos/')[1]
      if (caminho) await supabaseServer.storage.from('demandas-fotos').remove([caminho])
    } catch {
      // URL inválida — segue com a exclusão da demanda mesmo assim
    }
  }

  const { error } = await supabaseServer.from('demandas').delete().eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PATCH /api/master/demanda  { demanda_id, oculto?, descricao?, status? }
//
// Whitelist de campos — antes aceitava qualquer coisa no corpo e passava
// direto pro .update(), contrariando o mesmo cuidado já documentado em
// /api/master/camada. "status" só aceita os dois valores que o master de
// fato decide manualmente por aqui (as outras transições passam por
// /api/master/moderar-demanda, que já valida cada ação).
const STATUS_PERMITIDOS = ['resolvida', 'nao_resolvida']

export async function PATCH(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { demanda_id, ...campos } = await req.json()
  if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

  const atualizacao: Record<string, unknown> = {}
  if (typeof campos.descricao === 'string') atualizacao.descricao = campos.descricao
  if (typeof campos.oculto === 'boolean') atualizacao.oculto = campos.oculto
  if (typeof campos.status === 'string' && STATUS_PERMITIDOS.includes(campos.status)) atualizacao.status = campos.status
  if (Object.keys(atualizacao).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo permitido informado.' }, { status: 400 })
  }

  const { error } = await supabaseServer.from('demandas').update(atualizacao).eq('id', demanda_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
