import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
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

  const { mensagens, nomeUsuario } = await req.json()

  // Busca base de conhecimento + categorias + entidades em paralelo
  const [{ data: base }, { data: categorias }, { data: entidades }] = await Promise.all([
    supabaseServer.from('chatbot_base').select('titulo, conteudo').eq('ativo', true),
    supabaseServer.from('categorias_mapa').select('id, nome').eq('ativo', true),
    supabaseServer.from('entidades').select('id, nome, cargo').eq('ativo', true),
  ])

  const baseTexto = (base || []).map((e: any) => `### ${e.titulo}\n${e.conteudo}`).join('\n\n')
  const categoriasTexto = (categorias || []).map((c: any) => `- ${c.nome} (id: ${c.id})`).join('\n')
  const entidadesTexto = (entidades || []).map((e: any) => `- ${e.nome}, ${e.cargo} (id: ${e.id})`).join('\n')

  const systemPrompt = `Você é o assistente virtual do Fala Frutal, plataforma de cidadania do município de Frutal-MG.
Você está conversando com ${nomeUsuario}, um cidadão cadastrado na plataforma.

SUAS RESPONSABILIDADES:
1. Responder perguntas dos cidadãos usando SOMENTE a base de conhecimento abaixo.
2. Se não souber a resposta, diga claramente que não tem essa informação cadastrada.
3. Ajudar o cidadão a registrar uma demanda quando solicitado.

BASE DE CONHECIMENTO:
${baseTexto || '(nenhuma informação cadastrada ainda)'}

CATEGORIAS DISPONÍVEIS PARA DEMANDAS:
${categoriasTexto || '(nenhuma categoria)'}

AUTORIDADES DISPONÍVEIS PARA DEMANDAS:
${entidadesTexto || '(nenhuma autoridade)'}

COMO REGISTRAR UMA DEMANDA:
Quando o cidadão quiser registrar uma demanda, colete as informações UMA DE CADA VEZ, em ordem:
1. Primeiro pergunte SOMENTE a descrição do problema. Espere a resposta.
2. Depois pergunte SOMENTE o endereço onde ocorre o problema. Espere a resposta.
3. Depois apresente as categorias disponíveis e pergunte SOMENTE qual se encaixa. Espere a resposta.
4. Por último apresente as autoridades disponíveis e pergunte SOMENTE para quem direcionar. Espere a resposta.

NUNCA faça mais de uma pergunta na mesma mensagem.
Quando tiver TODOS os quatro dados coletados, responda EXATAMENTE neste formato JSON (nada mais):
{"action":"criar_demanda","descricao":"...","endereco":"...","categoria_id":"...","categoria_nome":"...","entidade_id":"...","entidade_nome":"..."}

REGRAS IMPORTANTES:
- Seja cordial, objetivo e use linguagem simples.
- Nunca invente informações que não estão na base de conhecimento.
- Se o cidadão perguntar algo fora da base, diga: "Não tenho essa informação cadastrada. Você pode entrar em contato diretamente com a Prefeitura de Frutal."
- Quando criar demanda, use EXATAMENTE os IDs fornecidos acima.`

  const contents = mensagens.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
    }
  )

  if (!geminiRes.ok) {
    console.error('Gemini chat error:', await geminiRes.text())
    return NextResponse.json({ error: 'Erro ao processar mensagem.' }, { status: 500 })
  }

  const geminiData = await geminiRes.json()
  const resposta = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar sua mensagem.'

  return NextResponse.json({ resposta })
}
