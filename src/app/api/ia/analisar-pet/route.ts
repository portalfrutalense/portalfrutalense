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
    const { pet_id } = await req.json()

    const [{ data: pet }, { data: config }] = await Promise.all([
      supabaseServer
        .from('pets')
        .select('tipo, especie, nome_pet, raca, cor, porte, descricao, contato')
        .eq('id', pet_id)
        .single(),
      supabaseServer.from('ia_config').select('*').eq('id', 2).maybeSingle(),
    ])

    if (!pet) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })

    // Se IA desativada, não faz nada
    if (config && !config.ativo) {
      return NextResponse.json({ ok: true, decisao: 'ia_desativada' })
    }

    const RIGOR_INSTRUCAO: Record<string, string> = {
      permissivo: 'Seja bastante permissivo. Só rejeite conteúdo claramente ofensivo ou spam.',
      moderado: 'Seja moderado. Rejeite spam, conteúdo ofensivo e registros sem sentido como anúncio de pet.',
      rigoroso: 'Seja rigoroso. Rejeite qualquer registro vago, sem descrição adequada ou suspeito de uso indevido.',
    }

    const rigor = config?.rigor || 'moderado'
    const promptBase = config?.prompt || 'Analise o registro de pet perdido ou encontrado e decida se deve ser aprovado ou rejeitado.'
    const instrucaoRigor = RIGOR_INSTRUCAO[rigor] || RIGOR_INSTRUCAO.moderado

    const tipoRotulo = pet.tipo === 'perdido' ? 'Pet perdido' : pet.tipo === 'adocao' ? 'Pet para adoção' : 'Pet achado na rua'

    const prompt = `${promptBase}

${instrucaoRigor}

Registro recebido:
- Tipo: ${tipoRotulo}
- Espécie: ${pet.especie}
- Nome do pet: ${pet.nome_pet || 'Não informado'}
- Raça: ${pet.raca || 'Não informada'}
- Cor: ${pet.cor || 'Não informada'}
- Porte: ${pet.porte || 'Não informado'}
- Descrição: ${pet.descricao}
- Contato: ${pet.contato}

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
      console.error('Gemini error (pet):', await geminiRes.text())
      return NextResponse.json({ error: 'Erro na IA.' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const texto = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Falha fechado: se a resposta da IA não puder ser interpretada, o
    // registro fica pendente de revisão manual em vez de ser aprovado
    // automaticamente — igual ao comportamento de /api/ia/analisar
    // (demandas). Antes o padrão aqui era 'aprovada', com um motivo
    // ("Análise automática concluída.") que soava como sucesso mesmo
    // quando o parse da resposta da IA tinha falhado silenciosamente.
    let decisao = 'rejeitada'
    let motivo = 'Não foi possível analisar o registro.'
    try {
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        decisao = parsed.decisao === 'aprovada' ? 'aprovada' : 'rejeitada'
        motivo = parsed.motivo || motivo
      }
    } catch {
      console.error('Erro ao parsear resposta da IA (pet):', texto)
    }

    const agora = new Date().toISOString()

    if (decisao === 'rejeitada') {
      await supabaseServer.from('pets').update({
        oculto: true,
        ia_decisao: 'rejeitada',
        ia_motivo: motivo,
        ia_analisado_em: agora,
      }).eq('id', pet_id)
    } else {
      await supabaseServer.from('pets').update({
        ia_decisao: 'aprovada',
        ia_motivo: motivo,
        ia_analisado_em: agora,
      }).eq('id', pet_id)
    }

    return NextResponse.json({ ok: true, decisao, motivo })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
