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

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    // Best-effort — cada demanda aprovada dispara e-mail pra até 3 autoridades
    if (limiteExcedido(`demandas:${user.id}`, 10, 10 * 60_000)) {
      return NextResponse.json({ error: 'Muitas demandas registradas em pouco tempo. Aguarde um pouco.' }, { status: 429 })
    }

    const body = await req.json()
    const { descricao, lat, lng, categoria_id, entidade_ids, foto_url, endereco_label, turnstile_token } = body

    if (!descricao || !lat || !lng || !categoria_id || !entidade_ids?.length) {
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

    const { data: perfil } = await supabaseServer.from('perfis').select('nome, cpf, email').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 400 })
    if (!perfil.cpf?.trim()) return NextResponse.json({ error: 'CPF obrigatório para registrar uma demanda.' }, { status: 400 })

    // Garante que o email do Auth fica salvo no perfil
    if (!perfil.email && user.email) {
      await supabaseServer.from('perfis').update({ email: user.email }).eq('id', user.id)
    }

    const { data: demanda, error } = await supabaseServer.from('demandas').insert({
      user_id: user.id,
      morador_nome: perfil.nome,
      morador_cpf: perfil.cpf,
      descricao: descricao.trim(),
      lat,
      lng,
      categoria_id,
      entidade_id: entidade_ids[0], // mantém coluna legada com a primeira autoridade
      foto_url: fotoUrlValida(foto_url) ? foto_url : null,
      endereco_label: endereco_label || null,
      status: 'pendente',
    }).select().single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    // Insere vínculos com todas as autoridades selecionadas
    const vinculos = entidade_ids.map((eid: string) => ({
      demanda_id: demanda.id,
      entidade_id: eid,
      status: 'aguardando_resposta',
    }))
    const { error: vinculoError } = await supabaseServer.from('demanda_entidades').insert(vinculos)
    if (vinculoError) {
      console.error('Erro ao inserir demanda_entidades:', vinculoError)
      // Não bloqueia — demanda já foi criada
    }

    // Dispara a análise de IA em segundo plano — não bloqueia a resposta ao
    // cliente (mesmo padrão de /api/camadas). Sem await: se o fetch falhar,
    // a demanda fica pendente até o botão "Reprocessar pendentes travados"
    // (painel master) reenviar pra análise.
    fetch(`${process.env.SITE_URL}/api/ia/analisar`, {
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

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data } = await supabaseServer
    .from('demandas')
    .select('*, categoria:categorias_mapa(*), entidade:entidades(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}
