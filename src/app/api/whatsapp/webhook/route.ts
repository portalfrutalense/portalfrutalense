import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { enviarWhatsapp, enviarImagemWhatsapp, baixarMidiaWhatsapp } from '@/lib/whatsapp'

// O trabalho pesado roda dentro do `after`, que é limitado pelo maxDuration
// desta rota (docs do Next: after.md). Sem isso vale o padrão da plataforma,
// curto demais, e o processamento é cortado no meio — a mensagem some sem erro.
export const maxDuration = 120

const FRUTAL_LAT = -20.02752
const FRUTAL_LNG = -48.92702
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const TIMEOUT_MAPBOX_MS = 8000

interface EvolutionWebhookBody {
  event?: string
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string; [k: string]: unknown }
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
      locationMessage?: { degreesLatitude?: number; degreesLongitude?: number }
    }
    messageType?: string
  }
}

interface DadosPendentes {
  descricao?: string
  categoria_id?: string
  categoria_nome?: string
  opcoes_autoridade?: { id: string; nome: string; cargo: string }[]
  entidades_ids?: string[]
  entidades_nomes?: string[]
  endereco_label?: string
  lat?: number
  lng?: number
  foto_url?: string | null
}

function dentroFrutal(lat: number, lng: number) {
  const dlat = lat - FRUTAL_LAT
  const dlng = lng - FRUTAL_LNG
  return Math.sqrt(dlat * dlat + dlng * dlng) < 0.15
}

