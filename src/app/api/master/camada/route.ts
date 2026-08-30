import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * PATCH /api/master/camada  { camada: 'pets'|'classificados'|'empregos', id, campos }
 *
 * Existe para tirar do navegador a moderação de pets/classificados/empregos
 * (toggle de oculto/encerrada), que antes ia direto do cliente contra o
 * Supabase — e por isso exigia que a policy de RLS liberasse o autor a
 * escrever nessas mesmas colunas, o que ele nunca deveria poder fazer
 * sozinho (ver auditoria de segurança, achado "pets/classificados/empregos
 * podem se auto-aprovar"). Com a moderação passando por aqui (service_role,
 * verificado como master), a restrição de coluna no banco pode proibir o
 * autor comum de mexer em oculto/ia_decisao/ia_motivo sem quebrar o painel.
 */

type Camada = 'pets' | 'classificados' | 'empregos'
const TABELAS: Record<Camada, string> = { pets: 'pets', classificados: 'classificados', empregos: 'empregos' }
const BUCKETS: Record<Camada, string> = { pets: 'pets-fotos', classificados: 'classificados-fotos', empregos: 'empregos-fotos' }

/** Só o que a moderação do master de fato precisa mexer — nada de conteúdo aqui. */
const CAMPOS_PERMITIDOS: Record<Camada, string[]> = {
  pets: ['oculto'],
  classificados: ['oculto'],
  empregos: ['oculto', 'encerrada'],
}

/** Extrai o caminho do arquivo dentro do bucket a partir da URL pública completa. */
function caminhoNoBucket(fotoUrl: string, bucket: string): string | null {
  try {
    const url = new URL(fotoUrl)
    const parts = url.pathname.split(`/${bucket}/`)
    return parts[1] || null
  } catch {
    return null
  }
}

export async function PATCH(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { camada, id, campos } = await req.json()
  if (!camada || !(camada in TABELAS) || !id || !campos || typeof campos !== 'object') {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  const permitidos = CAMPOS_PERMITIDOS[camada as Camada]
  const atualizacao: Record<string, unknown> = {}
  for (const chave of Object.keys(campos)) {
    if (permitidos.includes(chave)) atualizacao[chave] = campos[chave]
  }
  if (Object.keys(atualizacao).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo permitido informado.' }, { status: 400 })
  }

  const { error } = await supabaseServer.from(TABELAS[camada as Camada]).update(atualizacao).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/master/camada  { camada: 'pets'|'classificados'|'empregos', id }
 *
 * Antes o botão "Excluir" do painel apagava a linha direto do navegador
 * (client.from(camada).delete()), contornando o mesmo cuidado documentado
 * acima para oculto/encerrada, e sem limpar as fotos no Storage — ficavam
 * órfãs pra sempre. Passa a ir por aqui, igual ao PATCH.
 */
export async function DELETE(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { camada, id } = await req.json()
  if (!camada || !(camada in TABELAS) || !id) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }
  const c = camada as Camada
  const bucket = BUCKETS[c]

  if (c === 'classificados') {
    const { data } = await supabaseServer.from('classificados').select('fotos').eq('id', id).single()
    const caminhos = (data?.fotos || []).map((url: string) => caminhoNoBucket(url, bucket)).filter((p: string | null): p is string => !!p)
    if (caminhos.length > 0) await supabaseServer.storage.from(bucket).remove(caminhos).catch(() => {})
  } else {
    const campoFoto = c === 'pets' ? 'foto_url' : 'logo_url'
    const { data } = await supabaseServer.from(c).select(campoFoto).eq('id', id).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (data as any)?.[campoFoto]
    const caminho = url && caminhoNoBucket(url, bucket)
    if (caminho) await supabaseServer.storage.from(bucket).remove([caminho]).catch(() => {})
  }

  const { error } = await supabaseServer.from(TABELAS[c]).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
