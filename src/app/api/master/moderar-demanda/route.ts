import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { gerarToken } from '@/lib/token'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function verificarMaster(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return null
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'master') return null
  return user
}

// POST /api/master/moderar-demanda  { demanda_id, acao: 'aprovar' | 'rejeitar' | 'ocultar' | 'reexibir', motivo? }
export async function POST(req: NextRequest) {
  const user = await verificarMaster(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const { demanda_id, acao, motivo } = await req.json()
    if (!demanda_id || !acao) return NextResponse.json({ error: 'demanda_id e acao são obrigatórios.' }, { status: 400 })

    if (acao === 'ocultar' || acao === 'reexibir') {
      const { error } = await supabaseServer.from('demandas').update({ oculto: acao === 'ocultar' }).eq('id', demanda_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (acao === 'reaprovar') {
      // Volta uma demanda denunciada pra circulação. Sem reenviar e-mail nem gerar
      // token novo — os magic_tokens que já existiam continuam válidos como estavam.
      // O status de volta é calculado, não guardado: se algum vínculo já tem resposta,
      // volta como "respondida"; senão, como "aguardando_resposta".
      const { data: vinculos } = await supabaseServer
        .from('demanda_entidades')
        .select('resposta')
        .eq('demanda_id', demanda_id)

      const jaRespondida = (vinculos || []).some(v => !!v.resposta)
      const { error } = await supabaseServer.from('demandas').update({
        status: jaRespondida ? 'respondida' : 'aguardando_resposta',
      }).eq('id', demanda_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (acao === 'rejeitar') {
      const { error } = await supabaseServer.from('demandas').update({
        status: 'rejeitada_ia',
        ia_decisao: 'rejeitada',
        ia_motivo: motivo?.trim() || 'Rejeitada manualmente pelo administrador.',
        ia_analisado_em: new Date().toISOString(),
      }).eq('id', demanda_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (acao === 'aprovar') {
      const { data: demanda } = await supabaseServer
        .from('demandas')
        .select('*, entidade:entidades(nome, cargo, email)')
        .eq('id', demanda_id).single()

      if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada.' }, { status: 404 })

      const expiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const motivoAprovacao = motivo?.trim() || 'Aprovada manualmente pelo administrador.'

      const { data: vinculos } = await supabaseServer
        .from('demanda_entidades')
        .select('id, entidade_id, entidade:entidades(nome, cargo, email)')
        .eq('demanda_id', demanda_id)

      await supabaseServer.from('demandas').update({
        status: 'aguardando_resposta',
        ia_decisao: 'aprovada',
        ia_motivo: motivoAprovacao,
        ia_analisado_em: new Date().toISOString(),
        link_enviado: true,
      }).eq('id', demanda_id)

      for (const vinculo of (vinculos || [])) {
        const token = gerarToken()
        await supabaseServer.from('demanda_entidades').update({
          magic_token: token,
          magic_token_expira_em: expiracao,
          link_enviado: true,
          status: 'aguardando_resposta',
        }).eq('id', vinculo.id)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ent = vinculo.entidade as any
        if (ent?.email) {
          const linkResposta = `${process.env.SITE_URL}/responder/${token}`
          await resend.emails.send({
            from: 'CidadanIA Frutal <noreply@cidadaniafrutal.com.br>',
            to: ent.email,
            subject: `Nova demanda para ${ent.nome} — CidadanIA Frutal`,
            html: `
              <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
                <div style="background:#4256c8;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
                  <h1 style="color:white;font-size:18px;margin:0;">CidadanIA Frutal</h1>
                  <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0;">Frutal-MG · Transparência e Cidadania</p>
                </div>
                <div style="background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
                  <p style="font-size:15px;color:#111827;">Olá, <strong>${ent.nome}</strong>,</p>
                  <p style="font-size:14px;color:#111827;line-height:1.6;">
                    O cidadão <strong>${demanda.morador_nome}</strong> registrou uma demanda direcionada a você no CidadanIA Frutal.
                  </p>
                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                    <p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Descrição da demanda</p>
                    <p style="font-size:14px;color:#111827;margin:0;line-height:1.6;">${demanda.descricao}</p>
                    ${demanda.endereco_label ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${demanda.endereco_label}</p>` : ''}
                  </div>
                  <a href="${linkResposta}" style="display:block;background:#4256c8;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0;">
                    Responder esta demanda →
                  </a>
                  <p style="font-size:12px;color:#6b7280;text-align:center;">Este link expira em 7 dias.</p>
                </div>
              </div>
            `,
          })
        }
      }

      // Demanda legada, sem vínculos em demanda_entidades — usa entidade direta
      if (!vinculos?.length && demanda.entidade?.email) {
        const token = gerarToken()
        await supabaseServer.from('demandas').update({
          magic_token: token,
          magic_token_expira_em: expiracao,
        }).eq('id', demanda_id)
        const linkResposta = `${process.env.SITE_URL}/responder/${token}`
        await resend.emails.send({
          from: 'CidadanIA Frutal <onboarding@resend.dev>',
          to: demanda.entidade.email,
          subject: `Nova demanda para ${demanda.entidade.nome} — CidadanIA Frutal`,
          html: `<a href="${linkResposta}">Responder demanda</a>`,
        })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