async function geocodificar(endereco: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const q = encodeURIComponent(`${endereco}, Frutal, Minas Gerais`)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&country=BR&language=pt&limit=1&proximity=${FRUTAL_LNG},${FRUTAL_LAT}&types=address`
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MAPBOX_MS) })
    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature || feature.relevance < 0.85) return null
    const [lng, lat] = feature.center
    if (!dentroFrutal(lat, lng)) return null
    return { lat, lng, label: endereco }
  } catch (e) {
    console.error('[geocodificar] falhou:', e)
    return null
  }
}

// Gera URL da imagem de satélite com pin via Mapbox Static API
function urlMapaSatelite(lat: number, lng: number): string {
  const pin = `pin-l+4256c8(${lng},${lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${pin}/${lng},${lat},18,0/600x400@2x?access_token=${MAPBOX_TOKEN}`
}

// Cache em memória para dados estáticos do Supabase (TTL: 5 minutos)
let _cacheConfigs: { base: string; categorias: string; cfg: Record<string, string>; ts: number } | null = null

async function carregarConfigs() {
  const agora = Date.now()
  if (_cacheConfigs && agora - _cacheConfigs.ts < 5 * 60 * 1000) return _cacheConfigs

  const [{ data: base }, { data: categorias }, { data: chatConfig }] = await Promise.all([
    supabaseServer.from('chatbot_base').select('titulo, conteudo').eq('ativo', true),
    supabaseServer.from('categorias_mapa').select('id, nome').eq('ativo', true),
    supabaseServer.from('chatbot_config').select('nome_bot, descricao_bot, tom_voz, responsabilidades, prompt_extra').eq('id', 1).maybeSingle(),
  ])
  _cacheConfigs = {
    base: (base || []).map((e) => `### ${e.titulo}\n${e.conteudo}`).join('\n\n'),
    categorias: (categorias || []).map((c) => `- ${c.nome} (id: ${c.id})`).join('\n'),
    cfg: (chatConfig || {}) as Record<string, string>,
    ts: agora,
  }
  return _cacheConfigs
}

async function montarSystemPrompt(nomeUsuario: string, contexto?: {
  etapa: string
  opcoes_autoridade?: { id: string; nome: string; cargo: string }[]
  dados?: DadosPendentes
}) {
  const { base: baseTexto, categorias: categoriasTexto, cfg } = await carregarConfigs()

  // As instruções de detecção só valem na conversa livre. Dentro do fluxo de
  // registro elas confundem o modelo, que volta a emitir detectar_demanda no
  // meio de outra etapa — e esse JSON acaba indo cru pro cidadão.
  const blocoDeteccao = contexto ? '' : `
DETECÇÃO DE DEMANDA:
Se o cidadão relatar um problema urbano, responda EXATAMENTE com este JSON (nada mais):
{"action":"detectar_demanda","descricao":"<resumo objetivo>","categoria_id":"<id da categoria>","categoria_nome":"<nome da categoria>"}
Se nenhuma categoria for adequada, use categoria_nome:"Outros" e categoria_id:"".
Se não for um relato de problema, responda normalmente em texto.
`

  const promptBase = `Você é um assistente virtual do CidadanIA Frutal, conversando por WhatsApp com ${nomeUsuario}.
${cfg.nome_bot ? `\nSeu nome é ${cfg.nome_bot}.` : ''}
${cfg.descricao_bot ? `\n${cfg.descricao_bot}` : ''}
${cfg.tom_voz ? `\nTOM DE VOZ:\n${cfg.tom_voz}` : ''}
${cfg.responsabilidades ? `\nSUAS RESPONSABILIDADES:\n${cfg.responsabilidades}` : ''}

BASE DE CONHECIMENTO:
${baseTexto || '(nenhuma informação cadastrada ainda)'}

CATEGORIAS DE DEMANDAS DISPONÍVEIS:
${categoriasTexto || '(nenhuma categoria)'}
${blocoDeteccao}
REGRAS:
- Fale de um jeito natural e caloroso, como numa conversa real de WhatsApp
- Respostas objetivas, sem enrolação, mas sem soar seco ou frio
- Nunca use emojis
- Nunca invente informações que não estão na base de conhecimento
- Cada demanda é um registro separado e independente — nunca ofereça agrupar dois problemas num mesmo protocolo, incluir um segundo problema em registro já feito, ou qualquer variação disso. Se o cidadão mencionar um novo problema após um registro concluído, trate como uma nova demanda do zero

VARIAÇÃO DE LINGUAGEM (muito importante):
- Nunca comece respostas com as mesmas palavras ou expressões de sempre ("Beleza!", "Ótimo!", "Certo!" etc.)
- Varie sempre a estrutura das frases, a forma de fazer perguntas e as expressões usadas
- O conteúdo deve ser o mesmo, mas o texto nunca deve soar idêntico a uma resposta anterior
- SESSÃO #${Math.floor(Math.random() * 999999)}: use este número como semente de variação — cada sessão deve ter um estilo ligeiramente diferente
${cfg.prompt_extra ? `\nINSTRUÇÕES ADICIONAIS:\n${cfg.prompt_extra}` : ''}`

  if (!contexto) return promptBase

  // Blocos extras por etapa
  if (contexto.etapa === 'perguntar_registrar') {
    return promptBase + `\n\nFLUXO DE REGISTRO — ETAPA: PERGUNTAR SE QUER REGISTRAR
O cidadão relatou um problema: "${contexto.dados?.descricao}" (categoria: ${contexto.dados?.categoria_nome}).
Pergunte de forma natural e curta se ele quer registrar essa demanda — explique brevemente que ela ficará visível no mapa e a autoridade responsável será notificada.
Varie sempre a forma de perguntar. Apenas texto, sem JSON.`
  }

  if (contexto.etapa === 'escolher_autoridade') {
    const lista = (contexto.opcoes_autoridade || []).map(a => `  - ${a.nome} (${a.cargo}) [id: ${a.id}]`).join('\n')
    return promptBase + `\n\nFLUXO DE REGISTRO — ETAPA: ESCOLHER AUTORIDADE
O cidadão quer registrar: "${contexto.dados?.descricao}" (categoria: ${contexto.dados?.categoria_nome}).
Autoridades disponíveis:
${lista}

Apresente as opções de forma natural e deixe claro ao cidadão que ele pode escolher até 3 autoridades ao mesmo tempo.
Quando ele responder, identifique a(s) escolha(s) pelo nome ou cargo mencionado e responda EXATAMENTE com este JSON (nada mais, sem texto antes ou depois):
{"action":"autoridade_escolhida","entidade_ids":["id_aqui"],"entidade_nomes":["Nome Aqui"]}
Use APENAS os ids da lista acima. Se mencionar mais de uma, inclua todas nos arrays.
Se a resposta for vaga ou não identificar nenhuma autoridade, peça que repita de forma mais clara — não retorne JSON nesse caso.`
  }

  if (contexto.etapa === 'perguntar_foto') {
    return promptBase + `\n\nFLUXO DE REGISTRO — ETAPA: FOTO
O endereço do local foi confirmado. Pergunte de forma natural e curta se o cidadão tem alguma foto do local para anexar. Apenas texto, sem JSON.`
  }

  if (contexto.etapa === 'resumo') {
    const d = contexto.dados || {}
    return promptBase + `\n\nFLUXO DE REGISTRO — ETAPA: RESUMO
Apresente um resumo amigável e curto da demanda e peça confirmação ao cidadão:
• Problema: ${d.descricao}
• Categoria: ${d.categoria_nome}
• Direcionada para: ${(d.entidades_nomes || []).join(', ')}
• Endereço: ${d.endereco_label}
• Foto: ${d.foto_url ? 'enviada' : 'não enviada'}
Conclua pedindo ao cidadão que confirme ou cancele de forma natural. Apenas texto, sem JSON.`
  }

  if (contexto.etapa === 'confirmar_endereco') {
    return promptBase + `\n\nFLUXO DE REGISTRO — ETAPA: CONFIRMAR ENDEREÇO
Foi enviada uma imagem de satélite do local que o cidadão informou. Pergunte de forma natural e curta se aquele é o local correto. Apenas texto, sem JSON.`
  }

  return promptBase
}

type ParteGemini = { text: string } | { inline_data: { mime_type: string; data: string } }

// Só as últimas N mensagens vão pro Gemini — histórico completo faz cada
// mensagem ficar mais lenta que a anterior, sem ganho de contexto real.
const MAX_HISTORICO_GEMINI = 10

// A latência do Gemini é errática — medições do mesmo modelo com o mesmo
// prompt variaram de 0,8s a 24s. Esperar o pior caso deixa a conversa
// insuportável; um corte curto com uma segunda tentativa sai na frente,
// porque a repetição quase sempre cai na faixa rápida.
const MODELO_GEMINI = 'gemini-3.1-flash-lite'
const TIMEOUT_GEMINI_MS = 25000
const TENTATIVAS_GEMINI = 2

// Retorna null quando todas as tentativas falham. Devolver uma string de erro
// aqui fazia o texto "Desculpe, tive um problema" ser tratado como resposta
// legítima e substituir o fallback determinístico da etapa — o cidadão recebia
// o erro em vez da lista de autoridades, que nem precisava de IA pra ser
// montada. Com null, cada chamador cai no seu próprio fallback.
async function chamarGemini(
  systemPrompt: string,
  historico: { role: string; content: string }[],
  audio?: { base64: string; mimetype: string }
): Promise<string | null> {
  const recente = historico.slice(-MAX_HISTORICO_GEMINI)
  const contents: { role: string; parts: ParteGemini[] }[] = recente.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  if (audio && contents.length > 0) {
    const mimetypeLimpo = audio.mimetype.split(';')[0].trim()
    contents[contents.length - 1] = {
      role: 'user',
      parts: [{ inline_data: { mime_type: mimetypeLimpo, data: audio.base64 } }],
    }
  }

  const corpo = JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents })
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent?key=${process.env.GEMINI_API_KEY}`

  for (let tentativa = 1; tentativa <= TENTATIVAS_GEMINI; tentativa++) {
    const inicio = Date.now()
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_GEMINI_MS),
      })
      const ms = Date.now() - inicio

      // 4xx não melhora repetindo — desiste na hora.
      if (!res.ok) {
        const detalhe = await res.text()
        console.error(`[gemini] tentativa ${tentativa} ${ms}ms status=${res.status}: ${detalhe.slice(0, 300)}`)
        if (res.status < 500) return null
        continue
      }

      console.log(`[gemini] ok tentativa=${tentativa} ${ms}ms msgs=${contents.length}`)
      const data = await res.json()
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (texto) return texto
      console.warn('[gemini] resposta sem texto:', JSON.stringify(data).slice(0, 300))
    } catch (e) {
      // A latência do Gemini tem cauda longa: a mesma chamada varia de
      // menos de 1s a mais de 20s. Repetir costuma cair na parte rápida,
      // então uma segunda tentativa vale mais do que esperar mais tempo.
      console.error(`[gemini] tentativa ${tentativa} falhou apos ${Date.now() - inicio}ms:`, e)
    }
  }

  return null
}

// Localiza um objeto {"action":...} completo, contando chaves e ignorando as
// que aparecem dentro de strings. Regex não dá conta: com JSON aninhado, um
// padrão não-guloso corta no primeiro '}' e deixa sobra no texto.
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
  return null // objeto truncado
}

function extrairAcao(texto: string | null): Record<string, unknown> | null {
  if (!texto) return null
  const bloco = acharBlocoAcao(texto)
  if (!bloco) return null
  try {
    return JSON.parse(texto.slice(bloco.inicio, bloco.fim))
  } catch {
    return null
  }
}

// Rede de segurança: o modelo às vezes devolve um JSON de ação numa etapa que
// não esperava por ele. Sem isso o cidadão recebe o JSON cru no WhatsApp.
function limparJsonDaResposta(texto: string | null, fallback: string): string {
  if (!texto) return fallback
  let limpo = texto
  for (let i = 0; i < 5; i++) {
    const bloco = acharBlocoAcao(limpo)
    if (!bloco) break
    limpo = limpo.slice(0, bloco.inicio) + limpo.slice(bloco.fim)
  }
  // Objeto truncado (sem fechamento) deixa lixo do "{" em diante.
  const truncado = limpo.search(/\{\s*"action"\s*:/)
  if (truncado !== -1) limpo = limpo.slice(0, truncado)

  limpo = limpo.replace(/```(?:json)?/gi, '').trim()
  return limpo.length >= 10 ? limpo : fallback
}

