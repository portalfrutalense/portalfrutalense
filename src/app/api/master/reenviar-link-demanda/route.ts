import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { gerarToken } from '@/lib/token'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
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

    const linkResposta = `${process.env.NEXT_PUBLIC_SITE_URL}/responder/${novoToken}`

    await resend.emails.send({
      from: 'Fala Frutal <onboarding@resend.dev>',
      to: emailAutoridade,
      subject: `[REENVIO] Demanda aguardando sua resposta — Fala Frutal`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
          <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;font-size:18px;margin:0;">Fala Frutal</h1>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0;">Frutal-MG · Transparência e Cidadania</p>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
            <p style="font-size:15px;color:#111827;">Olá, <strong>${demanda.entidade?.nome}</strong>,</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;">
              Este é um reenvio do link para responder a demanda do cidadão <strong>${demanda.morador_nome}</strong>.
            </p>
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Descrição da demanda</p>
              <p style="font-size:14px;color:#111827;margin:0;line-height:1.6;">${demanda.descricao}</p>
              ${demanda.endereco_label ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${demanda.endereco_label}</p>` : ''}
            </div>
            <a href="${linkResposta}" style="display:block;background:#1e3a5f;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0;">
              Responder esta demanda →
            </a>
            <p style="font-size:12px;color:#9ca3af;text-align:center;">Este link expira em 7 dias.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

