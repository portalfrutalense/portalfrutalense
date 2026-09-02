const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE

const TIMEOUT_MS = 15000
const TIMEOUT_MIDIA_MS = 30000

// BUG CORRIGIDO (B19-7): nenhuma das duas funções checava `res.ok` — só
// logava o status e retornava `void`. Uma recusa da Evolution API
// (400/500, número inválido, instância desconectada) era indistinguível de
// sucesso pra quem chama: o fluxo seguia como se o cidadão tivesse
// recebido a mensagem. Agora ambas retornam `boolean` (sucesso/falha) e
// logam como erro quando `!res.ok` — mesmo padrão já usado em
// `baixarMidiaWhatsapp`, logo abaixo. Chamadores que ainda não tratam o
// retorno continuam funcionando (o valor pode ser ignorado), mas agora
// existe um sinal de verdade pra quem precisar reagir a uma falha de envio.
export async function enviarWhatsapp(telefone: string, texto: string): Promise<boolean> {
  const inicio = Date.now()
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
      body: JSON.stringify({ number: telefone, text: texto, linkPreview: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[evolution:sendText] ${Date.now() - inicio}ms falhou status=${res.status}`)
      return false
    }
    console.log(`[evolution:sendText] ${Date.now() - inicio}ms status=${res.status}`)
    return true
  } catch (e) {
    console.error(`[evolution:sendText] falhou apos ${Date.now() - inicio}ms:`, e)
    return false
  }
}

export async function enviarImagemWhatsapp(telefone: string, urlImagem: string, legenda?: string): Promise<boolean> {
  const inicio = Date.now()
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
      body: JSON.stringify({ number: telefone, mediatype: 'image', media: urlImagem, caption: legenda || '' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[evolution:sendMedia] ${Date.now() - inicio}ms falhou status=${res.status}`)
      return false
    }
    console.log(`[evolution:sendMedia] ${Date.now() - inicio}ms status=${res.status}`)
    return true
  } catch (e) {
    console.error(`[evolution:sendMedia] falhou apos ${Date.now() - inicio}ms:`, e)
    return false
  }
}

// Baixa e descriptografa a mídia de uma mensagem (foto), retorna base64 + mimetype
export async function baixarMidiaWhatsapp(messageKey: unknown): Promise<{ base64: string; mimetype: string } | null> {
  const inicio = Date.now()
  try {
    // Mídia é mais pesada que texto, então a margem aqui é maior.
    const res = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
      body: JSON.stringify({ message: { key: messageKey } }),
      signal: AbortSignal.timeout(TIMEOUT_MIDIA_MS),
    })
    if (!res.ok) {
      console.error(`[evolution:midia] ${Date.now() - inicio}ms status=${res.status}`)
      return null
    }
    const data = await res.json()
    if (!data.base64) {
      console.error(`[evolution:midia] ${Date.now() - inicio}ms resposta sem base64`)
      return null
    }
    console.log(`[evolution:midia] ${Date.now() - inicio}ms ok`)
    return { base64: data.base64, mimetype: data.mimetype || 'image/jpeg' }
  } catch (e) {
    console.error(`[evolution:midia] falhou apos ${Date.now() - inicio}ms:`, e)
    return null
  }
}
