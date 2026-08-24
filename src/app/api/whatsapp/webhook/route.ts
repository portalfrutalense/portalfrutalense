import { NextRequest, NextResponse } from 'next/server'

// Endpoint temporário de investigação — só loga o payload real que o
// Evolution API manda, pra confirmarmos o formato antes de construir
// a lógica de resposta de verdade.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  console.log('=== WEBHOOK WHATSAPP RECEBIDO ===')
  console.log(JSON.stringify(body, null, 2))
  return NextResponse.json({ ok: true })
}
