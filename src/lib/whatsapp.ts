const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE

export async function enviarWhatsapp(telefone: string, texto: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
    body: JSON.stringify({ number: telefone, text: texto }),
  })
}

// Baixa e descriptografa a mídia de uma mensagem (foto), retorna base64 + mimetype
export async function baixarMidiaWhatsapp(messageKey: unknown): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY! },
      body: JSON.stringify({ message: { key: messageKey } }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.base64) return null
    return { base64: data.base64, mimetype: data.mimetype || 'image/jpeg' }
  } catch {
    return null
  }
}
