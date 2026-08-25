const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE

const TIMEOUT_MS = 15000
const TIMEOUT_MIDIA_MS = 30000

export async function enviarWhatsapp(telefone: string, texto: string) {
  const inicio = Date.now()
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
      body: JSON.stringify({ number: telefone, text: texto, linkPreview: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    console.log(`[evolution:sendText] ${Date.now() - inicio}ms status=${res.status}`)
  } catch (e) {
    console.error(`[evolution:sendText] falhou apos ${Date.now() - inicio}ms:`, e)
  }
}

export async function enviarImagemWhatsapp(telefone: string, urlImagem: string, legenda?: string) {
  const inicio = Date.now()
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
      body: JSON.stringify({ number: telefone, mediatype: 'image', media: urlImagem, caption: legenda || '' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    console.log(`[evolution:sendMedia] ${Date.now() - inicio}ms status=${res.status}`)
  } catch (e) {
    console.error(`[evolution:sendMedia] falhou apos ${Date.now() - inicio}ms:`, e)
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
