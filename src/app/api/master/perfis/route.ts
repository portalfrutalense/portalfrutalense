import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

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

// GET — lista todos os perfis
export async function GET(req: NextRequest) {
  const user = await getMasterUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseServer
    .from('perfis')
    .select('*')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// Whitelist de campos — antes o corpo inteiro da requisição (menos "id" e
// "categorias") ia direto pro .update(), o que permitiria sobrescrever
// qualquer coluna de "perfis", inclusive "role" (nenhuma checagem impedia
// virar "role: 'master'" por aqui). Só os campos que o painel de fato edita.
const CAMPOS_PERFIL_PERMITIDOS = ['nome', 'cpf', 'email', 'whatsapp', 'data_nascimento', 'cargo', 'bloqueado'] as const

// PATCH — editar campos do perfil (e entidade se for autoridade)
export async function PATCH(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id, categorias, ...camposBrutos } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

  const campos: Record<string, unknown> = {}
  for (const chave of CAMPOS_PERFIL_PERMITIDOS) {
    if (chave in camposBrutos) campos[chave] = camposBrutos[chave]
  }

  // Autoridades legadas (só existem em "entidades", sem perfil/conta Auth) não têm usuário
  // no Supabase Auth para sincronizar — checa antes de tentar, senão o updateUserById falha.
  const [{ data: perfil }, { data: entidade }] = await Promise.all([
    supabaseServer.from('perfis').select('role').eq('id', id).single(),
    supabaseServer.from('entidades').select('id').eq('id', id).single(),
  ])
  const temAuth = !!perfil

  // Sincronizar email com auth se alterado (só quando existe conta Auth de fato)
  if (campos.email && temAuth) {
    const { error: authError } = await supabaseServer.auth.admin.updateUserById(id, { email: campos.email as string, email_confirm: true })
    if (authError) return NextResponse.json({ error: `Erro ao atualizar email: ${authError.message}` }, { status: 500 })
  }

  // Atualizar perfil (autoridade legada não tem linha em "perfis" — update simplesmente não afeta nada)
  if (Object.keys(campos).length > 0) {
    const { error: perfilError } = await supabaseServer.from('perfis').update(campos).eq('id', id)
    if (perfilError) return NextResponse.json({ error: perfilError.message }, { status: 500 })
  }

  // Se for autoridade (novo fluxo com perfil, ou legada só em "entidades"), sincronizar entidade também
  const ehAutoridade = perfil?.role === 'autoridade' || !!entidade
  if (ehAutoridade) {
    const camposEnt: Record<string, unknown> = {}
    if (campos.nome) camposEnt.nome = campos.nome
    if (campos.cargo) camposEnt.cargo = campos.cargo
    if (campos.email) camposEnt.email = campos.email
    if (Object.keys(camposEnt).length > 0) {
      await supabaseServer.from('entidades').update(camposEnt).eq('id', id)
    }

    // Atualizar categorias se fornecidas
    if (Array.isArray(categorias)) {
      await supabaseServer.from('categoria_entidades').delete().eq('entidade_id', id)
      if (categorias.length > 0) {
        const rows = categorias.map((catId: string) => ({ categoria_id: catId, entidade_id: id }))
        const { error: catError } = await supabaseServer.from('categoria_entidades').insert(rows)
        if (catError) console.error('[master/perfis] falha ao salvar categorias:', catError)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE — excluir perfil + entidade (se autoridade) + fotos + demandas + auth
export async function DELETE(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  if (id === master.id) return NextResponse.json({ error: 'Não é possível excluir a própria conta pelo painel.' }, { status: 400 })

  // Buscar perfil e entidade para saber o que existe
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', id).single()
  const { data: entidade } = await supabaseServer.from('entidades').select('id').eq('id', id).single()

  const ehAutoridade = perfil?.role === 'autoridade' || !!entidade
  const temPerfil = !!perfil

  // Remover categorias e entidade se for autoridade (novo ou legado)
  if (ehAutoridade) {
    await supabaseServer.from('categoria_entidades').delete().eq('entidade_id', id)
    await supabaseServer.from('entidades').delete().eq('id', id)
  }

  // Se não tem perfil (autoridade legada), encerra aqui
  if (!temPerfil) return NextResponse.json({ ok: true })

  // Levanta as fotos de tudo que o usuário publicou ANTES de apagar
  // qualquer linha — pets/classificados/empregos são apagados em cascata
  // quando a conta do Auth é removida (ON DELETE CASCADE), então depois
  // disso não teríamos mais como saber quais arquivos eram delas.
  // Mesma limpeza já feita em /api/cidadao/excluir-conta (Bloco 1); faltava
  // aqui, no caminho em que é o master quem exclui a conta de outra pessoa
  // — inclusive demandas, que este caminho nunca chegou a tocar (ver abaixo).
  const [{ data: demandas }, { data: pets }, { data: classificados }, { data: empregos }] = await Promise.all([
    supabaseServer.from('demandas').select('foto_url').eq('user_id', id),
    supabaseServer.from('pets').select('foto_url').eq('user_id', id),
    supabaseServer.from('classificados').select('fotos').eq('user_id', id),
    supabaseServer.from('empregos').select('logo_url').eq('user_id', id),
  ])
  const caminhosDemandas = (demandas || [])
    .map(d => d.foto_url && caminhoNoBucket(d.foto_url, 'demandas-fotos'))
    .filter((p): p is string => !!p)
  const caminhosPets = (pets || [])
    .map(p => p.foto_url && caminhoNoBucket(p.foto_url, 'pets-fotos'))
    .filter((p): p is string => !!p)
  const caminhosClassificados = (classificados || [])
    .flatMap(c => c.fotos || [])
    .map(url => caminhoNoBucket(url, 'classificados-fotos'))
    .filter((p): p is string => !!p)
  const caminhosEmpregos = (empregos || [])
    .map(e => e.logo_url && caminhoNoBucket(e.logo_url, 'empregos-fotos'))
    .filter((p): p is string => !!p)
  await Promise.all([
    caminhosDemandas.length > 0 ? supabaseServer.storage.from('demandas-fotos').remove(caminhosDemandas) : null,
    caminhosPets.length > 0 ? supabaseServer.storage.from('pets-fotos').remove(caminhosPets) : null,
    caminhosClassificados.length > 0 ? supabaseServer.storage.from('classificados-fotos').remove(caminhosClassificados) : null,
    caminhosEmpregos.length > 0 ? supabaseServer.storage.from('empregos-fotos').remove(caminhosEmpregos) : null,
  ].filter(Boolean)).catch(e => console.error('[master/perfis] falha ao limpar fotos do storage:', e))

  // demandas.user_id é ON DELETE SET NULL (não cascade) — diferente de
  // pets/classificados/empregos, a demanda NÃO some sozinha quando a conta
  // do Auth é apagada, só perde o vínculo com ela. Sem apagar aqui, a
  // demanda ficava no banco pra sempre com nome e CPF do cidadão presos
  // nela, sem dono, sem ninguém mais poder pedir pra apagar depois — exatamente
  // o mesmo problema que /api/cidadao/excluir-conta já trata (Bloco 1),
  // nunca replicado neste caminho, em que é o master quem exclui a conta.
  const { error: erroDemandas } = await supabaseServer.from('demandas').delete().eq('user_id', id)
  if (erroDemandas) {
    console.error('[master/perfis] falha ao apagar demandas, abortando antes de tocar na conta:', erroDemandas)
    return NextResponse.json({ error: 'Não foi possível concluir a exclusão. Tente novamente.' }, { status: 500 })
  }

  // perfis.id tem ON DELETE CASCADE pra auth.users — apagar a conta do Auth
  // já apaga o perfil na mesma operação (chegou até aqui só quando temPerfil
  // é true, e temAuth === temPerfil). Um delete manual de "perfis" ANTES
  // desta chamada existia aqui, sem checar erro nenhum, e deixava a conta do
  // Auth órfã (sem perfil) se a chamada seguinte falhasse — só dava pra
  // limpar depois manual no painel do Supabase.
  const { error } = await supabaseServer.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
