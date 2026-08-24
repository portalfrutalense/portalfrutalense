import { NextRequest, NextResponse } from 'next/server'

interface EvolutionWebhookBody {
  event?: string
  instance?: string
  data?: {
    key?: {
      remoteJid?: string
      fromMe?: boolean
    }
    pushName?: string
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
    }
    messageType?: string
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null
  if (!body || body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  const key = body.data?.key
  const remoteJid = key?.remoteJid || ''

  // Ignora: mensagem enviada pelo próprio número conectado, e mensagem de grupo
  // (grupo termina em @g.us; conversa direta termina em @s.whatsapp.net)
  if (key?.fromMe) return NextResponse.json({ ok: true })
  if (remoteJid.endsWith('@g.us')) return NextResponse.json({ ok: true })
  if (!remoteJid.endsWith('@s.whatsapp.net')) return NextResponse.json({ ok: true })

  const texto = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || ''
  if (!texto.trim()) return NextResponse.json({ ok: true })

  const telefone = remoteJid.replace('@s.whatsapp.net', '')

  console.log('Mensagem direta recebida de', telefone, '- tipo:', body.data?.messageType)

  // TODO: próximos passos —
  // 1. Buscar/criar conversa em `whatsapp_conversas` por telefone
  // 2. Verificar se telefone já está vinculado a um perfil (tabela perfis)
  // 3. Montar histórico + chamar Gemini (reaproveitando lógica de /api/chat)
  // 4. Detectar intenção de demanda -> se não vinculado, mandar link de cadastro
  // 5. Enviar resposta de volta via Evolution API

  return NextResponse.json({ ok: true })
}
