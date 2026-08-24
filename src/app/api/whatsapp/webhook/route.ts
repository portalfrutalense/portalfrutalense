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
- Nunca use emojis.
- Respostas curtas e diretas, adequadas pra WhatsApp.
- Nunca invente informações que não estão na base de conhecimento.
${cfg.prompt_extra ? `\nINSTRUÇÕES ADICIONAIS:\n${cfg.prompt_extra}` : ''}`
}

async function chamarGemini(systemPrompt: string, historico: { role: string; content: string }[]) {
  const contents = historico.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
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

  if (!texto && !location && !temImagem) return NextResponse.json({ ok: true })

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
    if (!texto) { await enviarWhatsapp(telefone, 'Recebi seu envio, mas por enquanto só consigo processar texto nessa etapa.'); return NextResponse.json({ ok: true }) }

    historico.push({ role: 'user', content: texto })
    const systemPrompt = await montarSystemPrompt(nomeUsuario)
    const resposta = await chamarGemini(systemPrompt, historico)

    const jsonMatch = resposta.match(/\{"action":"detectar_demanda"[^}]+\}/)
    if (jsonMatch) {
      try {
        const payload = JSON.parse(jsonMatch[0])
        const novosDados: DadosPendentes = {
          descricao: payload.descricao || texto,
          categoria_id: payload.categoria_id || '',
          categoria_nome: payload.categoria_nome || 'Outros',
        }
        const msg = 'Detectei um possível problema pra registrar! Podemos abrir uma demanda sobre isso. Quer registrar? (responda sim ou não)'
        historico.push({ role: 'assistant', content: msg })

        if (!perfilLigado) {
          const linkVinculo = `${process.env.NEXT_PUBLIC_SITE_URL}/vincular-whatsapp?tel=${telefone}`
          const msgVinculo = `Antes de registrar, preciso confirmar sua identidade. Entre nesse link pra vincular sua conta:\n${linkVinculo}\n\nDepois de vincular, volta aqui que a gente continua.`
          await salvarHistorico(conversa.id, historico, 'aguardando_vinculo', novosDados)
          await enviarWhatsapp(telefone, msgVinculo)
        } else {
          await salvarHistorico(conversa.id, historico, 'perguntar_registrar', novosDados)
          await enviarWhatsapp(telefone, msg)
        }
      } catch {
        await salvarHistorico(conversa.id, historico, 'nenhuma', null)
        await enviarWhatsapp(telefone, resposta)
      }
    } else {
      historico.push({ role: 'assistant', content: resposta })
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, resposta)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: aguardando vínculo de conta ──
  if (etapa === 'aguardando_vinculo') {
    if (perfilLigado) {
      await salvarHistorico(conversa.id, historico, 'perguntar_registrar', dados)
      await enviarWhatsapp(telefone, `Conta vinculada! Confirma que quer registrar: "${dados.descricao}"? (responda sim ou não)`)
    } else {
      const linkVinculo = `${process.env.NEXT_PUBLIC_SITE_URL}/vincular-whatsapp?tel=${telefone}`
      await enviarWhatsapp(telefone, `Ainda não identifiquei sua conta vinculada. Termina o cadastro nesse link:\n${linkVinculo}`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: perguntar se quer registrar ──
  if (etapa === 'perguntar_registrar') {
    const positivo = /^(sim|s|quero|pode|claro|ok)/i.test(texto)
    const negativo = /^(n[aã]o|n)/i.test(texto)
    if (negativo) {
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, 'Sem problemas! Posso ajudar com mais alguma coisa?')
      return NextResponse.json({ ok: true })
    }
    if (!positivo) {
      await enviarWhatsapp(telefone, 'Não entendi — responde só "sim" ou "não".')
      return NextResponse.json({ ok: true })
    }

    const { data: catEnt } = await supabaseServer.from('categoria_entidades').select('entidade_id').eq('categoria_id', dados.categoria_id || '')
    const ids = (catEnt || []).map((c) => c.entidade_id)
    if (ids.length === 0) {
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, 'Não há autoridade vinculada a essa categoria no momento. Não é possível registrar agora.')
      return NextResponse.json({ ok: true })
    }
    const { data: entidades } = await supabaseServer.from('entidades').select('id, nome, cargo').in('id', ids)
    const opcoes = entidades || []

    if (opcoes.length === 1) {
      dados.entidades_ids = [opcoes[0].id]
      dados.entidades_nomes = [opcoes[0].nome]
      await salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados)
      await enviarWhatsapp(telefone, `Será direcionada para ${opcoes[0].nome} (${opcoes[0].cargo}).\n\nAgora me diga o endereço do local (ou envie sua localização pelo WhatsApp).`)
    } else {
      dados.opcoes_autoridade = opcoes
      const lista = opcoes.map((o, i) => `${i + 1}. ${o.nome} — ${o.cargo}`).join('\n')
      await salvarHistorico(conversa.id, historico, 'escolher_autoridade', dados)
      await enviarWhatsapp(telefone, `Escolha até 3 autoridades pra direcionar (responda com os números, separados por vírgula):\n\n${lista}`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: escolher autoridade(s) ──
  if (etapa === 'escolher_autoridade') {
    const opcoes = dados.opcoes_autoridade || []
    const indices = texto.split(/[,e]/i).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= opcoes.length).slice(0, 3)
    if (indices.length === 0) {
      await enviarWhatsapp(telefone, 'Não entendi a escolha. Responde com o número da lista (ex: 1 ou 1,2).')
      return NextResponse.json({ ok: true })
    }
    const escolhidas = [...new Set(indices)].map((i) => opcoes[i - 1])
    dados.entidades_ids = escolhidas.map((e) => e.id)
    dados.entidades_nomes = escolhidas.map((e) => e.nome)
    await salvarHistorico(conversa.id, historico, 'perguntar_endereco', dados)
    await enviarWhatsapp(telefone, `Direcionada para: ${dados.entidades_nomes.join(', ')}.\n\nAgora me diga o endereço do local (ou envie sua localização pelo WhatsApp).`)
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: endereço (texto ou localização) ──
  if (etapa === 'perguntar_endereco') {
    if (location?.degreesLatitude && location?.degreesLongitude) {
      dados.lat = location.degreesLatitude
      dados.lng = location.degreesLongitude
      dados.endereco_label = 'Localização compartilhada pelo WhatsApp'
      await salvarHistorico(conversa.id, historico, 'perguntar_foto', dados)
      await enviarWhatsapp(telefone, 'Localização recebida! Agora envie uma foto do local (ou responda "sem foto" pra pular).')
      return NextResponse.json({ ok: true })
    }
    if (!texto) {
      await enviarWhatsapp(telefone, 'Envie o endereço em texto, ou compartilhe sua localização pelo WhatsApp.')
      return NextResponse.json({ ok: true })
    }
    const geo = await geocodificar(texto)
    if (!geo) {
      await enviarWhatsapp(telefone, 'Não encontrei esse endereço perto de Frutal. Tente descrever melhor, ou envie sua localização pelo WhatsApp.')
      return NextResponse.json({ ok: true })
    }
    dados.lat = geo.lat
    dados.lng = geo.lng
    dados.endereco_label = geo.label
    await salvarHistorico(conversa.id, historico, 'perguntar_foto', dados)
    await enviarWhatsapp(telefone, `Endereço confirmado: ${geo.label}\n\nAgora envie uma foto do local (ou responda "sem foto" pra pular).`)
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
      if (!dados.foto_url) await enviarWhatsapp(telefone, 'Não consegui processar a foto, mas vou continuar sem ela.')
    } else if (/^(sem foto|pular|n[aã]o)/i.test(texto)) {
      dados.foto_url = null
    } else {
      await enviarWhatsapp(telefone, 'Envie uma foto, ou responda "sem foto" pra continuar sem ela.')
      return NextResponse.json({ ok: true })
    }

    await salvarHistorico(conversa.id, historico, 'resumo', dados)
    const resumo = `Tudo pronto! Confira antes de registrar:\n\n📍 ${dados.endereco_label}\n📁 ${dados.categoria_nome}\n👤 Direcionada para: ${dados.entidades_nomes?.join(', ')}\n📝 ${dados.descricao}\n${dados.foto_url ? '📷 Com foto' : ''}\n\nConfirma o registro? (responda confirmar ou cancelar)`
    await enviarWhatsapp(telefone, resumo)
    return NextResponse.json({ ok: true })
  }

  // ── Etapa: resumo / confirmação final ──
  if (etapa === 'resumo') {
    if (/^cancelar/i.test(texto)) {
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, 'Registro cancelado. Posso ajudar com mais alguma coisa?')
      return NextResponse.json({ ok: true })
    }
    if (!/^confirmar/i.test(texto)) {
      await enviarWhatsapp(telefone, 'Responde "confirmar" ou "cancelar".')
      return NextResponse.json({ ok: true })
    }
    if (!perfilLigado || !dados.lat || !dados.lng || !dados.categoria_id || !dados.entidades_ids?.length) {
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, 'Algo deu errado com os dados da demanda. Vamos começar de novo — descreva o problema.')
      return NextResponse.json({ ok: true })
    }

    const { data: perfilCompleto } = await supabaseServer.from('perfis').select('nome, cpf').eq('id', perfilLigado.id).single()
    if (!perfilCompleto?.cpf) {
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, `Sua conta ainda não tem CPF cadastrado (obrigatório pra registrar demanda). Complete seu cadastro no site: ${process.env.NEXT_PUBLIC_SITE_URL}/perfil`)
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
      await salvarHistorico(conversa.id, historico, 'nenhuma', null)
      await enviarWhatsapp(telefone, 'Erro ao registrar a demanda. Tente novamente mais tarde.')
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

    await salvarHistorico(conversa.id, historico, 'nenhuma', null)
    await enviarWhatsapp(telefone, 'Demanda registrada com sucesso! Ela vai aparecer no mapa após análise. Posso ajudar com mais alguma coisa?')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
