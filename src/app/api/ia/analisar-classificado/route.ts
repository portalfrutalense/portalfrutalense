import { NextRequest, NextResponse } from 'next/server'
import { segredoValido } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

// Gemini pode demorar; aumentar limite para não cortar a análise.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-internal-key')
  if (!segredoValido(key, process.env.INTERNAL_SECRET)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { classificado_id } = await req.json()

    const [{ data: classificado }, { data: config }] = await Promise.all([
      supabaseServer
        .from('classificados')
        .select('tipo_veiculo, titulo, marca, modelo, ano, km, cor, preco, descricao, contato')
        .eq('id', classificado_id)
        .single(),
      supabaseServer.from('ia_config').select('*').eq('id', 3).maybeSingle(),
    ])

    if (!classificado) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })

    // Se IA desativada, não faz nada
    if (config && !config.ativo) {
      return NextResponse.json({ ok: true, decisao: 'ia_desativada' })
    }

    const RIGOR_INSTRUCAO: Record<string, string> = {
      permissivo: 'Seja bastante permissivo. Só rejeite conteúdo claramente ofensivo ou spam.',
      moderado: 'Seja moderado. Rejeite spam, anúncios sem sentido e conteúdo que não seja de venda de veículo.',
      rigoroso: 'Seja rigoroso. Rejeite qualquer anúncio vago, sem informações mínimas ou suspeito de fraude.',
    }

    const rigor = config?.rigor || 'moderado'
    const promptBase = config?.prompt || 'Analise o anúncio de veículo e decida se deve ser aprovado ou rejeitado.'
    const instrucaoRigor = RIGOR_INSTRUCAO[rigor] || RIGOR_INSTRUCAO.moderado

    const prompt = `${promptBase}

${instrucaoRigor}

Anúncio recebido:
- Tipo: ${classificado.tipo_veiculo}
- Título: ${classificado.titulo}
- Marca: ${classificado.marca || 'Não informada'}
- Modelo: ${classificado.modelo || 'Não informado'}
- Ano: ${classificado.ano || 'Não informado'}
- KM: ${classificado.km != null ? `${classificado.km} km` : 'Não informado'}
- Cor: ${classificado.cor || 'Não informada'}
- Preço: ${classificado.preco != null ? `R$ ${classificado.preco}` : 'A combinar'}
- Descrição: ${classificado.descricao}
- Contato: ${classificado.contato}

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
      console.error('Gemini error (classificado):', await geminiRes.text())
      return NextResponse.json({ error: 'Erro na IA.' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const texto = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let decisao = 'aprovada'
    let motivo = 'Análise automática concluída.'
    try {
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        decisao = parsed.decisao === 'rejeitada' ? 'rejeitada' : 'aprovada'
        motivo = parsed.motivo || motivo
      }
    } catch {
      console.error('Erro ao parsear resposta da IA (classificado):', texto)
    }

    const agora = new Date().toISOString()

    if (decisao === 'rejeitada') {
      await supabaseServer.from('classificados').update({
        oculto: true,
        ia_decisao: 'rejeitada',
        ia_motivo: motivo,
        ia_analisado_em: agora,
      }).eq('id', classificado_id)
    } else {
      await supabaseServer.from('classificados').update({
        ia_decisao: 'aprovada',
        ia_motivo: motivo,
        ia_analisado_em: agora,
      }).eq('id', classificado_id)
    }

    return NextResponse.json({ ok: true, decisao, motivo })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
