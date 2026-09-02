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
  // BUG CORRIGIDO (B15-3): a limpeza cobria demandas/pets/classificados,
  // mas não `empregos.logo_url` — o bucket `empregos-fotos` existe e já é
  // tratado em /api/camadas/excluir e /api/master/perfis, só não tinha
  // sido replicado aqui. Uma vaga publicada e excluída em cascata pela
  // conta deixava a logo órfã no Storage pra sempre.
  const [{ data: demandas }, { data: pets }, { data: classificados }, { data: empregos }] = await Promise.all([
    supabaseServer.from('demandas').select('foto_url').eq('user_id', user.id),
    supabaseServer.from('pets').select('foto_url').eq('user_id', user.id),
    supabaseServer.from('classificados').select('fotos').eq('user_id', user.id),
    supabaseServer.from('empregos').select('logo_url').eq('user_id', user.id),
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

  // 2. Apagar as fotos do Storage — best-effort: uma falha aqui deixa
  // arquivo órfão (ruim, mas recuperável limpando depois), não deve travar
  // a exclusão da conta em si, que é o que a LGPD realmente exige.
  await Promise.all([
    caminhosDemandas.length > 0 ? supabaseServer.storage.from('demandas-fotos').remove(caminhosDemandas) : null,
    caminhosPets.length > 0 ? supabaseServer.storage.from('pets-fotos').remove(caminhosPets) : null,
    caminhosClassificados.length > 0 ? supabaseServer.storage.from('classificados-fotos').remove(caminhosClassificados) : null,
    caminhosEmpregos.length > 0 ? supabaseServer.storage.from('empregos-fotos').remove(caminhosEmpregos) : null,
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

  // BUG CORRIGIDO (B15-4, decisão confirmada com o usuário): whatsapp_conversas
  // (telefone + histórico de mensagens) e chatbot_sem_resposta (perguntas
  // enviadas ao bot) usam ON DELETE SET NULL — sem apagar aqui, o dado
  // pessoal sobrevivia à exclusão da conta com o user_id só virando nulo.
  // Best-effort (não deve travar a exclusão da conta em si, que é o que a
  // LGPD realmente exige).
  await Promise.all([
    supabaseServer.from('whatsapp_conversas').delete().eq('user_id', user.id),
    supabaseServer.from('chatbot_sem_resposta').delete().eq('user_id', user.id),
  ]).catch(e => console.error('[excluir-conta] falha ao apagar histórico de whatsapp/chatbot:', e))

  // 4. Por último, a conta do Auth — perfis.id tem ON DELETE CASCADE pra
  // auth.users, então apagar a conta do Auth já apaga o perfil (e
  // pets/classificados/empregos do usuário) na mesma operação. Um passo
  // manual "apagar perfil" ANTES deste existia aqui, mas deixava a conta
  // do Auth órfã (sem perfil) se essa chamada seguinte falhasse — a conta
  // ficava presa num estado inconsistente que só dava pra limpar manual
  // no painel do Supabase. Com um único passo, ou os dois somem juntos
  // (sucesso), ou nenhum some (falha) — nunca um estado parcial.
  const { error } = await supabaseServer.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