async function enviarTextoSeguro(telefone: string, texto: string | null, fallback: string) {
  const limpo = limparJsonDaResposta(texto, fallback)
  if (texto && limpo !== texto.trim()) console.warn('[sanitize] JSON removido da resposta ao cidadao')
  await enviarWhatsapp(telefone, limpo)
  return limpo
}

// Sem fronteira de palavra, as alternativas de uma letra engolem qualquer
// frase iniciada por ela: "Só que não" batia como positivo, "Nossa" como
// negativo. E \b não serve aqui — sem a flag u ele só conhece [A-Za-z0-9_],
// então trata "ó" como fronteira e "Só" volta a casar com "s". A trava
// abaixo é ciente de acentos.
const FIM = '(?![\\p{L}\\p{N}])'
const RE_POSITIVO = new RegExp(`^\\s*(sim|s|isso|claro|quero|pode|ok|certo|exato|confirmo|correto|positivo|beleza|bora|vamos)${FIM}`, 'iu')
const RE_NEGATIVO = new RegExp(`^\\s*(n[aã]o|n|nop|negativo|errado|incorreto|outro|diferente)${FIM}`, 'iu')

// Negativo vem primeiro: "não" e "nao" são inequívocos, e assim uma frase que
// comece com algo ambíguo não é lida como consentimento.
function ehNegativo(texto: string) { return RE_NEGATIVO.test(texto) }
function ehPositivo(texto: string) { return !ehNegativo(texto) && RE_POSITIVO.test(texto) }

