import type { createClient } from '@/lib/supabase-browser'

/**
 * Criação passa pela API para o token do Turnstile ser conferido no
 * servidor; edição vai direto pelo cliente, sob o RLS do autor.
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
  camada: 'pets' | 'classificados' | 'empregos'
  editando: { id: string } | null
  dados: Record<string, unknown>
  turnstileToken: string
  supabase: ReturnType<typeof createClient>
}): Promise<{ erro?: string; id?: string; protocolo?: string }> {
  if (editando) {
    const { error } = await supabase.from(camada).update(dados).eq('id', editando.id)
    return error ? { erro: error.message } : {}
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
