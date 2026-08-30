import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Webhook da Resend — recebe eventos de entrega de email.
 * Configurar no painel da Resend: https://resend.com/webhooks
 * URL: https://SEU_DOMINIO/api/webhooks/resend
 * Eventos a ativar: email.delivered, email.bounced, email.complained, email.delivery_delayed
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

    const assinaturasRecebidas = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''))
    if (!assinaturasRecebidas.includes(assinaturaB64)) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    return await processarEvento(payload)
  } catch (err) {
    console.error('[webhook/resend] Erro:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

async function processarEvento(payload: any) {
  const tipo     = payload?.type as string
  const emailId  = payload?.data?.email_id as string

  if (!emailId || !tipo) {
    return NextResponse.json({ ok: true }) // evento desconhecido — ignorar
  }

  const novoStatus = RESEND_STATUS[tipo]
  if (!novoStatus) {
    return NextResponse.json({ ok: true }) // tipo sem mapeamento — ignorar
  }

  // Atualiza demandas que têm este email_resend_id
  const { data: demanda } = await supabaseServer
    .from('demandas')
    .select('id')
    .eq('email_resend_id', emailId)
    .maybeSingle()

  if (demanda?.id) {
    await supabaseServer
      .from('demandas')
      .update({ email_status: novoStatus })
      .eq('id', demanda.id)
  }

  // Atualiza demanda_entidades que têm este email_resend_id
  const { data: vinculo } = await supabaseServer
    .from('demanda_entidades')
    .select('id')
    .eq('email_resend_id', emailId)
    .maybeSingle()

  if (vinculo?.id) {
    await supabaseServer
      .from('demanda_entidades')
      .update({ email_status: novoStatus })
      .eq('id', vinculo.id)
  }

  console.log(`[webhook/resend] ${tipo} → ${emailId} → ${novoStatus}`)
  return NextResponse.json({ ok: true })
}
