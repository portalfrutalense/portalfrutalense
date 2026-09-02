import type { createClient } from '@/lib/supabase-browser'

/**
 * Criação passa pela API para o token do Turnstile ser conferido no
 * servidor.
 *
 * Edição de EMPREGOS vai direto pelo cliente, sob o RLS do autor — vagas
 * nunca passaram por moderação de IA (decisão de produto).
 *
 * Edição de PETS e CLASSIFICADOS também passa pela API (PATCH), desde a
 * correção do erro "editar contorna a moderação": antes ia direto pelo
 * cliente, e um registro já aprovado continuava aprovado e visível no mapa
 * mesmo depois do conteúdo trocado, porque o RLS nunca deixaria o próprio
 * autor mudar `ia_decisao` por esse caminho — ou seja, não tinha como
 * reenviar pra análise por ali. Agora a edição força o registro de volta
 * pra 'pendente' e reanalisa, igual à criação — o item some do mapa até a
 * IA aprovar de novo.
 *
 * `dados` é `Record<string, unknown>`, não um tipo específico de Pet/
 * Classificado/Emprego — essa função atende as três camadas ao mesmo
 * tempo, e cada uma tem um formato de campos diferente. `unknown` ainda
 * assim é mais seguro que `any`: quem for LER um valor daqui é obrigado
 * a garantir o tipo primeiro, em vez de herdar `any` silenciosamente.
 */
export async function salvarCamada({
  camada, editando, dados, turnstileToken, supabase,
}: {
  camada: 'pets' | 'classificados' | 'empregos' | 'imoveis'
  editando: { id: string } | null
  dados: Record<string, unknown>
  turnstileToken: string
  supabase: ReturnType<typeof createClient>
}): Promise<{ erro?: string; id?: string; protocolo?: string }> {
  if (editando && camada === 'empregos') {
    const { error } = await supabase.from(camada).update(dados).eq('id', editando.id)
    return error ? { erro: error.message } : {}
  }

  if (editando) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/camadas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ camada, id: editando.id, dados }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { erro: json?.error || 'Não foi possível salvar.' }
    return {}
  }

  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/camadas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ camada, dados, turnstile_token: turnstileToken }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { erro: json?.error || 'Não foi possível salvar.' }
  return { id: json?.registro?.id, protocolo: json?.registro?.protocolo }
}
