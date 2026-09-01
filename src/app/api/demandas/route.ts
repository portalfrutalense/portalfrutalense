import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getUser, ipDaRequisicao, verificarTurnstile, limiteExcedido } from '@/lib/auth-api'

/**
 * "foto_url" chega no corpo da requisição como texto livre — o cliente
 * normal manda a URL que o próprio upload ao Storage gerou, mas nada
 * impede uma chamada direta à API de mandar qualquer string ali. Sem essa
 * checagem, um valor malicioso (ex: `x" onerror="alert(1)`) fica gravado
 * e — como o popup do mapa não escapa esse campo especificamente — vira
 * XSS armazenado pra quem visualizar a demanda. Aceita só o formato real
 * de URL pública do bucket "demandas-fotos".
 */
function fotoUrlValida(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  return url.startsWith(`${base}/storage/v1/object/public/demandas-fotos/`)
}

function pathDaFoto(fotoUrl: string): string | null {
  try {
    const url = new URL(fotoUrl)
    const parts = url.pathname.split('/demandas-fotos/')
    return parts[1] || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    // Best-effort — cada demanda aprovada dispara e-mail pra até 3 autoridades
    if (limiteExcedido(`demandas:${user.id}`, 10, 10 * 60_000)) {
      return NextResponse.json({ error: 'Muitas demandas registradas em pouco tempo. Aguarde um pouco.' }, { status: 429 })
    }

    const body = await req.json()
    const { descricao, lat, lng, categoria_id, entidade_ids, foto_url, endereco_label, turnstile_token, via_chatbot } = body

    // BUG CORRIGIDO: `!lat || !lng` rejeitava a coordenada 0 (não acontece em
    // Frutal, mas era redundante e errado — a checagem certa já é a de baixo).
    if (!descricao || lat === undefined || lng === undefined || !categoria_id || !entidade_ids?.length) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    // A UI sempre manda número — isso só protege contra chamada direta à
    // API com lat/lng fora do formato esperado (string, NaN, Infinity).
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Localização inválida.' }, { status: 400 })
    }
    if (!Array.isArray(entidade_ids) || entidade_ids.length > 3) {
      return NextResponse.json({ error: 'Máximo de 3 autoridades.' }, { status: 400 })
    }

    const ip = ipDaRequisicao(req)
    const turnstileOk = await verificarTurnstile(turnstile_token, ip)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, { status: 400 })
    }

    // BUG CORRIGIDO: não havia validação prévia de que `entidade_ids` e
    // `categoria_id` existem de verdade — se algum id não existisse (ou uma
    // autoridade tivesse sido desativada), a demanda nascia mesmo assim, a
    // FK falhava silenciosamente ao inserir `demanda_entidades` (erro só
    // logado, "não bloqueia"), a IA aprovava, e a demanda ficava pra sempre
    // em `aguardando_resposta` sem nenhuma autoridade pra responder — fluxo
    // que nunca termina e não aparece como erro em lugar nenhum.
    const idsUnicos = [...new Set(entidade_ids as string[])]
    const [{ data: entidadesValidas }, { data: categoriaValida }] = await Promise.all([
      supabaseServer.from('entidades').select('id').in('id', idsUnicos).eq('ativo', true),
      supabaseServer.from('categorias_mapa').select('id').eq('id', categoria_id).maybeSingle(),
    ])
    if (!categoriaValida) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }
    if ((entidadesValidas?.length || 0) !== idsUnicos.length) {
      return NextResponse.json({ error: 'Uma ou mais autoridades selecionadas não estão mais disponíveis. Atualize a página e tente novamente.' }, { status: 400 })
    }

    const { data: perfil } = await supabaseServer.from('perfis').select('nome, cpf, email').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 400 })
    if (!perfil.cpf?.trim()) return NextResponse.json({ error: 'CPF obrigatório para registrar uma demanda.' }, { status: 400 })

    // Garante que o email do Auth fica salvo no perfil
    if (!perfil.email && user.email) {
      await supabaseServer.from('perfis').update({ email: user.email }).eq('id', user.id)
    }

    // BUG CORRIGIDO: quando `foto_url` vinha preenchida mas não batia com o
    // formato esperado do bucket, era trocada por `null` em silêncio — o
    // cidadão anexava a foto, via ela no formulário, enviava, e a demanda
    // ia sem foto, sem nenhum aviso (e o arquivo ficava órfão no Storage).
    // Agora, se veio preenchida e é inválida, rejeita o envio.
    if (foto_url && !fotoUrlValida(foto_url)) {
      return NextResponse.json({ error: 'Foto inválida. Tente anexar novamente.' }, { status: 400 })
    }

    const { data: demanda, error } = await supabaseServer.from('demandas').insert({
      user_id: user.id,
      morador_nome: perfil.nome,
      morador_cpf: perfil.cpf,
      descricao: descricao.trim(),
      lat,
      lng,
      categoria_id,
      entidade_id: idsUnicos[0], // mantém coluna legada com a primeira autoridade
      foto_url: foto_url || null,
      endereco_label: endereco_label || null,
      status: 'pendente',
      // BUG CORRIGIDO: o chat do site já mandava esse campo, mas a rota
      // sempre ignorava — não existia forma nenhuma de saber quais
      // demandas vieram do assistente de IA vs. do formulário do mapa.
      via_chatbot: via_chatbot === true,
    }).select().single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    // BUG CORRIGIDO: usava `entidade_ids` cru (não deduplicado) — mandando
    // `["A","A","A"]`, a mesma autoridade recebia 3 vínculos e 3 e-mails, e
    // a partir daí `/api/autoridade/denunciar` e
    // `/api/autoridade/marcar-resolvida` (que usam `.single()`) passavam a
    // falhar sempre pra ela, com o erro enganoso "Demanda não direcionada a
    // você". `idsUnicos` (já calculado acima pra validação) resolve os dois.
    const vinculos = idsUnicos.map((eid) => ({
      demanda_id: demanda.id,
      entidade_id: eid,
      status: 'aguardando_resposta',
    }))
    const { error: vinculoError } = await supabaseServer.from('demanda_entidades').insert(vinculos)
    if (vinculoError) {
      console.error('Erro ao inserir demanda_entidades:', vinculoError)
      // Sem nenhum vínculo, a demanda nunca teria autoridade pra responder —
      // desfaz a criação (demanda + foto) em vez de deixar um registro morto
      // que a IA aprovaria sem ninguém pra receber.
      if (demanda.foto_url) {
        const caminho = pathDaFoto(demanda.foto_url)
        if (caminho) await supabaseServer.storage.from('demandas-fotos').remove([caminho])
      }
      await supabaseServer.from('demandas').delete().eq('id', demanda.id)
      return NextResponse.json({ error: 'Não foi possível vincular as autoridades selecionadas. Tente novamente.' }, { status: 500 })
    }

    // Dispara a análise de IA em segundo plano — não bloqueia a resposta ao
    // cliente (mesmo padrão de /api/camadas). Sem await: se o fetch falhar,
    // a demanda fica pendente até o botão "Reprocessar pendentes travados"
    // (painel master) reenviar pra análise.
    // BUG CORRIGIDO: sem fallback, `SITE_URL` ausente virava
    // `fetch("undefined/api/ia/analisar")` — erro genérico de rede
    // (`fetch failed`) indistinguível de uma falha real de conexão. Mesmo
    // fallback já usado em /api/camadas e /api/master/reprocessar-pendentes,
    // mais um log específico pra não confundir os dois casos de novo.
    if (!process.env.SITE_URL) {
      console.error('SITE_URL não configurada — análise de IA pode falhar ao montar a URL.')
    }
    const baseUrl = process.env.SITE_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/ia/analisar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET! },
      body: JSON.stringify({ demanda_id: demanda.id }),
    }).catch((e) => {
      console.error('Erro ao chamar IA:', e)
    })

    return NextResponse.json({ ok: true, id: demanda.id }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
