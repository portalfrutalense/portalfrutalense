import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-api'
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

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // 1. Levantar as fotos de tudo que o usuário publicou, ANTES de apagar
  // qualquer linha — pets/classificados/empregos são apagados em cascata
  // quando a conta do Auth é removida (ON DELETE CASCADE), então depois
  // disso não teríamos mais como saber quais arquivos eram deles.
  const [{ data: demandas }, { data: pets }, { data: classificados }] = await Promise.all([
    supabaseServer.from('demandas').select('foto_url').eq('user_id', user.id),
    supabaseServer.from('pets').select('foto_url').eq('user_id', user.id),
    supabaseServer.from('classificados').select('fotos').eq('user_id', user.id),
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

  // 2. Apagar as fotos do Storage — best-effort: uma falha aqui deixa
  // arquivo órfão (ruim, mas recuperável limpando depois), não deve travar
  // a exclusão da conta em si, que é o que a LGPD realmente exige.
  await Promise.all([
    caminhosDemandas.length > 0 ? supabaseServer.storage.from('demandas-fotos').remove(caminhosDemandas) : null,
    caminhosPets.length > 0 ? supabaseServer.storage.from('pets-fotos').remove(caminhosPets) : null,
    caminhosClassificados.length > 0 ? supabaseServer.storage.from('classificados-fotos').remove(caminhosClassificados) : null,
  ].filter(Boolean)).catch(e => console.error('[excluir-conta] falha ao limpar fotos do storage:', e))

  // 3. Apagar demandas — esta tabela usa ON DELETE SET NULL (não cascade),
  // então precisa ser feito manualmente. Diferente da versão anterior deste
  // arquivo, o erro AQUI é checado e interrompe a exclusão: se isso falhar
  // e a conta do Auth for apagada mesmo assim, a demanda sobra no banco com
  // nome e CPF do cidadão anexados a um user_id nulo — dado pessoal órfão
  // que ninguém mais consegue pedir pra apagar, por não ter mais conta.
  const { error: erroDemandas } = await supabaseServer.from('demandas').delete().eq('user_id', user.id)
  if (erroDemandas) {
    console.error('[excluir-conta] falha ao apagar demandas, abortando antes de tocar na conta:', erroDemandas)
    return NextResponse.json({ error: 'Não foi possível concluir a exclusão. Tente novamente.' }, { status: 500 })
  }

  // 4. Apagar perfil — redundante com o ON DELETE CASCADE de perfis.id, mas
  // mantido explícito por segurança; erro aqui também aborta.
  const { error: erroPerfil } = await supabaseServer.from('perfis').delete().eq('id', user.id)
  if (erroPerfil) {
    console.error('[excluir-conta] falha ao apagar perfil, abortando antes de tocar na conta:', erroPerfil)
    return NextResponse.json({ error: 'Não foi possível concluir a exclusão. Tente novamente.' }, { status: 500 })
  }

  // 5. Por último, a conta do Auth — pets/classificados/empregos do usuário
  // são apagados em cascata neste passo.
  const { error } = await supabaseServer.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
