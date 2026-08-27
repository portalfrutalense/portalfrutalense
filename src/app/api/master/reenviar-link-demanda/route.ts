import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { gerarToken } from '@/lib/token'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!authRes.ok) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const user = await authRes.json()
  if (!user?.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { data: perfil } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const { demanda_id } = await req.json()
    if (!demanda_id) return NextResponse.json({ error: 'demanda_id obrigatório.' }, { status: 400 })

    const { data: demanda, error } = await supabaseServer
      .from('demandas')
      .select('*, entidade:entidades(nome, cargo, email)')
      .eq('id', demanda_id)
      .single()

    if (error || !demanda) return NextResponse.json({ error: 'Demanda não encontrada.' }, { status: 404 })

    const emailAutoridade = demanda.entidade?.email
    if (!emailAutoridade) return NextResponse.json({ error: 'Autoridade sem e-mail cadastrado.' }, { status: 400 })

    const novoToken = gerarToken()
    const expiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabaseServer.from('demandas').update({
      magic_token: novoToken,
      magic_token_expira_em: expiracao,
      link_enviado: true,
      status: 'aguardando_resposta',
    }).eq('id', demanda_id)

    const linkResposta = `${process.env.SITE_URL}/responder/${novoToken}`

    const { data: emailEnviado } = await resend.emails.send({
      from: 'CidadanIA Frutal <noreply@cidadaniafrutal.com.br>',
      to: emailAutoridade,
      subject: `[REENVIO] Demanda aguardando sua resposta — CidadanIA Frutal`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
          <div style="background:#4256c8;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;font-size:18px;margin:0;">CidadanIA Frutal</h1>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0;">Frutal-MG · Transparência e Cidadania</p>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
            <p style="font-size:15px;color:#111827;">Olá, <strong>${demanda.entidade?.nome}</strong>,</p>
            <p style="font-size:14px;color:#111827;line-height:1.6;">
              Este é um reenvio do link para responder a demanda do cidadão <strong>${demanda.morador_nome}</strong>.
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

    if (emailEnviado?.id) {
      await supabaseServer.from('demandas').update({
        email_resend_id: emailEnviado.id,
        email_status: 'enviado',
      }).eq('id', demanda_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

