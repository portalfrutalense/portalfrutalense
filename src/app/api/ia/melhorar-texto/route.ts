import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function verificarUsuario(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await sb.auth.getUser(token)
  return user || null
}

export async function POST(req: NextRequest) {
  const user = await verificarUsuario(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { texto } = await req.json()
  if (!texto || !String(texto).trim()) {
    return NextResponse.json({ error: 'Texto vazio.' }, { status: 400 })
  }

  const prompt = `Reescreva a descrição de um problema urbano abaixo, deixando-a mais clara, objetiva e bem escrita, corrigindo erros de português. NÃO invente informações novas, NÃO adicione detalhes que não foram mencionados, mantenha o sentido original e o tom de quem está relatando um problema real. Responda APENAS com o texto reescrito, sem aspas, sem explicações, sem texto antes ou depois.

Descrição original:
"""
${String(texto).trim()}
"""`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
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
}
