import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { gerarToken, calcularExpiracao } from '@/lib/token'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function verificarAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization')
  if (!auth) return false
  const token = auth.replace('Bearer ', '')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return !error && !!data.user
}

export async function POST(req: NextRequest) {
  if (!(await verificarAdmin(req))) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { id } = await req.json()

    const { data: denuncia, error } = await supabaseAdmin
      .from('denuncias')
      .select('*, entidade:entidades(nome, cargo, email)')
      .eq('id', id)
      .single()

    if (error || !denuncia) return NextResponse.json({ error: 'Denúncia não encontrada.' }, { status: 404 })

    const token = gerarToken()
    const expira = calcularExpiracao(7)
    const magicLink = `${process.env.NEXT_PUBLIC_SITE_URL}/responder/${token}`

    await supabaseAdmin.from('denuncias').update({
      magic_token: token,
      magic_token_expira_em: expira.toISOString(),
    }).eq('id', id)

    let emailStatus: string | null = null
    let emailErro: string | null = null

    if (denuncia.entidade?.email) {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'Portal Frutalense <onboarding@resend.dev>',
        to: 'portalfrutalense@gmail.com',
        subject: `[Portal Frutalense] Nova cobrança pública para ${denuncia.entidade.nome}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1e3a5f">Nova Cobrança Pública</h2>
            <p><strong>De:</strong> ${denuncia.morador_nome}</p>
            <p><strong>Para:</strong> ${denuncia.entidade.nome} · ${denuncia.entidade.cargo}</p>
            <hr/>
            <blockquote style="border-left:4px solid #1e3a5f;padding-left:16px;color:#374151">${denuncia.mensagem}</blockquote>
            <hr/>
            <p>Para registrar sua resposta oficial, clique no link abaixo:</p>
            <a href="${magicLink}" style="background:#1e3a5f;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Responder Agora</a>
            <p style="color:#9ca3af;font-size:12px">Este link é pessoal e expira em 7 dias.</p>
          </div>
        `,
      })
      if (emailError) {
        emailErro = emailError.message
      } else {
        emailStatus = emailData?.id || 'enviado'
      }
    }

    return NextResponse.json({ ok: true, magicLink, emailStatus, emailErro })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
