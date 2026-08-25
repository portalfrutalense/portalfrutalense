import { NextRequest, NextResponse, after } from 'next/server'
import sharp from 'sharp'
import { supabaseServer } from '@/lib/supabase-server'
import { enviarWhatsapp, enviarImagemWhatsapp, baixarMidiaWhatsapp } from '@/lib/whatsapp'

const FRUTAL_LAT = -20.02752
const FRUTAL_LNG = -48.92702
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

interface EvolutionWebhookBody {
  event?: string
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string; [k: string]: unknown }
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
      locationMessage?: { degreesLatitude?: number; degreesLongitude?: number }
      imageMessage?: unknown
      audioMessage?: unknown
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
    const res = await fetch(url)
    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature || feature.relevance < 0.85) return null
    const [lng, lat] = feature.center
    if (!dentroFrutal(lat, lng)) return null
    return { lat, lng, label: endereco }
  } catch {
    return null
  }
}

// Gera URL da imagem de satélite com pin via Mapbox Static API
function urlMapaSatelite(lat: number, lng: number): string {
  const pin = `pin-s+e53935(${lng},${lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${pin}/${lng},${lat},17,0/600x400@2x?access_token=${MAPBOX_TOKEN}`
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

  const promptBase = `Você é um assistente virtual do CidadanIA Frutal, conversando por WhatsApp com ${nomeUsuario}.
${cfg.nome_bot ? `\nSeu nome é ${cfg.nome_bot}.` : ''}
${cfg.descricao_bot ? `\n${cfg.descricao_bot}` : ''}
${cfg.tom_voz ? `\nTOM DE VOZ:\n${cfg.tom_voz}` : ''}
${cfg.responsabilidades ? `\nSUAS RESPONSABILIDADES:\n${cfg.responsabilidades}` : ''}

BASE DE CONHECIMENTO:
${baseTexto || '(nenhuma informação cadastrada ainda)'}

CATEGORIAS DE DEMANDAS DISPONÍVEIS:
${categoriasTexto || '(nenhuma categoria)'}

DETECÇÃO DE DEMANDA:
Se o cidadão relatar um problema urbano, responda EXATAMENTE com este JSON (nada mais):
{"action":"detectar_demanda","descricao":"<resumo objetivo>","categoria_id":"<id da categoria>","categoria_nome":"<nome da categoria>"}
Se nenhuma categoria for adequada, use categoria_nome:"Outros" e categoria_id:"".
Se não for um relato de problema, responda normalmente em texto.

REGRAS:
- Fale de um jeito natural e caloroso, como numa conversa real de WhatsApp
- Respostas objetivas, sem enrolação, mas sem soar seco ou frio
- Nunca use emojis
- Nunca invente informações que não estão na base de conhecimento

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

Apresente as opções de forma natural e pergunte qual(is) o cidadão quer acionar (até 3).
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

async function chamarGemini(
  systemPrompt: string,
  historico: { role: string; content: string }[],
  audio?: { base64: string; mimetype: string }
) {
  const contents: { role: string; parts: ParteGemini[] }[] = historico.map((m) => ({
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents }),
    }
  )
  if (!res.ok) return 'Desculpe, tive um problema pra processar sua mensagem. Tente novamente.'
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar sua mensagem.'
}

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

  // Evita reprocessar a mesma mensagem duas vezes (webhook duplicado)
  const messageId = key?.id
  if (messageId && conversa.ultimo_message_id === messageId) return
  if (messageId) await supabaseServer.from('whatsapp_conversas').update({ ultimo_message_id: messageId }).eq('id', conversa.id)

  const historico: { role: string; content: string }[] = conversa.historico || []
  const dados: DadosPendentes = conversa.dados_pendentes || {}
  const etapa: string = conversa.etapa || 'nenhuma'

  const { data: perfilLigado } = await supabaseServer.from('perfis').select('id, nome').eq('whatsapp', telefone).maybeSingle()
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

    const jsonMatch = resposta.match(/\{"action":"detectar_demanda"[^}]+\}/)
    if (jsonMatch) {
      try {
        const payload = JSON.parse(jsonMatch[0])
        const novosDados: DadosPendentes = {
          descricao: payload.descricao || texto || 'Problema relatado por áudio',
          categoria_id: payload.categoria_id || '',
          categoria_nome: payload.categoria_nome || 'Outros',
        }

        // Mensagem fixa para perguntar sobre registro — evita segunda chamada ao Gemini
        const variacoes = [
          `Entendido! Quer que eu registre essa demanda no sistema? Ela ficará visível no mapa e a autoridade responsável será notificada. (sim ou não)`,
          `Recebi! Posso registrar essa demanda pra você? Ela vai aparecer no mapa público e a autoridade responsável será acionada. (sim ou não)`,
          `Anotei o problema. Quer registrar essa demanda oficialmente? Ela ficará no mapa e a autoridade competente será notificada. (sim ou não)`,
        ]
        const msg = variacoes[Math.floor(Math.random() * variacoes.length)]
        historico.push({ role: 'assistant', content: msg })

        if (!perfilLigado) {
          const linkVinculo = `${process.env.NEXT_PUBLIC_SITE_URL}/vincular-whatsapp?tel=${telefone}`
          const msgVinculo = `Antes de registrar, preciso confirmar sua identidade. Entre nesse link pra vincular sua conta:\n${linkVinculo}\n\nDepois de vincular, volta aqui que a gente continua.`
          await Promise.all([salvarHistorico(conversa.id, historico, 'aguardando_vinculo', novosDados), enviarWhatsapp(telefone, msgVinculo)])
        } else {
          await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_registrar', novosDados), enviarWhatsapp(telefone, msg)])
        }
      } catch {
        await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, resposta)])
      }
    } else {
      historico.push({ role: 'assistant', content: resposta })
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, resposta)])
    }
    return
  }

  // ── Etapa: aguardando vínculo de conta ──
  if (etapa === 'aguardando_vinculo') {
    if (perfilLigado) {
      await Promise.all([
        salvarHistorico(conversa.id, historico, 'perguntar_registrar', dados),
        enviarWhatsapp(telefone, `Prontinho, sua conta foi vinculada! Vamos continuar: confirma que quer registrar "${dados.descricao}"? (sim ou não)`),
      ])
    } else {
      const linkVinculo = `${process.env.NEXT_PUBLIC_SITE_URL}/vincular-whatsapp?tel=${telefone}`
      await enviarWhatsapp(telefone, `Ainda não vi sua conta vinculada por aqui. Termina o cadastro nesse link e volta que a gente continua:\n${linkVinculo}`)
    }
    return
  }

  // ── Etapa: perguntar se quer registrar ──
  if (etapa === 'perguntar_registrar') {
    const positivo = /^(sim|s|quero|pode|claro|ok)/i.test(texto)
    const negativo = /^(n[aã]o|n)/i.test(texto)
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
      const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'perguntar_endereco_direto', dados })
      const msg = `Beleza! Sua demanda vai ser direcionada para ${opcoes[0].nome} (${opcoes[0].cargo}). Agora me conta: qual o endereço do local? Pode digitar ou compartilhar sua localização aqui no WhatsApp.`
      historico.push({ role: 'assistant', content: msg })
      void systemPrompt // montarSystemPrompt foi chamado só pra manter padrão — mensagem é fixa aqui
      await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, msg)])
    } else {
      // Múltiplas autoridades — IA apresenta e pergunta
      dados.opcoes_autoridade = opcoes
      historico.push({ role: 'user', content: 'sim' })
      const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'escolher_autoridade', opcoes_autoridade: opcoes, dados })
      const resposta = await chamarGemini(systemPrompt, historico)
      historico.push({ role: 'assistant', content: resposta })
      await Promise.all([salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados), enviarWhatsapp(telefone, resposta)])
    }
    return
  }

  // ── Etapa: sem autoridade (encerra o fluxo, próxima msg volta ao normal) ──
  if (etapa === 'sem_autoridade') {
    await salvarHistorico(conversa.id, historico, 'nenhuma', null)
    const systemPrompt = await montarSystemPrompt(nomeUsuario)
    historico.push({ role: 'user', content: texto || '...' })
    const resposta = await chamarGemini(systemPrompt, historico)
    historico.push({ role: 'assistant', content: resposta })
    await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, resposta)])
    return
  }

  // ── Etapa: escolher autoridade — IA conduz, identifica escolha via JSON ──
  if (etapa === 'escolher_autoridade') {
    const opcoes = dados.opcoes_autoridade || []
    historico.push({ role: 'user', content: texto })
    const systemPrompt = await montarSystemPrompt(nomeUsuario, { etapa: 'escolher_autoridade', opcoes_autoridade: opcoes, dados })
    const resposta = await chamarGemini(systemPrompt, historico)

    // Tenta parsear como JSON de ação pura
    let jsonAction: Record<string, unknown> | null = null
    try {
      const trimmed = resposta.trim()
      if (trimmed.startsWith('{')) jsonAction = JSON.parse(trimmed)
    } catch { /* não é JSON */ }

    if (jsonAction?.action === 'autoridade_escolhida') {
      const escolhidosIds = (jsonAction.entidade_ids as string[]) || []
      const escolhidosNomes = (jsonAction.entidade_nomes as string[]) || []
      dados.entidades_ids = escolhidosIds
      dados.entidades_nomes = escolhidosNomes
      const msgConfirm = `Ótimo! Direcionada para: ${escolhidosNomes.join(', ')}. Agora me conta onde fica o local — pode digitar o endereço ou compartilhar sua localização aqui no WhatsApp.`
      historico.push({ role: 'assistant', content: msgConfirm })
      await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, msgConfirm)])
    } else {
      // IA ainda está pedindo mais clareza ou apresentando opções
      historico.push({ role: 'assistant', content: resposta })
      await Promise.all([salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados), enviarWhatsapp(telefone, resposta)])
    }
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
    historico.push({ role: 'assistant', content: msgConfirm })

    await Promise.all([
      salvarHistorico(conversa.id, historico, 'confirmar_endereco', dados),
      enviarImagemWhatsapp(telefone, urlSatelite, label ?? undefined),
    ])
    await enviarWhatsapp(telefone, msgConfirm)
    return
  }

  // ── Etapa: confirmar endereço (após ver a imagem de satélite) ──
  if (etapa === 'confirmar_endereco') {
    const positivo = /^(sim|s|é|isso|correto|certo|ok|esse mesmo|exato|confirmo)/i.test(texto)
    const negativo = /^(n[aã]o|errado|incorreto|outro|diferente)/i.test(texto)

    if (negativo) {
      historico.push({ role: 'user', content: texto })
      const msg = 'Tudo bem! Me manda o endereço correto então — pode digitar ou compartilhar sua localização pelo WhatsApp.'
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
    historico.push({ role: 'assistant', content: msgFoto })
    await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_foto', dados), enviarWhatsapp(telefone, msgFoto)])
    return
  }

  // ── Etapa: foto ──
  if (etapa === 'perguntar_foto') {
    if (temImagem && key?.id) {
      const midia = await baixarMidiaWhatsapp(key)
      if (midia) {
        try {
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
        } catch {
          // Falha ao comprimir/subir — segue sem foto
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
    historico.push({ role: 'assistant', content: resumo })
    await Promise.all([salvarHistorico(conversa.id, historico, 'resumo', dados), enviarWhatsapp(telefone, resumo)])
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
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, `Antes de registrar, preciso que você complete seu CPF no cadastro — é obrigatório. Entra no site aqui: ${process.env.NEXT_PUBLIC_SITE_URL}/perfil`)])
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
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ia/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET! },
        body: JSON.stringify({ demanda_id: demanda.id }),
      })
    } catch {
      // não bloqueia — demanda já foi criada
    }

    await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Prontinho, sua demanda foi registrada! Ela vai passar por uma análise com o nosso Agente de IA, e se aprovada, aparece no mapa e a(as) autoridades são notificadas. Posso ajudar com mais alguma coisa?')])
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null
  if (!body || body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  // Responde imediatamente para não dar timeout na Evolution API
  // O processamento acontece em background via `after`
  after(processarMensagem(body))

  return NextResponse.json({ ok: true })
}
