import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getUser, ipDaRequisicao, verificarTurnstile } from '@/lib/auth-api'

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

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

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
    const registro: Record<string, any> = { user_id: user.id }
    for (const campo of CAMPOS[camada]) {
      if (dados[campo] !== undefined) registro[campo] = dados[campo]
    }
    if (camada !== 'empregos') registro.autor_nome = perfil.nome || 'Anônimo'

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
      }).catch(() => { /* silencioso */ })
    }

    return NextResponse.json({ ok: true, registro: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao salvar.' }, { status: 500 })
  }
}
