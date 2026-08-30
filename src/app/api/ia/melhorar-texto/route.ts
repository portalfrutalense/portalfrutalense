import { NextRequest, NextResponse } from 'next/server'
import { getUser, limiteExcedido } from '@/lib/auth-api'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Best-effort — ver comentário em limiteExcedido (não é garantia em serverless)
  if (limiteExcedido(`melhorar-texto:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Muitas tentativas em pouco tempo. Aguarde um instante.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const texto = body?.texto
  if (!texto || !String(texto).trim()) {
    return NextResponse.json({ error: 'Texto vazio.' }, { status: 400 })
  }
  const textoLimpo = String(texto).trim()
  if (textoLimpo.length > 2000) {
    return NextResponse.json({ error: 'Texto muito longo (máx. 2000 caracteres).' }, { status: 400 })
  }

  const prompt = `Reescreva a descrição de um problema urbano abaixo, deixando-a mais clara, objetiva e bem escrita, corrigindo erros de português. NÃO invente informações novas, NÃO adicione detalhes que não foram mencionados, mantenha o sentido original e o tom de quem está relatando um problema real. Responda APENAS com o texto reescrito, sem aspas, sem explicações, sem texto antes ou depois.

Descrição original:
"""
${textoLimpo}
"""`

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(30000),
      }
    )

    if (!geminiRes.ok) {
      console.error('Gemini melhorar-texto error:', await geminiRes.text())
      return NextResponse.json({ error: 'Erro ao melhorar texto.' }, { status: 500 })
    }

    const data = await geminiRes.json()
    const melhorado: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!melhorado) {
      return NextResponse.json({ error: 'Erro ao melhorar texto.' }, { status: 500 })
    }

    return NextResponse.json({ texto: melhorado })
  } catch (err) {
    console.error('[melhorar-texto] falhou:', err)
    return NextResponse.json({ error: 'Erro ao melhorar texto.' }, { status: 500 })
  }
}