async function salvarHistorico(id: string, historico: unknown, etapa: string, dados: DadosPendentes | null) {
  await supabaseServer.from('whatsapp_conversas').update({ historico, etapa, dados_pendentes: dados }).eq('id', id)
}

async function processarMensagem(body: EvolutionWebhookBody) {
  const key = body.data?.key
  const remoteJid = key?.remoteJid || ''
  if (key?.fromMe) return
  if (!remoteJid.endsWith('@s.whatsapp.net')) return

  const telefone = remoteJid.replace('@s.whatsapp.net', '')
  const texto = (body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || '').trim()
  const location = body.data?.message?.locationMessage
  const temImagem = body.data?.messageType === 'imageMessage'
  const temAudio = body.data?.messageType === 'audioMessage'

  if (!texto && !location && !temImagem && !temAudio) return

  // Busca ou cria a conversa
  let { data: conversa } = await supabaseServer.from('whatsapp_conversas').select('*').eq('telefone', telefone).single()
  if (!conversa) {
    const { data: nova } = await supabaseServer.from('whatsapp_conversas').insert({ telefone }).select().single()
    conversa = nova
  }
  if (!conversa) return

  // Evita reprocessar a mesma mensagem (a Evolution reenvia o webhook).
  // Ler-e-depois-gravar deixava dois webhooks simultâneos passarem juntos:
  // ambos liam o id antigo antes de qualquer um gravar. O update condicional
  // resolve no banco — só quem muda a linha de fato segue adiante.
  const messageId = key?.id
  if (messageId) {
    const { data: reivindicada } = await supabaseServer
      .from('whatsapp_conversas')
      .update({ ultimo_message_id: messageId })
      .eq('id', conversa.id)
      .or(`ultimo_message_id.is.null,ultimo_message_id.neq.${messageId}`)
      .select('id')

    if (!reivindicada?.length) {
      console.log(`[webhook] mensagem ${messageId} ja processada — ignorando`)
      return
    }
  }

  const historico: { role: string; content: string }[] = conversa.historico || []
  const dados: DadosPendentes = conversa.dados_pendentes || {}
  const etapa: string = conversa.etapa || 'nenhuma'

  // Tenta os dois formatos de telefone (com e sem o 9º dígito) pois a Evolution
  // às vezes omite o 9 em celulares BR (553491500046 vs 5534991500046)
  const telefoneAlt = telefone.length === 13
    ? telefone.slice(0, 4) + telefone.slice(5)
    : telefone.slice(0, 4) + '9' + telefone.slice(4)
  const { data: perfilLigado } = await supabaseServer
    .from('perfis').select('id, nome, cpf')
    .or(`whatsapp.eq.${telefone},whatsapp.eq.${telefoneAlt}`)
    .maybeSingle()
  const nomeUsuario = perfilLigado?.nome?.split(' ')[0] || 'Cidadão'

  // ── Etapa: nenhuma (conversa livre + detecção) ──
  if (etapa === 'nenhuma') {
    let audioParaGemini: { base64: string; mimetype: string } | undefined

    if (texto) {
      historico.push({ role: 'user', content: texto })
    } else if (temAudio && key?.id) {
      const midia = await baixarMidiaWhatsapp(key)
      if (!midia) {
        await enviarWhatsapp(telefone, 'Ih, não consegui entender esse áudio direito. Pode tentar mandar de novo, ou se preferir, escreve mesmo.')
        return
      }
      audioParaGemini = midia
      historico.push({ role: 'user', content: '[Áudio]' })
    } else {
      await enviarWhatsapp(telefone, 'Recebi o que você mandou, mas por enquanto só consigo entender texto ou áudio por aqui.')
      return
    }

    const systemPrompt = await montarSystemPrompt(nomeUsuario)
    const resposta = await chamarGemini(systemPrompt, historico, audioParaGemini)

    // Usa brace-counting (extrairAcao) em vez de regex simples: [^}]+ quebraria
    // se a descrição do problema contiver "}" (ex: "buraco {perto do banco}"),
    // e também perderia o JSON se o modelo adicionar texto antes dele.
    const acaoDetectada = extrairAcao(resposta)
    if (acaoDetectada?.action === 'detectar_demanda') {
      const novosDados: DadosPendentes = {
        descricao: (acaoDetectada.descricao as string) || texto || 'Problema relatado por áudio',
        categoria_id: (acaoDetectada.categoria_id as string) || '',
        categoria_nome: (acaoDetectada.categoria_nome as string) || 'Outros',
      }

      // Mensagem fixa para perguntar sobre registro — evita segunda chamada ao Gemini
      const variacoes = [
        `Entendido! Quer que eu registre essa demanda no sistema? Ela ficará visível para todos no mapa e a autoridade responsável será notificada.`,
        `Recebi! Posso registrar essa demanda pra você? Ela vai aparecer para todos no mapa público e a autoridade responsável será acionada.`,
        `Anotei o problema. Quer registrar essa demanda oficialmente? Ela ficará visível para todos no mapa e a autoridade competente será notificada.`,
      ]
      const msg = variacoes[Math.floor(Math.random() * variacoes.length)]
      historico.push({ role: 'assistant', content: msg })

      if (!perfilLigado) {
        const msgVinculo = `${msg}\n\nPra isso, você precisa ter uma conta no Portal Frutalense. Faça o login aqui:\n${process.env.SITE_URL}\n\nDepois volta aqui que a gente continua...`
        await Promise.all([salvarHistorico(conversa.id, historico, 'aguardando_vinculo', novosDados), enviarWhatsapp(telefone, msgVinculo)])
      } else {
        await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_registrar', novosDados), enviarWhatsapp(telefone, msg)])
      }
    } else {
      const enviado = await enviarTextoSeguro(telefone, resposta, 'Pode me contar um pouco mais sobre isso?')
      historico.push({ role: 'assistant', content: enviado })
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
    }
    return
  }

  // ── Etapa: aguardando vínculo de conta ──
  if (etapa === 'aguardando_vinculo') {
    if (perfilLigado) {
      // Conta vinculada — pula confirmação (quem voltou já quer registrar)
      // e vai direto para seleção de autoridade, igual ao "sim" em perguntar_registrar
      const { data: catEnt } = await supabaseServer.from('categoria_entidades').select('entidade_id').eq('categoria_id', dados.categoria_id || '')
      const ids = (catEnt || []).map((c) => c.entidade_id)
      if (ids.length === 0) {
        await Promise.all([salvarHistorico(conversa.id, historico, 'sem_autoridade', null), enviarWhatsapp(telefone, `Prontinho, conta vinculada! Mas ainda não tem nenhuma autoridade cadastrada para a categoria (${dados.categoria_nome}). Assim que tiver, pode tentar de novo. Posso ajudar com mais alguma coisa?`)])
        return
      }
      const { data: entidades } = await supabaseServer.from('entidades').select('id, nome, cargo').in('id', ids)
      const opcoes = entidades || []
      if (opcoes.length === 1) {
        dados.entidades_ids = [opcoes[0].id]
        dados.entidades_nomes = [opcoes[0].nome]
        const msg = `Prontinho, conta vinculada! Sua demanda vai ser direcionada para ${opcoes[0].nome} (${opcoes[0].cargo}). Agora me conta o endereço do local: rua e número, ou compartilhe sua localização aqui no WhatsApp.`
        historico.push({ role: 'assistant', content: msg })
        await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, msg)])
      } else {
        dados.opcoes_autoridade = opcoes
        historico.push({ role: 'user', content: 'sim' })
        const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'escolher_autoridade', opcoes_autoridade: opcoes, dados })
        const resposta = await chamarGemini(systemPrompt, historico)
        const fallback = `Prontinho, conta vinculada! Essa demanda pode ser direcionada para: ${opcoes.map(o => `${o.nome} (${o.cargo})`).join(', ')}. Qual delas você quer acionar?`
        const enviado = await enviarTextoSeguro(telefone, resposta, fallback)
        historico.push({ role: 'assistant', content: enviado })
        await salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados)
      }
    } else {
      await enviarWhatsapp(telefone, `Ainda não encontrei sua conta por aqui. Termina o cadastro no site — não esquece de colocar seu número de WhatsApp — e volta que a gente continua:\n${process.env.SITE_URL}`)
    }
    return
  }

  // ── Etapa: perguntar se quer registrar ──
  if (etapa === 'perguntar_registrar') {
    const positivo = ehPositivo(texto)
    const negativo = ehNegativo(texto)
    if (negativo) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Sem problemas! Posso ajudar com mais alguma coisa?')])
      return
    }
    if (!positivo) {
      await enviarWhatsapp(telefone, 'Não entendi direito — pode responder só com "sim" ou "não"?')
      return
    }

    const { data: catEnt } = await supabaseServer.from('categoria_entidades').select('entidade_id').eq('categoria_id', dados.categoria_id || '')
    const ids = (catEnt || []).map((c) => c.entidade_id)
    if (ids.length === 0) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'sem_autoridade', null), enviarWhatsapp(telefone, `Poxa, ainda não tem nenhuma autoridade cadastrada pra essa categoria (${dados.categoria_nome}). Assim que tiver, você pode tentar registrar de novo. Posso te ajudar com mais alguma coisa?`)])
      return
    }
    const { data: entidades } = await supabaseServer.from('entidades').select('id, nome, cargo').in('id', ids)
    const opcoes = entidades || []

    if (opcoes.length === 1) {
      // Só uma autoridade — pula a etapa de escolha, vai direto pro endereço
      dados.entidades_ids = [opcoes[0].id]
      dados.entidades_nomes = [opcoes[0].nome]
      historico.push({ role: 'user', content: 'sim' })
      const msg = `Beleza! Sua demanda vai ser direcionada para ${opcoes[0].nome} (${opcoes[0].cargo}). Agora me conta o endereço do local: rua e número, ou compartilhe sua localização aqui no WhatsApp.`
      historico.push({ role: 'assistant', content: msg })
      await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, msg)])
    } else {
      // Múltiplas autoridades — IA apresenta e pergunta
      dados.opcoes_autoridade = opcoes
      historico.push({ role: 'user', content: 'sim' })
      const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'escolher_autoridade', opcoes_autoridade: opcoes, dados })
      const resposta = await chamarGemini(systemPrompt, historico)
      const fallback = `Essa demanda pode ser direcionada para: ${opcoes.map(o => `${o.nome} (${o.cargo})`).join(', ')}. Qual delas você quer acionar?`
      const enviado = await enviarTextoSeguro(telefone, resposta, fallback)
      historico.push({ role: 'assistant', content: enviado })
      await salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados)
    }
    return
  }

  // ── Etapa: sem autoridade (encerra o fluxo, próxima msg volta ao normal) ──
  if (etapa === 'sem_autoridade') {
    await salvarHistorico(conversa.id, historico, 'nenhuma', null)
    const systemPrompt = await montarSystemPrompt(nomeUsuario)
    historico.push({ role: 'user', content: texto || '...' })
    const resposta = await chamarGemini(systemPrompt, historico)
    const enviado = await enviarTextoSeguro(telefone, resposta, 'Posso te ajudar com mais alguma coisa?')
    historico.push({ role: 'assistant', content: enviado })
    await salvarHistorico(conversa.id, historico, 'nenhuma', null)
    return
  }

  // ── Etapa: escolher autoridade — IA conduz, identifica escolha via JSON ──
  if (etapa === 'escolher_autoridade') {
    const opcoes = dados.opcoes_autoridade || []
    historico.push({ role: 'user', content: texto })
    const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'escolher_autoridade', opcoes_autoridade: opcoes, dados })
    const resposta = await chamarGemini(systemPrompt, historico)

    // O modelo às vezes envolve o JSON em texto ou em bloco markdown, então
    // procura o objeto em qualquer posição da resposta.
    const jsonAction = extrairAcao(resposta)

    if (jsonAction?.action === 'autoridade_escolhida') {
      const escolhidosIds = (jsonAction.entidade_ids as string[]) || []
      const escolhidosNomes = (jsonAction.entidade_nomes as string[]) || []
      // Só aceita ids que realmente estão na lista oferecida — o modelo às
      // vezes inventa um id ou repete um de outra categoria.
      const validos = escolhidosIds.filter((id) => opcoes.some((o) => o.id === id))

      if (validos.length > 0) {
        dados.entidades_ids = validos
        dados.entidades_nomes = validos.map((id) => opcoes.find((o) => o.id === id)!.nome)
        const msgConfirm = `Direcionada para: ${dados.entidades_nomes.join(', ')}. Me manda o endereço do local: rua e número, ou compartilhe sua localização aqui no WhatsApp.`
        historico.push({ role: 'assistant', content: msgConfirm })
        await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, msgConfirm)])
        return
      }

      console.warn('[escolher_autoridade] ids invalidos do modelo:', escolhidosIds, 'validos:', opcoes.map(o => o.id))
      const msgRepetir = `Não consegui identificar qual você quer. As opções são: ${opcoes.map(o => `${o.nome} (${o.cargo})`).join(', ')}. Qual delas?`
      historico.push({ role: 'assistant', content: msgRepetir })
      await Promise.all([salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados), enviarWhatsapp(telefone, msgRepetir)])
      return
    }

    // IA ainda está pedindo mais clareza ou apresentando opções
    const fallback = `As opções são: ${opcoes.map(o => `${o.nome} (${o.cargo})`).join(', ')}. Qual delas você quer acionar?`
    const enviado = await enviarTextoSeguro(telefone, resposta, fallback)
    historico.push({ role: 'assistant', content: enviado })
    await salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados)
    return
  }

  // ── Etapa: endereço (texto ou localização compartilhada) ──
  if (etapa === 'perguntar_endereco') {
    let lat: number | null = null
    let lng: number | null = null
    let label: string | null = null

    if (location?.degreesLatitude && location?.degreesLongitude) {
      lat = location.degreesLatitude
      lng = location.degreesLongitude
      label = 'Localização compartilhada pelo WhatsApp'
    } else if (texto) {
      const geo = await geocodificar(texto)
      if (!geo) {
        await enviarWhatsapp(telefone, 'Não consegui encontrar esse endereço perto de Frutal. Tenta descrever de outro jeito, ou manda sua localização direto pelo WhatsApp.')
        return
      }
      lat = geo.lat
      lng = geo.lng
      label = geo.label
    } else {
      await enviarWhatsapp(telefone, 'Pode me mandar o endereço em texto, ou compartilhar sua localização aqui pelo WhatsApp.')
      return
    }

    dados.lat = lat
    dados.lng = lng
    dados.endereco_label = label

    // Envia imagem de satélite para confirmar o local
    const urlSatelite = urlMapaSatelite(lat, lng)
    historico.push({ role: 'user', content: `Endereço informado: ${label}` })
    const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'confirmar_endereco', dados })
    const msgConfirm = await chamarGemini(systemPrompt, historico)

    await enviarImagemWhatsapp(telefone, urlSatelite, label ?? undefined)
    const enviado = await enviarTextoSeguro(telefone, msgConfirm, 'Esse é o local certo? Responde "sim" ou "não".')
    historico.push({ role: 'assistant', content: enviado })
    await salvarHistorico(conversa.id, historico, 'confirmar_endereco', dados)
    return
  }

  // ── Etapa: confirmar endereço (após ver a imagem de satélite) ──
  if (etapa === 'confirmar_endereco') {
    const positivo = ehPositivo(texto)
    const negativo = ehNegativo(texto)

    if (negativo) {
      historico.push({ role: 'user', content: texto })
      const msg = 'Tudo bem! Me manda o endereço correto: rua e número, ou compartilhe sua localização aqui no WhatsApp.'
      historico.push({ role: 'assistant', content: msg })
      dados.lat = undefined
      dados.lng = undefined
      dados.endereco_label = undefined
      await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, msg)])
      return
    }

    if (!positivo) {
      await enviarWhatsapp(telefone, 'Esse é o local certo? Responde com "sim" ou "não".')
      return
    }

    // Endereço confirmado — IA pergunta sobre foto
    historico.push({ role: 'user', content: texto })
    const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'perguntar_foto', dados })
    const msgFoto = await chamarGemini(systemPrompt, historico)
    const enviado = await enviarTextoSeguro(telefone, msgFoto, 'Você tem alguma foto do local pra anexar? Se preferir seguir sem, responde "sem foto".')
    historico.push({ role: 'assistant', content: enviado })
    await salvarHistorico(conversa.id, historico, 'perguntar_foto', dados)
    return
  }

  // ── Etapa: foto ──
  if (etapa === 'perguntar_foto') {
    if (temImagem && key?.id) {
      const midia = await baixarMidiaWhatsapp(key)
      if (midia) {
        try {
          // sharp é módulo nativo pesado: importar sob demanda evita carregá-lo
          // em toda invocação, inclusive nas mensagens que são só texto.
          const { default: sharp } = await import('sharp')
          const bufferOriginal = Buffer.from(midia.base64, 'base64')
          const bufferComprimido = await sharp(bufferOriginal)
            .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 50 })
            .toBuffer()
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const { error: uploadError } = await supabaseServer.storage.from('demandas-fotos').upload(path, bufferComprimido, { contentType: 'image/jpeg' })
          if (!uploadError) {
            dados.foto_url = supabaseServer.storage.from('demandas-fotos').getPublicUrl(path).data.publicUrl
          }
        } catch (e) {
          console.error('[foto] falha ao comprimir/subir:', e)
        }
      }
      if (!dados.foto_url) await enviarWhatsapp(telefone, 'Não consegui processar essa foto, mas sem problema, vou seguir sem ela.')
    } else if (/^(sem foto|pular|n[aã]o)/i.test(texto)) {
      dados.foto_url = null
    } else {
      await enviarWhatsapp(telefone, 'Pode mandar uma foto, ou só responder "sem foto" se preferir seguir sem ela.')
      return
    }

    // IA gera o resumo
    historico.push({ role: 'user', content: dados.foto_url ? '[Foto enviada]' : 'Sem foto' })
    const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'resumo', dados })
    const resumo = await chamarGemini(systemPrompt, historico)
    const resumoFallback = [
      'Confere os dados da sua demanda:',
      `• Problema: ${dados.descricao}`,
      `• Categoria: ${dados.categoria_nome}`,
      `• Direcionada para: ${(dados.entidades_nomes || []).join(', ')}`,
      `• Endereço: ${dados.endereco_label}`,
      `• Foto: ${dados.foto_url ? 'enviada' : 'não enviada'}`,
      '',
      'Responde "confirmar" pra registrar, ou "cancelar" pra desistir.',
    ].join('\n')
    const enviado = await enviarTextoSeguro(telefone, resumo, resumoFallback)
    historico.push({ role: 'assistant', content: enviado })
    await salvarHistorico(conversa.id, historico, 'resumo', dados)
    return
  }

  // ── Etapa: resumo / confirmação final ──
  if (etapa === 'resumo') {
    if (/^cancelar/i.test(texto)) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Beleza, cancelei o registro. Posso ajudar com mais alguma coisa?')])
      return
    }
    if (!/^(confirmar|confirmo|sim|pode|ok|vai|registra|registrar)/i.test(texto)) {
      await enviarWhatsapp(telefone, 'Responde "confirmar" pra eu registrar, ou "cancelar" se quiser desistir.')
      return
    }
    if (!perfilLigado || !dados.lat || !dados.lng || !dados.categoria_id || !dados.entidades_ids?.length) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Ih, algo deu errado com os dados aqui. Vamos começar de novo — me conta qual é o problema?')])
      return
    }

    const { data: perfilCompleto } = await supabaseServer.from('perfis').select('nome, cpf').eq('id', perfilLigado.id).single()
    if (!perfilCompleto?.cpf) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, `Antes de registrar, preciso que você complete seu CPF no cadastro — é obrigatório. Entra no site aqui: ${process.env.SITE_URL}/perfil`)])
      return
    }

    const { data: demanda, error } = await supabaseServer.from('demandas').insert({
      user_id: perfilLigado.id,
      morador_nome: perfilCompleto.nome,
      morador_cpf: perfilCompleto.cpf,
      descricao: dados.descricao,
      lat: dados.lat,
      lng: dados.lng,
      categoria_id: dados.categoria_id,
      entidade_id: dados.entidades_ids[0],
      foto_url: dados.foto_url || null,
      endereco_label: dados.endereco_label,
      status: 'pendente',
    }).select().single()

    if (error || !demanda) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Poxa, deu um erro ao registrar sua demanda. Tenta de novo daqui a pouco?')])
      return
    }

    const vinculos = dados.entidades_ids.map((eid) => ({ demanda_id: demanda.id, entidade_id: eid, status: 'aguardando_resposta' }))
    await supabaseServer.from('demanda_entidades').insert(vinculos)

    try {
      await fetch(`${process.env.SITE_URL}/api/ia/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET! },
        body: JSON.stringify({ demanda_id: demanda.id }),
        signal: AbortSignal.timeout(20000),
      })
    } catch (e) {
      // não bloqueia — a demanda já foi criada e a análise pode rodar depois
      console.error('[ia/analisar] falhou:', e)
    }

    const msgConfirmacao = demanda.protocolo
      ? `Prontinho, sua demanda foi registrada! 🎉\n\nProtocolo: *${demanda.protocolo}*\n\nEla vai passar por uma análise com o nosso Agente de IA, e se aprovada, aparece no mapa e a(as) autoridades são notificadas. Posso ajudar com mais alguma coisa?`
      : 'Prontinho, sua demanda foi registrada! Ela vai passar por uma análise com o nosso Agente de IA, e se aprovada, aparece no mapa e a(as) autoridades são notificadas. Posso ajudar com mais alguma coisa?'
    await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, msgConfirmacao)])
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null
  if (!body || body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  // Responde imediatamente para não dar timeout na Evolution API
  // O processamento acontece em background via `after`
  const inicio = Date.now()
  after(
    processarMensagem(body)
      .then(() => console.log(`[webhook] processamento concluido em ${Date.now() - inicio}ms`))
      .catch((e) => console.error(`[webhook] falhou apos ${Date.now() - inicio}ms:`, e))
  )

  return NextResponse.json({ ok: true })
}
