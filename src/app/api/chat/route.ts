import { NextRequest, NextResponse } from 'next/server'
import { getUser, limiteExcedido } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// Gemini pode demorar até ~25s; sem maxDuration a função era cortada pelo
// Vercel no padrão da plataforma (~10s) e o chatbot ficava sem resposta.
export const maxDuration = 60

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

// Só as últimas N mensagens vão pro Gemini — mesmo motivo do limite equivalente
// no WhatsApp (MAX_HISTORICO_GEMINI): histórico completo faz cada mensagem ficar
// mais lenta e mais cara que a anterior, sem ganho real de contexto, e em
// conversas longas pode estourar o limite de tokens de entrada do modelo.
const MAX_HISTORICO_GEMINI = 20

// Localiza um objeto {"action":...} completo, contando chaves e ignorando as que
// aparecem dentro de strings — mesma lógica do webhook do WhatsApp (acharBlocoAcao).
function acharBlocoAcao(texto: string): { inicio: number; fim: number } | null {
  const inicio = texto.search(/\{\s*"action"\s*:/)
  if (inicio === -1) return null
  let profundidade = 0
  let emString = false
  let escapado = false
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (escapado) { escapado = false; continue }
    if (c === '\\') { escapado = true; continue }
    if (c === '"') { emString = !emString; continue }
    if (emString) continue
    if (c === '{') profundidade++
    else if (c === '}' && --profundidade === 0) return { inicio, fim: i + 1 }
  }
  return null
}

function extrairAcao(texto: string): Record<string, unknown> | null {
  const bloco = acharBlocoAcao(texto)
  if (!bloco) return null
  try {
    return JSON.parse(texto.slice(bloco.inicio, bloco.fim))
  } catch {
    return null
  }
}

// Rede de segurança equivalente à do WhatsApp (limparJsonDaResposta): o modelo às
// vezes devolve um JSON de ação numa hora que não devia — por exemplo, já no meio
// do fluxo guiado de registro, que a partir daí é conduzido por código, não pela
// IA. Sem isso o cidadão via o JSON cru na tela. "detectar_demanda" passa intacto
// porque o cliente (useChatBot.ts) depende dele pra iniciar o fluxo de registro.
function limparAcaoInesperada(texto: string, acao: Record<string, unknown> | null): string {
  if (!acao || acao.action === 'detectar_demanda') return texto
  const bloco = acharBlocoAcao(texto)
  if (!bloco) return texto
  const limpo = (texto.slice(0, bloco.inicio) + texto.slice(bloco.fim)).replace(/```(?:json)?/gi, '').trim()
  return limpo.length >= 5 ? limpo : 'Pode me contar um pouco mais sobre isso?'
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Best-effort — ver comentário em limiteExcedido (não é garantia em serverless)
  if (limiteExcedido(`chat:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Muitas mensagens em pouco tempo. Aguarde um instante.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const mensagensRecebidas = body?.mensagens
  const nomeUsuario = body?.nomeUsuario
  if (!Array.isArray(mensagensRecebidas) || mensagensRecebidas.length === 0) {
    return NextResponse.json({ error: 'Mensagens inválidas.' }, { status: 400 })
  }
  const mensagens = (mensagensRecebidas as MensagemChat[]).slice(-MAX_HISTORICO_GEMINI)

  try {

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

QUANDO VOCÊ NÃO SABE A RESPOSTA:
Se o cidadão fizer uma pergunta cuja resposta NÃO está na base de conhecimento acima (e não for um relato de problema/demanda), responda EXATAMENTE com este JSON (nada mais, sem texto antes ou depois):
{"action":"sem_resposta"}
Não tente adivinhar, não invente e não escreva texto nenhum além desse JSON nesse caso — a mensagem que o cidadão vai ver é gerada por outra parte do sistema.

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!geminiRes.ok) {
    console.error('Gemini chat error:', await geminiRes.text())
    return NextResponse.json({ error: 'Erro ao processar mensagem.' }, { status: 500 })
  }

  const geminiData = await geminiRes.json()
  let resposta = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar sua mensagem.'

  // Detecta de forma deterministica quando a propria IA sinaliza que nao sabe responder
  // (em vez de tentar adivinhar por palavras-chave num texto livre, que fica obsoleto
  // toda vez que o prompt muda e nunca bate de verdade). Usa o mesmo extrator com
  // contagem de chaves do "detectar_demanda" — a regex antiga só casava o JSON
  // exato "{"action":"sem_resposta"}", sem espaços; agora ambos os casos passam
  // pelo mesmo caminho, incluindo variações de formatação que o modelo emita.
  const acao = extrairAcao(resposta)

  if (acao?.action === 'sem_resposta') {
    resposta = 'Não tenho essa informação disponível no momento. Recomendo entrar em contato diretamente com a Prefeitura de Frutal para mais detalhes.'
    const ultimaMensagemUsuario = [...mensagens].reverse().find((m) => m.role === 'user')
    if (ultimaMensagemUsuario) {
      await supabaseServer.from('chatbot_sem_resposta').insert({
        user_id: user.id,
        pergunta: ultimaMensagemUsuario.content,
        resposta_bot: resposta,
      })
    }
  } else {
    // Rede de segurança: remove qualquer outro JSON de ação que o modelo tenha
    // emitido fora de hora (ex.: já no meio do fluxo de registro, conduzido por
    // código) — sem isso o cidadão via o JSON cru na tela do chat.
    resposta = limparAcaoInesperada(resposta, acao)
  }

  return NextResponse.json({ resposta })
  } catch (err) {
    console.error('[chat] falhou:', err)
    return NextResponse.json({ error: 'Erro ao processar mensagem.' }, { status: 500 })
  }
}
