import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'
import { gerarToken } from '@/lib/token'
import { escapeHtml } from '@/lib/escapeHtml'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function montarEmailHtml(nomeEntidade: string, moradorNome: string, descricao: string, enderecoLabel: string | null, linkResposta: string) {
  return `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
          <div style="background:#4256c8;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;font-size:18px;margin:0;">CidadanIA Frutal</h1>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0;">Frutal-MG · Transparência e Cidadania</p>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
            <p style="font-size:15px;color:#111827;">Olá, <strong>${escapeHtml(nomeEntidade)}</strong>,</p>
            <p style="font-size:14px;color:#111827;line-height:1.6;">
              Este é um reenvio do link para responder a demanda do cidadão <strong>${escapeHtml(moradorNome)}</strong>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Descrição da demanda</p>
              <p style="font-size:14px;color:#111827;margin:0;line-height:1.6;">${escapeHtml(descricao)}</p>
              ${enderecoLabel ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${escapeHtml(enderecoLabel)}</p>` : ''}
            </div>
            <a href="${linkResposta}" style="display:block;background:#4256c8;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0;">
              Responder esta demanda →
            </a>
          </div>
        </div>
      `
}

export async function POST(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const { demanda_id } = await req.json()
    if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

    const { data: demanda, error } = await supabaseServer
      .from('demandas')
      .select('*, entidade:entidades(nome, cargo, email)')
      .eq('id', demanda_id)
      .single()

    if (error || !demanda) return NextResponse.json({ error: 'Demanda não encontrada.' }, { status: 404 })

    const expiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias

    // Demanda atual (multi-autoridade) — reenvia um token novo pra cada
    // autoridade vinculada, igual ao que /api/master/moderar-demanda (ação
    // "aprovar") e /api/ia/analisar já fazem. Reenviar só pra
    // demanda.entidade (coluna legada, sempre a primeira autoridade) deixava
    // a 2ª e 3ª autoridade de fora do reenvio.
    const { data: vinculos } = await supabaseServer
      .from('demanda_entidades')
      .select('id, status, entidade:entidades(nome, cargo, email)')
      .eq('demanda_id', demanda_id)

    let algumEmailEnviado = false

    if (vinculos?.length) {
      for (const vinculo of vinculos) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = vinculo as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ent = v.entidade as any
        if (!ent?.email) continue
        // BUG CORRIGIDO: o loop não filtrava vínculos já respondidos —
        // reenviar link regredia o vínculo pra 'aguardando_resposta' e gerava
        // um magic_token novo e válido mesmo pra quem já tinha publicado
        // resposta, deixando o vínculo aceitar uma segunda resposta por cima
        // da antiga (que continuava salva, mas sem valer mais nada).
        if (v.status === 'respondida') continue

        // BUG CORRIGIDO: o token era rotacionado e o status regredido pra
        // 'aguardando_resposta' ANTES de saber se o e-mail ia sair —
        // mesmo quando a rota terminava em 400 ("nenhuma autoridade tem
        // e-mail"), os tokens de quem tinha e-mail já tinham sido
        // rotacionados, invalidando o link antigo mesmo numa tentativa que
        // "falhou". Gera o token e manda o e-mail primeiro; só grava no
        // banco (e só então o link antigo deixa de valer) se o envio
        // realmente for aceito pela Resend. Também captura o `error` do
        // Resend, antes descartado (mesmo padrão do Erro #30/B22-3, nunca
        // corrigido nesta rota).
        const novoToken = gerarToken()
        const linkResposta = `${process.env.SITE_URL}/responder/${novoToken}`
        const { data: emailEnviado, error: erroEmail } = await resend.emails.send({
          from: 'CidadanIA Frutal <noreply@cidadaniafrutal.com.br>',
          to: ent.email,
          subject: `[REENVIO] Demanda aguardando sua resposta — CidadanIA Frutal`,
          html: montarEmailHtml(ent.nome, demanda.morador_nome, demanda.descricao, demanda.endereco_label, linkResposta),
        })
        if (emailEnviado?.id) {
          await supabaseServer.from('demanda_entidades').update({
            magic_token: novoToken,
            magic_token_expira_em: expiracao,
            link_enviado: true,
            status: 'aguardando_resposta',
            email_resend_id: emailEnviado.id,
            email_status: 'enviado',
          }).eq('id', vinculo.id)
          algumEmailEnviado = true
        } else {
          console.error(`[reenviar-link-demanda] Falha ao enviar e-mail para ${ent.email} (demanda ${demanda_id}):`, erroEmail)
        }
      }
      // BUG CORRIGIDO: faltavam os mesmos guardas que /api/autoridade/responder
      // já usa — sem eles, reenviar link numa demanda 'resolvida' ou
      // 'denunciada' (em moderação do master) tirava ela desses estados sem
      // querer, só por causa do reenvio.
      await supabaseServer.from('demandas').update({ status: 'aguardando_resposta' })
        .eq('id', demanda_id).neq('status', 'resolvida').neq('status', 'denunciada')
    }

    if (!algumEmailEnviado) return NextResponse.json({ error: 'Nenhuma autoridade vinculada tem e-mail cadastrado.' }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
