import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getUser, ipDaRequisicao, verificarTurnstile, limiteExcedido } from '@/lib/auth-api'

/**
 * Criação de registros das camadas do mapa (pets, classificados, empregos).
 *
 * Existe para que o token do Turnstile seja conferido no servidor antes de
 * qualquer escrita. O cliente não insere direto nessas tabelas na criação —
 * senão o captcha seria apenas decorativo.
 *
 * Edição e exclusão seguem pelo cliente, protegidas pelo RLS: exigem sessão
 * e só alcançam registros do próprio autor.
 */

type Camada = 'pets' | 'classificados' | 'empregos'
const TABELAS: Record<Camada, string> = {
  pets: 'pets',
  classificados: 'classificados',
  empregos: 'empregos',
}

/** Campos que o cliente pode gravar, por camada. Nada fora disso passa. */
const CAMPOS: Record<Camada, string[]> = {
  pets: [
    'tipo', 'especie', 'nome_pet', 'raca', 'cor', 'porte', 'descricao',
    'lat', 'lng', 'endereco_label', 'foto_url', 'contato',
  ],
  classificados: [
    'tipo_veiculo', 'titulo', 'marca', 'modelo', 'ano', 'km', 'cor', 'preco',
    'aceita_troca', 'descricao', 'lat', 'lng', 'bairro_label', 'fotos', 'contato',
  ],
  empregos: [
    'empresa_nome', 'cargo', 'area', 'contrato', 'salario', 'salario_a_combinar',
    'vagas', 'descricao', 'requisitos', 'lat', 'lng', 'endereco_label',
    'logo_url', 'contato',
  ],
}

/**
 * "foto_url"/"fotos" chegam no corpo da requisição como texto livre — nada
 * garante que o cliente mandou a URL que o upload dele mesmo gerou. Sem essa
 * checagem, um valor malicioso fica gravado e, se algum lugar futuro exibir
 * esse campo sem escapar (o popup do mapa de pets já escapa hoje, mas nada
 * garante que toda tela nova vá lembrar disso), vira XSS armazenado — o
 * mesmo problema já corrigido em /api/demandas. Aceita só o formato real de
 * URL pública do bucket esperado.
 */
function urlDoBucketValida(url: unknown, bucket: string): url is string {
  if (typeof url !== 'string' || !url) return false
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  return url.startsWith(`${base}/storage/v1/object/public/${bucket}/`)
}

const BUCKET_FOTO: Partial<Record<Camada, string>> = {
  pets: 'pets-fotos',
  classificados: 'classificados-fotos',
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    // Best-effort — cada registro dispara análise de IA (custo por chamada)
    if (limiteExcedido(`camadas:${user.id}`, 15, 10 * 60_000)) {
      return NextResponse.json({ error: 'Muitos registros em pouco tempo. Aguarde um pouco.' }, { status: 429 })
    }

    const body = await req.json()
    const camada = body?.camada as Camada
    if (!camada || !(camada in TABELAS)) {
      return NextResponse.json({ error: 'Camada inválida.' }, { status: 400 })
    }

    const turnstileOk = await verificarTurnstile(body?.turnstile_token, ipDaRequisicao(req))
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, { status: 400 })
    }

    const dados = body?.dados ?? {}
    if (!dados.descricao?.trim() || dados.lat == null || dados.lng == null) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const { data: perfil } = await supabaseServer
      .from('perfis').select('nome, role').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 400 })

    // Vaga é privilégio de empresa (ou da administração)
    if (camada === 'empregos' && perfil.role !== 'empresa' && perfil.role !== 'master') {
      return NextResponse.json({ error: 'Só contas de empresa podem publicar vagas.' }, { status: 403 })
    }

    // Só os campos previstos, mais a autoria — que vem da sessão, nunca do corpo
    const registro: Record<string, unknown> = { user_id: user.id }
    for (const campo of CAMPOS[camada]) {
      if (dados[campo] !== undefined) registro[campo] = dados[campo]
    }
    if (camada !== 'empregos') registro.autor_nome = perfil.nome || 'Anônimo'

    // Valida foto_url (pets) / fotos (classificados) contra o bucket certo —
    // descarta silenciosamente o que não bater, em vez de gravar lixo.
    const bucket = BUCKET_FOTO[camada]
    if (bucket && camada === 'pets' && 'foto_url' in registro) {
      registro.foto_url = urlDoBucketValida(registro.foto_url, bucket) ? registro.foto_url : null
    }
    if (bucket && camada === 'classificados' && Array.isArray(registro.fotos)) {
      registro.fotos = registro.fotos.filter((f: unknown) => urlDoBucketValida(f, bucket))
    }

    // Valida os enums de pet antes do banco — sem isso, um valor fora da
    // lista só era barrado pelo CHECK constraint do Postgres, devolvendo o
    // erro cru do banco pro cliente em vez de uma mensagem clara.
    if (camada === 'pets') {
      const TIPOS_PET = ['perdido', 'achado', 'adocao']
      const ESPECIES_PET = ['cachorro', 'gato']
      const PORTES_PET = ['pequeno', 'medio', 'grande']
      if (!TIPOS_PET.includes(registro.tipo as string)) {
        return NextResponse.json({ error: 'Tipo de registro inválido.' }, { status: 400 })
      }
      if (!ESPECIES_PET.includes(registro.especie as string)) {
        return NextResponse.json({ error: 'Espécie inválida.' }, { status: 400 })
      }
      if (registro.porte != null && !PORTES_PET.includes(registro.porte as string)) {
        return NextResponse.json({ error: 'Porte inválido.' }, { status: 400 })
      }
    }

    // Pets e classificados nascem com ia_decisao='pendente' — a rota de IA atualiza ao terminar.
    // Assim registros que nunca foram analisados ficam visíveis no master como pendentes.
    if (camada === 'pets' || camada === 'classificados') {
      registro.ia_decisao = 'pendente'
    }

    const { data, error } = await supabaseServer
      .from(TABELAS[camada]).insert(registro).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Dispara análise de IA em segundo plano para pets e classificados
    if (data?.id && (camada === 'pets' || camada === 'classificados')) {
      const rotaIA = camada === 'pets' ? '/api/ia/analisar-pet' : '/api/ia/analisar-classificado'
      const corpoIA = camada === 'pets' ? { pet_id: data.id } : { classificado_id: data.id }
      const base = process.env.SITE_URL || 'http://localhost:3000'
      fetch(`${base}${rotaIA}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET || '' },
        body: JSON.stringify(corpoIA),
      }).catch((err) => {
        console.error(`[IA] Falha ao disparar análise para ${camada} id=${data.id}:`, err?.message)
      })
    }

    return NextResponse.json({ ok: true, registro: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao salvar.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
