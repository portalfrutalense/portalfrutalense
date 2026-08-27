/**
 * Criação passa pela API para o token do Turnstile ser conferido no
 * servidor; edição vai direto pelo cliente, sob o RLS do autor.
 */
export async function salvarCamada({
  camada, editando, dados, turnstileToken, supabase,
}: {
  camada: 'pets' | 'classificados' | 'empregos'
  editando: { id: string } | null
  dados: Record<string, any>
  turnstileToken: string
  supabase: any
}): Promise<{ erro?: string }> {
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
  return res.ok ? {} : { erro: json?.error || 'Não foi possível salvar.' }
}
