import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { segredoValido } from '@/lib/auth-api'

/**
 * Webhook da Resend — recebe eventos de entrega de email.
 * Configurar no painel da Resend: https://resend.com/webhooks
 * URL: https://SEU_DOMINIO/api/webhooks/resend
 * Eventos a ativar: email.sent, email.delivered, email.bounced, email.complained, email.delivery_delayed
 *
 * A verificação de assinatura usa o RESEND_WEBHOOK_SECRET (gerado no painel da Resend).
 */

const RESEND_STATUS: Record<string, string> = {
  'email.sent':              'enviado',
  'email.delivered':         'entregue',
  'email.delivery_delayed':  'atrasado',
  'email.bounced':           'bounce',
  'email.complained':        'reclamado',
}

// Ordem de "quão definitivo" cada status é — um evento atrasado na entrega
// (webhooks não garantem ordem) não deve regredir um status já mais final.
// Índice maior = mais definitivo.
const PRIORIDADE_STATUS = ['enviado', 'atrasado', 'reclamado', 'bounce', 'entregue']

interface EventoResend {
  type?: string
  data?: { email_id?: string }
}

export async function POST(req: NextRequest) {
  try {
    // Verificação de assinatura OBRIGATÓRIA — sem RESEND_WEBHOOK_SECRET
    // configurado, o endpoint recusa toda chamada em vez de aceitar sem
    // checar origem. Configure em resend.com/webhooks e no .env.
    const secret = process.env.RESEND_WEBHOOK_SECRET
    if (!secret) {
      console.error('[webhook/resend] RESEND_WEBHOOK_SECRET não configurado — recusando chamada.')
      return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 401 })
    }

    const svixId        = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Assinatura ausente.' }, { status: 401 })
    }

    // Verificação manual da assinatura HMAC (sem dependência extra)
    // O segredo Svix é base64 — precisa decodificar antes de usar como chave
    const body = await req.text()
    const mensagem = `${svixId}.${svixTimestamp}.${body}`
    const encoder = new TextEncoder()
    const keyData = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const assinatura = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(mensagem))
    const assinaturaB64 = btoa(String.fromCharCode(...new Uint8Array(assinatura)))

    // Comparação de tempo constante — Array.includes() usa === entre strings,
    // que retorna assim que acha a primeira diferença e vaza, por timing,
    // quantos caracteres da assinatura correta já foram acertados. Mesma
    // classe de falha que segredoValido evita em todo o resto do projeto.
    const assinaturasRecebidas = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''))
    const assinaturaValida = assinaturasRecebidas.some(candidata => segredoValido(candidata, assinaturaB64))
    if (!assinaturaValida) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
    }

    const payload = JSON.parse(body) as EventoResend
    return await processarEvento(payload)
  } catch (err) {
    console.error('[webhook/resend] Erro:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Não deixa um evento atrasado (webhooks não garantem ordem) regredir um status já mais definitivo. */
function podeAvancar(statusAtual: string | null | undefined, novoStatus: string): boolean {
  if (!statusAtual) return true
  const atual = PRIORIDADE_STATUS.indexOf(statusAtual)
  const novo = PRIORIDADE_STATUS.indexOf(novoStatus)
  if (atual === -1 || novo === -1) return true
  return novo >= atual
}

async function processarEvento(payload: EventoResend) {
  const tipo     = payload?.type
  const emailId  = payload?.data?.email_id

  if (!emailId || !tipo) {
    return NextResponse.json({ ok: true }) // evento desconhecido — ignorar
  }

  const novoStatus = RESEND_STATUS[tipo]
  if (!novoStatus) {
    return NextResponse.json({ ok: true }) // tipo sem mapeamento — ignorar
  }

  let atualizado = false

  // O email_id é sempre de um envio "legado" (coluna em demandas) OU de um
  // vínculo por autoridade (demanda_entidades) — nunca os dois ao mesmo
  // tempo, então uma única consulta por tabela já cobre os dois casos.
  const { data: demanda } = await supabaseServer
    .from('demandas')
    .select('id, email_status')
    .eq('email_resend_id', emailId)
    .maybeSingle()

  if (demanda?.id && podeAvancar(demanda.email_status, novoStatus)) {
    const { error } = await supabaseServer
      .from('demandas')
      .update({ email_status: novoStatus })
      .eq('id', demanda.id)
    if (error) console.error('[webhook/resend] falha ao atualizar demandas:', error)
    else atualizado = true
  }

  const { data: vinculo } = await supabaseServer
    .from('demanda_entidades')
    .select('id, email_status')
    .eq('email_resend_id', emailId)
    .maybeSingle()

  if (vinculo?.id && podeAvancar(vinculo.email_status, novoStatus)) {
    const { error } = await supabaseServer
      .from('demanda_entidades')
      .update({ email_status: novoStatus })
      .eq('id', vinculo.id)
    if (error) console.error('[webhook/resend] falha ao atualizar demanda_entidades:', error)
    else atualizado = true
  }

  console.log(`[webhook/resend] ${tipo} → ${emailId} → ${novoStatus}${atualizado ? '' : ' (nenhum registro correspondente)'}`)
  return NextResponse.json({ ok: true })
}
