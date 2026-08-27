import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { gerarToken } from '@/lib/token'
import { Resend } from 'resend'

// Gemini pode demorar até ~25s; sem maxDuration a função era cortada pelo
// Vercel no padrão da plataforma (~10s) antes de terminar a análise.
export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

const RIGOR_INSTRUCAO: Record<string, string> = {
  permissivo: 'Seja bastante permissivo. Só rejeite conteúdo claramente ofensivo, spam ou completamente fora de contexto municipal.',
  moderado: 'Seja moderado. Rejeite conteúdo ofensivo, spam, político-partidário ou sem relação com serviços públicos de Frutal-MG.',
  rigoroso: 'Seja rigoroso. Rejeite qualquer demanda vaga, sem endereço claro, sem categoria adequada ou que não seja uma solicitação legítima de serviço público.',
}

export async function POST(req: NextRequest) {
  // Verificação interna — chave entre APIs
  const key = req.headers.get('x-internal-key')
  if (key !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { demanda_id } = await req.json()

    const [{ data: demanda }, { data: config }] = await Promise.all([
      supabaseServer.from('demandas')
        .select('*, categoria:categorias_mapa(nome), entidade:entidades(nome, cargo, email)')
        .eq('id', demanda_id).single(),
      supabaseServer.from('ia_config').select('*').eq('id', 1).single(),
    ])

    if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada.' }, { status: 404 })

    // Se IA desativada, mantém pendente para aprovação manual
    if (!config?.ativo) {
      return NextResponse.json({ ok: true, decisao: 'ia_desativada' })
    }

    const rigor = config?.rigor || 'moderado'
    const promptBase = config?.prompt || 'Analise a demanda do cidadão.'
    const instrucaoRigor = RIGOR_INSTRUCAO[rigor] || RIGOR_INSTRUCAO.moderado

    const prompt = `${promptBase}

${instrucaoRigor}

Demanda recebida:
- Cidadão: ${demanda.morador_nome}
- Categoria: ${demanda.categoria?.nome || 'Não informada'}
- Autoridade cobrada: ${demanda.entidade?.nome} (${demanda.entidade?.cargo})
- Endereço: ${demanda.endereco_label || 'Não informado'}
- Descrição: ${demanda.descricao}

Responda APENAS com um JSON no formato:
{"decisao": "aprovada" ou "rejeitada", "motivo": "motivo breve em português"}

Não inclua nada além do JSON.`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    )

    if (!geminiRes.ok) {
      console.error('Gemini error:', await geminiRes.text())
      return NextResponse.json({ error: 'Erro na IA.' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const texto = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let decisao = 'rejeitada'
    let motivo = 'Não foi possível analisar a demanda.'
    try {
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        decisao = parsed.decisao === 'aprovada' ? 'aprovada' : 'rejeitada'
        motivo = parsed.motivo || motivo
      }
    } catch {
      console.error('Erro ao parsear resposta da IA:', texto)
    }

    if (decisao === 'aprovada') {
      const expiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      // Busca todos os vínculos de autoridade desta demanda
      const { data: vinculos } = await supabaseServer
        .from('demanda_entidades')
        .select('id, entidade_id, entidade:entidades(nome, cargo, email)')
        .eq('demanda_id', demanda_id)

      // Atualiza status da demanda
      await supabaseServer.from('demandas').update({
        status: 'aguardando_resposta',
        ia_decisao: 'aprovada',
        ia_motivo: motivo,
        ia_analisado_em: new Date().toISOString(),
        link_enviado: true,
      }).eq('id', demanda_id)

      // Para cada autoridade: gera token individual e envia e-mail
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
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
              <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
                <div style="background:#4256c8;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
                  <h1 style="color:white;font-size:18px;margin:0;">CidadanIA Frutal</h1>
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
            </body></html>`,
          })
        }
      }

    } else {
      await supabaseServer.from('demandas').update({
        status: 'rejeitada_ia',
        ia_decisao: 'rejeitada',
        ia_motivo: motivo,
        ia_analisado_em: new Date().toISOString(),
      }).eq('id', demanda_id)
    }

    return NextResponse.json({ ok: true, decisao, motivo })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

