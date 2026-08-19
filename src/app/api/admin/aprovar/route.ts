import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { gerarToken, calcularExpiracao } from '@/lib/token'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function verificarAdmin(req: NextRequest): boolean {
  const senha = req.headers.get('x-admin-password')
  return senha === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!verificarAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { id, tipo } = await req.json() // tipo: 'denuncia' | 'ocorrencia'

    if (tipo === 'ocorrencia') {
      const { error } = await supabaseAdmin
        .from('ocorrencias')
        .update({ status: 'publicada' })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Erro ao aprovar.' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // Para denúncias: gerar Magic Link e enviar e-mail
    const { data: denuncia, error } = await supabaseAdmin
      .from('denuncias')
      .select('*, entidade:entidades(nome, cargo, email)')
      .eq('id', id)
      .single()

    if (error || !denuncia) return NextResponse.json({ error: 'Denúncia não encontrada.' }, { status: 404 })

    const token = gerarToken()
    const expira = calcularExpiracao(7)
    const magicLink = `${process.env.NEXT_PUBLIC_SITE_URL}/responder/${token}`

    // Atualiza status e salva token
    await supabaseAdmin
      .from('denuncias')
      .update({
        status: 'aguardando_resposta',
        magic_token: token,
        magic_token_expira_em: expira.toISOString(),
      })
      .eq('id', id)

    // Envia e-mail para a autoridade (se tiver e-mail cadastrado)
    if (denuncia.entidade?.email) {
      await resend.emails.send({
        from: 'Portal Frutalense <noreply@frutalense.com.br>',
        to: denuncia.entidade.email,
        subject: `[Portal Frutalense] Nova cobrança pública para ${denuncia.entidade.nome}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #15803d;">📢 Nova Cobrança Pública</h2>
            <p><strong>De:</strong> ${denuncia.morador_nome} (${denuncia.morador_cpf_display})</p>
            <p><strong>Para:</strong> ${denuncia.entidade.nome} · ${denuncia.entidade.cargo}</p>
            <hr/>
            <blockquote style="border-left: 4px solid #15803d; padding-left: 16px; color: #374151;">
              ${denuncia.mensagem}
            </blockquote>
            <hr/>
            <p>Para registrar sua resposta oficial, clique no link abaixo:</p>
            <a href="${magicLink}" style="background: #15803d; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 16px 0;">
              ✏️ Responder Agora
            </a>
            <p style="color: #9ca3af; font-size: 12px;">
              Este link é pessoal e expira em 7 dias. Após responder, o link será descartado automaticamente.
            </p>
          </div>
        `,
      })
    }

    return NextResponse.json({ ok: true, magicLink })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
