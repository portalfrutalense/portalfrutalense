import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

interface BaseConhecimento { titulo: string; conteudo: string }
interface Categoria { id: string; nome: string }
interface ChatConfig {
  nome_bot?: string | null
  descricao_bot?: string | null
  tom_voz?: string | null
  responsabilidades?: string | null
  prompt_extra?: string | null
}
interface MensagemChat { role: 'user' | 'assistant'; content: string }

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

  // Busca base de conhecimento + categorias + config em paralelo
  const [{ data: base }, { data: categorias }, { data: chatConfig }] = await Promise.all([
    supabaseServer.from('chatbot_base').select('titulo, conteudo').eq('ativo', true),
    supabaseServer.from('categorias_mapa').select('id, nome').eq('ativo', true),
    supabaseServer.from('chatbot_config').select('nome_bot, descricao_bot, tom_voz, responsabilidades, prompt_extra').eq('id', 1).maybeSingle(),
  ])

  const baseTexto = ((base || []) as BaseConhecimento[]).map((e) => `### ${e.titulo}\n${e.conteudo}`).join('\n\n')
  const categoriasTexto = ((categorias || []) as Categoria[]).map((c) => `- ${c.nome} (id: ${c.id})`).join('\n')

  const cfg: ChatConfig = chatConfig || {}

  const systemPrompt = `Você é um assistente virtual do CidadanIA Frutal, plataforma de cidadania do município de Frutal-MG.
Você está conversando com ${nomeUsuario}.
${cfg.nome_bot ? `\nSeu nome é ${cfg.nome_bot}.` : ''}
${cfg.descricao_bot ? `\n${cfg.descricao_bot}` : ''}
${cfg.tom_voz ? `\nTOM DE VOZ:\n${cfg.tom_voz}` : ''}
${cfg.responsabilidades ? `\nSUAS RESPONSABILIDADES:\n${cfg.responsabilidades}` : ''}

BASE DE CONHECIMENTO:
${baseTexto || '(nenhuma informação cadastrada ainda)'}

CATEGORIAS DE DEMANDAS DISPONÍVEIS:
${categoriasTexto || '(nenhuma categoria)'}

DETECÇÃO DE DEMANDA:
Se o cidadão relatar um problema urbano (buraco na rua, lixo acumulado, iluminação, poda de árvore, etc.), identifique a categoria mais adequada da lista acima e responda EXATAMENTE com este JSON (nada mais, sem texto antes ou depois):
{"action":"detectar_demanda","descricao":"<resumo objetivo do problema relatado pelo cidadão>","categoria_id":"<id da categoria escolhida>","categoria_nome":"<nome da categoria escolhida>"}
Se nenhuma categoria da lista for adequada, use categoria_nome:"Outros" e categoria_id:"".
NÃO peça endereço, NÃO pergunte sobre autoridade responsável, NÃO pergunte sobre foto, e NÃO escreva nenhuma mensagem de confirmação — essas etapas são conduzidas por outra parte do sistema logo depois que você envia esse JSON.
Se a mensagem do cidadão não for um relato de problema (for uma pergunta, dúvida geral, ou for vaga demais para identificar um problema real), NÃO use esse JSON — responda normalmente em texto e, se precisar, peça mais detalhes sobre o problema.

REGRAS IMPORTANTES:
- Se já houver mensagens anteriores na conversa, NÃO cumprimente de novo (nada de "Olá" ou se apresentar outra vez) — continue naturalmente, como se já estivesse no meio da conversa com o cidadão.
- Nunca invente informações que não estão na base de conhecimento.
- Nunca use emojis em nenhuma mensagem.
${cfg.prompt_extra ? `\nINSTRUÇÕES ADICIONAIS:\n${cfg.prompt_extra}` : ''}`

  const contents = (mensagens as MensagemChat[]).map((m) => ({
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

  // Logar quando o bot não souber responder
  const frasesSemResposta = [
    'não tenho essa informação',
    'não encontrei essa informação',
    'não possuo essa informação',
    'entre em contato com a prefeitura',
    'não sei responder',
    'não consigo responder',
    'não tenho dados sobre',
  ]
  const semResposta = frasesSemResposta.some(f => resposta.toLowerCase().includes(f))

  if (semResposta) {
    const ultimaMensagemUsuario = [...(mensagens as MensagemChat[])].reverse().find((m) => m.role === 'user')
    if (ultimaMensagemUsuario) {
      await supabaseServer.from('chatbot_sem_resposta').insert({
        user_id: user.id,
        pergunta: ultimaMensagemUsuario.content,
        resposta_bot: resposta,
      })
    }
  }

  return NextResponse.json({ resposta })
}
