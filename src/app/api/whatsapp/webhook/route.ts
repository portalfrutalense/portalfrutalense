import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseServer } from '@/lib/supabase-server'
import { enviarWhatsapp, baixarMidiaWhatsapp } from '@/lib/whatsapp'

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

async function montarSystemPrompt(nomeUsuario: string) {
  const [{ data: base }, { data: categorias }, { data: chatConfig }] = await Promise.all([
    supabaseServer.from('chatbot_base').select('titulo, conteudo').eq('ativo', true),
    supabaseServer.from('categorias_mapa').select('id, nome').eq('ativo', true),
    supabaseServer.from('chatbot_config').select('nome_bot, descricao_bot, tom_voz, responsabilidades, prompt_extra').eq('id', 1).maybeSingle(),
  ])
  const baseTexto = (base || []).map((e) => `### ${e.titulo}\n${e.conteudo}`).join('\n\n')
  const categoriasTexto = (categorias || []).map((c) => `- ${c.nome} (id: ${c.id})`).join('\n')
  const cfg = chatConfig || ({} as Record<string, string>)

  return `Você é um assistente virtual do CidadanIA Frutal, conversando por WhatsApp com ${nomeUsuario}.
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
- Fale de um jeito natural e caloroso, como numa conversa real de WhatsApp — nada de tom robótico ou de atendimento automático. Pode usar contrações e expressões do dia a dia.
- Respostas objetivas, sem enrolação, mas sem soar seco ou frio.
- Nunca use emojis.
- Nunca invente informações que não estão na base de conhecimento.
${cfg.prompt_extra ? `\nINSTRUÇÕES ADICIONAIS:\n${cfg.prompt_extra}` : ''}`
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

  // A última entrada do histórico é a mensagem atual do usuário. Se veio áudio,
  // troca a parte de texto pela parte de áudio (o Gemini entende o conteúdo falado
  // diretamente, sem precisar de transcrição separada).
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

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null
  if (!body || body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  const key = body.data?.key
  const remoteJid = key?.remoteJid || ''
  if (key?.fromMe) return NextResponse.json({ ok: true })
  if (!remoteJid.endsWith('@s.whatsapp.net')) return NextResponse.json({ ok: true })

  const telefone = remoteJid.replace('@s.whatsapp.net', '')
  const texto = (body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || '').trim()
  const location = body.data?.message?.locationMessage
  const temImagem = body.data?.messageType === 'imageMessage'
  const temAudio = body.data?.messageType === 'audioMessage'

  if (!texto && !location && !temImagem && !temAudio) return NextResponse.json({ ok: true })

  // Busca ou cria a conversa
  let { data: conversa } = await supabaseServer.from('whatsapp_conversas').select('*').eq('telefone', telefone).single()
  if (!conversa) {
    const { data: nova } = await supabaseServer.from('whatsapp_conversas').insert({ telefone }).select().single()
    conversa = nova
  }
  if (!conversa) return NextResponse.json({ ok: true })

  // Evita reprocessar a mesma mensagem duas vezes (webhook duplicado)
  const messageId = key?.id
  if (messageId && conversa.ultimo_message_id === messageId) return NextResponse.json({ ok: true })
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
        return NextResponse.json({ ok: true })
      }
      audioParaGemini = midia
      historico.push({ role: 'user', content: '[Áudio]' })
    } else {
      await enviarWhatsapp(telefone, 'Recebi o que você mandou, mas por enquanto só consigo entender texto ou áudio por aqui.')
      return NextResponse.json({ ok: true })
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
        const msg = 'Parece que você quer relatar um problema! Posso registrar essa demanda pra você — ela fica visível no mapa e a autoridade responsável é notificada. Quer que eu registre? (sim ou não)'
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
    return NextResponse.json({ ok: true })
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
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: perguntar se quer registrar ──
  if (etapa === 'perguntar_registrar') {
    const positivo = /^(sim|s|quero|pode|claro|ok)/i.test(texto)
    const negativo = /^(n[aã]o|n)/i.test(texto)
    if (negativo) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Sem problemas! Posso ajudar com mais alguma coisa?')])
      return NextResponse.json({ ok: true })
    }
    if (!positivo) {
      await enviarWhatsapp(telefone, 'Não entendi direito — pode responder só com "sim" ou "não"?')
      return NextResponse.json({ ok: true })
    }

    const { data: catEnt } = await supabaseServer.from('categoria_entidades').select('entidade_id').eq('categoria_id', dados.categoria_id || '')
    const ids = (catEnt || []).map((c) => c.entidade_id)
    if (ids.length === 0) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Poxa, não tem nenhuma autoridade vinculada a essa categoria ainda, então não dá pra registrar por enquanto.')])
      return NextResponse.json({ ok: true })
    }
    const { data: entidades } = await supabaseServer.from('entidades').select('id, nome, cargo').in('id', ids)
    const opcoes = entidades || []

    if (opcoes.length === 1) {
      dados.entidades_ids = [opcoes[0].id]
      dados.entidades_nomes = [opcoes[0].nome]
      await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, `Beleza, sua demanda vai ser direcionada para ${opcoes[0].nome} (${opcoes[0].cargo}).\n\nAgora me conta: qual o endereço do local? Pode digitar ou, se preferir, é só compartilhar sua localização aqui pelo WhatsApp.`)])
    } else {
      dados.opcoes_autoridade = opcoes
      const lista = opcoes.map((o, i) => `${i + 1}. ${o.nome} — ${o.cargo}`).join('\n')
      await Promise.all([salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados), enviarWhatsapp(telefone, `Pra quem você quer direcionar essa demanda? Pode escolher até 3 (responde com os números, separados por vírgula):\n\n${lista}`)])
    }
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: escolher autoridade(s) ──
  if (etapa === 'escolher_autoridade') {
    const opcoes = dados.opcoes_autoridade || []
    const indices = texto.split(/[,e]/i).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= opcoes.length).slice(0, 3)
    if (indices.length === 0) {
      await enviarWhatsapp(telefone, 'Não entendi qual você escolheu — responde com o número da lista, tipo 1 ou 1,2.')
      return NextResponse.json({ ok: true })
    }
    const escolhidas = [...new Set(indices)].map((i) => opcoes[i - 1])
    dados.entidades_ids = escolhidas.map((e) => e.id)
    dados.entidades_nomes = escolhidas.map((e) => e.nome)
    await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados), enviarWhatsapp(telefone, `Beleza, direcionada para: ${dados.entidades_nomes.join(', ')}.\n\nAgora me conta: qual o endereço do local? Pode digitar ou, se preferir, é só compartilhar sua localização aqui pelo WhatsApp.`)])
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: endereço (texto ou localização) ──
  if (etapa === 'perguntar_endereco') {
    if (location?.degreesLatitude && location?.degreesLongitude) {
      dados.lat = location.degreesLatitude
      dados.lng = location.degreesLongitude
      dados.endereco_label = 'Localização compartilhada pelo WhatsApp'
      await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_foto', dados), enviarWhatsapp(telefone, 'Localização recebida! Se puder, envie uma foto do local — ajuda bastante a autoridade a entender o problema. Se não tiver, é só responder "sem foto".')])
      return NextResponse.json({ ok: true })
    }
    if (!texto) {
      await enviarWhatsapp(telefone, 'Pode me mandar o endereço em texto, ou compartilhar sua localização mesmo pelo WhatsApp.')
      return NextResponse.json({ ok: true })
    }
    const geo = await geocodificar(texto)
    if (!geo) {
      await enviarWhatsapp(telefone, 'Não consegui encontrar esse endereço perto de Frutal. Tenta descrever de outro jeito, ou manda sua localização direto pelo WhatsApp.')
      return NextResponse.json({ ok: true })
    }
    dados.lat = geo.lat
    dados.lng = geo.lng
    dados.endereco_label = geo.label
    await Promise.all([salvarHistorico(conversa.id, historico, 'perguntar_foto', dados), enviarWhatsapp(telefone, `Endereço confirmado: ${geo.label}\n\nSe puder, envie uma foto do local — ajuda bastante a autoridade a entender o problema. Se não tiver, é só responder "sem foto".`)])
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: foto ──
  if (etapa === 'perguntar_foto') {
    if (temImagem && key?.id) {
      const midia = await baixarMidiaWhatsapp(key)
      if (midia) {
        try {
          const bufferOriginal = Buffer.from(midia.base64, 'base64')
          // Comprime antes de subir pro Supabase — mesmo espírito da compressão
          // que o site já faz no navegador (máx. 600px, qualidade baixa)
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
          // Falha ao comprimir/subir — segue sem foto, avisado abaixo
        }
      }
      if (!dados.foto_url) await enviarWhatsapp(telefone, 'Não consegui processar essa foto, mas sem problema, vou seguir sem ela.')
    } else if (/^(sem foto|pular|n[aã]o)/i.test(texto)) {
      dados.foto_url = null
    } else {
      await enviarWhatsapp(telefone, 'Pode mandar uma foto, ou só responder "sem foto" se preferir seguir sem ela.')
      return NextResponse.json({ ok: true })
    }

    const resumo = `Prontinho! Dá uma conferida antes de eu registrar:\n\nEndereço: ${dados.endereco_label}\nCategoria: ${dados.categoria_nome}\nDirecionada para: ${dados.entidades_nomes?.join(', ')}\nDescrição: ${dados.descricao}\n${dados.foto_url ? 'Com foto anexada\n' : ''}\nPosso registrar? (confirmar ou cancelar)`
    await Promise.all([salvarHistorico(conversa.id, historico, 'resumo', dados), enviarWhatsapp(telefone, resumo)])
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: resumo / confirmação final ──
  if (etapa === 'resumo') {
    if (/^cancelar/i.test(texto)) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Beleza, cancelei o registro. Posso ajudar com mais alguma coisa?')])
      return NextResponse.json({ ok: true })
    }
    if (!/^confirmar/i.test(texto)) {
      await enviarWhatsapp(telefone, 'Só responde "confirmar" ou "cancelar" que eu sigo daqui.')
      return NextResponse.json({ ok: true })
    }
    if (!perfilLigado || !dados.lat || !dados.lng || !dados.categoria_id || !dados.entidades_ids?.length) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, 'Ih, algo deu errado com os dados aqui. Vamos começar de novo — me conta qual é o problema?')])
      return NextResponse.json({ ok: true })
    }

    const { data: perfilCompleto } = await supabaseServer.from('perfis').select('nome, cpf').eq('id', perfilLigado.id).single()
    if (!perfilCompleto?.cpf) {
      await Promise.all([salvarHistorico(conversa.id, historico, 'nenhuma', null), enviarWhatsapp(telefone, `Antes de registrar, preciso que você complete seu CPF no cadastro — é obrigatório. Entra no site aqui: ${process.env.NEXT_PUBLIC_SITE_URL}/perfil`)])
      return NextResponse.json({ ok: true })
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
      return NextResponse.json({ ok: true })
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
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
