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
 * Exclusão segue pelo cliente, protegida pelo RLS: exige sessão e só
 * alcança registros do próprio autor.
 *
 * Edição de EMPREGOS também segue direto pelo cliente (RLS) — vagas nunca
 * passaram por moderação de IA, decisão de produto, não lacuna (ver
 * MasterEmpregos: "Empregos não passam por moderação automática").
 *
 * Edição de PETS e CLASSIFICADOS passa por aqui (PATCH), não mais direto
 * pelo cliente. BUG CORRIGIDO: antes, editar um registro JÁ APROVADO pela
 * IA (ex.: trocar a descrição por qualquer outro conteúdo) não passava por
 * nenhuma moderação nova — o registro continuava com ia_decisao='aprovada'
 * e visível no mapa público com o texto trocado, porque o RLS restringe o
 * autor a colunas de conteúdo e nunca deixaria ele mesmo mudar ia_decisao
 * pelo caminho antigo (então simplesmente não tinha como reenviar pra
 * análise por ali). Por decisão explícita: toda edição de pet/classificado
 * agora força ia_decisao de volta para 'pendente' e dispara nova análise —
 * o registro some do mapa até a IA (re)aprovar, igual ao fluxo de criação.
 */

type Camada = 'pets' | 'classificados' | 'empregos' | 'imoveis'
const TABELAS: Record<Camada, string> = {
  pets: 'pets',
  classificados: 'classificados',
  empregos: 'empregos',
  imoveis: 'imoveis',
}

/** Campos que o cliente pode gravar, por camada. Nada fora disso passa. */
const CAMPOS: Record<Camada, string[]> = {
  pets: [
    'tipo', 'especie', 'nome_pet', 'raca', 'cor', 'porte', 'descricao',
    'data_hora_aproximada', 'lat', 'lng', 'endereco_label', 'foto_url', 'contato',
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
  imoveis: [
    'finalidade', 'tipo', 'descricao', 'valor', 'lat', 'lng', 'endereco_label',
    'fotos', 'contato',
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

// BUG CORRIGIDO: `logo_url` (empregos) estava na lista de campos graváveis
// sem NENHUMA validação de bucket — e o formulário de vaga (CamadaEmpregos)
// nem tem campo de logo, então era um campo que a UI nunca preenche, que a
// API aceitava de qualquer origem, e que o mapa renderiza como `<img src>`.
// Uma conta empresa podia apontar pra qualquer host externo. `empregos-fotos`
// já existia como bucket reservado (usado em camadas/excluir) — faltava só
// a mesma checagem que pets/classificados já tinham.
const BUCKET_FOTO: Partial<Record<Camada, string>> = {
  pets: 'pets-fotos',
  classificados: 'classificados-fotos',
  empregos: 'empregos-fotos',
  imoveis: 'imoveis-fotos',
}

// Mesmo centro/raio já usados no webhook do WhatsApp (dentroFrutal) pra
// validar endereço geocodificado — reaproveitado aqui pra fechar a mesma
// lacuna que só existia nesse outro fluxo.
const FRUTAL_LAT = -20.02752
const FRUTAL_LNG = -48.92702
// BUG CORRIGIDO (R2-... / B09-1): tratava grau de latitude e de longitude
// como equivalentes — na latitude de Frutal, 0,15° de longitude é ~15,7km
// mas 0,15° de latitude é ~16,6km, então a área aceita era uma elipse, não
// o círculo de 15km que a intenção sempre foi. Converte pra km reais,
// compensando a longitude por cos(latitude) — mesmo ajuste que
// aproximarCoordenada já faz. Duplicada em MiniMapaConfirmar.tsx e no
// webhook do WhatsApp (mesma correção aplicada nos dois).
function dentroFrutal(lat: number, lng: number) {
  const dlatKm = (lat - FRUTAL_LAT) * 111.32
  const dlngKm = (lng - FRUTAL_LNG) * 111.32 * Math.cos(FRUTAL_LAT * Math.PI / 180)
  return Math.sqrt(dlatKm * dlatKm + dlngKm * dlngKm) < 15
}

// BUG CORRIGIDO: a "localização aproximada" de classificados (promessa de
// privacidade documentada no SISTEMA.md §5.3/§11 — o endereço exato do
// vendedor nunca deveria ser exposto) era aplicada só no CLIENTE
// (FormClassificado.tsx). O servidor gravava lat/lng exatamente como
// vieram — uma chamada direta à API (ou um cliente alterado) gravava o
// endereço exato, e a interface continuava dizendo publicamente
// "localização aproximada" pra todo mundo, sem isso ser verdade. Mesma
// fórmula do cliente (deslocamento aleatório de 150-300m), agora também
// aplicada aqui — a fonte da verdade não pode confiar só na UI.
function aproximarCoordenada(lat: number, lng: number) {
  const raio = 150 + Math.random() * 150
  const angulo = Math.random() * 2 * Math.PI
  const dLat = (raio * Math.cos(angulo)) / 111_320
  const dLng = (raio * Math.sin(angulo)) / (111_320 * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

/** Campos de texto exigidos por camada, além de descrição/lat/lng — a UI já
 * exige, mas nada impedia uma chamada direta à API sem eles. */
const CAMPOS_OBRIGATORIOS: Record<Camada, string[]> = {
  pets: ['tipo', 'especie'],
  classificados: ['titulo', 'contato'],
  empregos: ['cargo', 'empresa_nome'],
  imoveis: ['finalidade', 'tipo', 'contato'],
}

/**
 * Valida os enums antes do banco — sem isso, um valor fora da lista só era
 * barrado pelo CHECK constraint do Postgres, devolvendo o erro cru do banco
 * pro cliente em vez de uma mensagem clara. Usada na criação e na edição —
 * extraída pra não duplicar a mesma lista em dois lugares (e arriscar as
 * duas ficarem diferentes com o tempo).
 *
 * BUG CORRIGIDO: só pets tinham essa validação — classificados
 * (`tipo_veiculo`) e empregos (`contrato`) entravam sem checagem nenhuma,
 * mesmo cuidado aplicado em um lugar e esquecido nos outros dois. Os
 * valores espelham os mesmos CHECK constraints do banco (ver
 * sql/migration-camadas-mapa.sql e supabase/fix_classificados_onibus_2026-08-30.sql).
 */
function erroDeEnum(camada: Camada, registro: Record<string, unknown>): string | null {
  if (camada === 'pets') {
    const TIPOS_PET = ['perdido', 'achado', 'adocao']
    const ESPECIES_PET = ['cachorro', 'gato']
    const PORTES_PET = ['pequeno', 'medio', 'grande']
    if ('tipo' in registro && !TIPOS_PET.includes(registro.tipo as string)) return 'Tipo de registro inválido.'
    if ('especie' in registro && !ESPECIES_PET.includes(registro.especie as string)) return 'Espécie inválida.'
    if (registro.porte != null && !PORTES_PET.includes(registro.porte as string)) return 'Porte inválido.'
  }
  if (camada === 'classificados') {
    const TIPOS_VEICULO = ['carro', 'moto', 'onibus', 'caminhao']
    if ('tipo_veiculo' in registro && !TIPOS_VEICULO.includes(registro.tipo_veiculo as string)) return 'Tipo de veículo inválido.'
  }
  if (camada === 'empregos') {
    const TIPOS_CONTRATO = ['clt', 'pj', 'temporario', 'estagio', 'freelance']
    if ('contrato' in registro && !TIPOS_CONTRATO.includes(registro.contrato as string)) return 'Tipo de contrato inválido.'
  }
  if (camada === 'imoveis') {
    const FINALIDADES = ['aluguel', 'venda']
    const TIPOS_IMOVEL = ['casa', 'apartamento', 'terreno', 'comodo_comercial', 'barracao', 'fazenda_chacara_sitio']
    if ('finalidade' in registro && !FINALIDADES.includes(registro.finalidade as string)) return 'Finalidade inválida.'
    if ('tipo' in registro && !TIPOS_IMOVEL.includes(registro.tipo as string)) return 'Tipo de imóvel inválido.'
  }
  return null
}

/**
 * Valida foto_url (pets) / fotos (classificados) / logo_url (empregos)
 * contra o bucket certo.
 *
 * BUG CORRIGIDO: antes, uma foto que não batesse com o bucket esperado era
 * descartada em silêncio (virava `null` ou saía do array) — o cidadão
 * anexava a foto, via ela no formulário, enviava, e o registro ia sem foto
 * nenhuma, sem nenhum aviso (mesmo problema já corrigido em /api/demandas —
 * ver B13-3). Agora, se veio preenchida e é inválida, rejeita o envio em vez
 * de aceitar silenciosamente sem ela.
 */
function erroDeFotoInvalida(camada: Camada, registro: Record<string, unknown>): string | null {
  const bucket = BUCKET_FOTO[camada]
  if (!bucket) return null
  if (camada === 'pets' && registro.foto_url && !urlDoBucketValida(registro.foto_url, bucket)) {
    return 'Foto inválida. Tente anexar novamente.'
  }
  if (camada === 'classificados' && Array.isArray(registro.fotos)) {
    if (registro.fotos.some((f: unknown) => !urlDoBucketValida(f, bucket))) {
      return 'Uma ou mais fotos são inválidas. Tente anexar novamente.'
    }
  }
  if (camada === 'empregos' && registro.logo_url && !urlDoBucketValida(registro.logo_url, bucket)) {
    return 'Logo inválida. Tente anexar novamente.'
  }
  // Imóveis exige de 2 a 4 fotos (pedido do usuário) — mesma checagem de
  // bucket das outras camadas, mais o limite de quantidade, que a UI já
  // aplica mas uma chamada direta à API não teria como garantir sozinha.
  if (camada === 'imoveis') {
    if (!Array.isArray(registro.fotos) || registro.fotos.length < 2 || registro.fotos.length > 4) {
      return 'É preciso enviar de 2 a 4 fotos do imóvel.'
    }
    if (registro.fotos.some((f: unknown) => !urlDoBucketValida(f, bucket))) {
      return 'Uma ou mais fotos são inválidas. Tente anexar novamente.'
    }
  }
  return null
}

/** Dispara a análise de IA em segundo plano (fire-and-forget) — mesmo
 * disparo usado na criação, agora reaproveitado na edição. Se a chamada
 * falhar, o registro fica preso em 'pendente' até o botão "Reprocessar
 * pendentes travados" do painel master reenviar (mesmo comportamento já
 * existente pra criação). */
function dispararAnaliseIA(camada: 'pets' | 'classificados' | 'imoveis', id: string) {
  const rotaIA = camada === 'pets' ? '/api/ia/analisar-pet' : camada === 'classificados' ? '/api/ia/analisar-classificado' : '/api/ia/analisar-imovel'
  const corpoIA = camada === 'pets' ? { pet_id: id } : camada === 'classificados' ? { classificado_id: id } : { imovel_id: id }
  const base = process.env.SITE_URL || 'http://localhost:3000'
  fetch(`${base}${rotaIA}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_SECRET || '' },
    body: JSON.stringify(corpoIA),
  }).catch((err) => {
    console.error(`[IA] Falha ao disparar análise para ${camada} id=${id}:`, err?.message)
  })
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
    // BUG CORRIGIDO: validação bem mais fraca que /api/demandas — lat/lng
    // não tinham checagem de tipo (string ou NaN passavam) nem limite
    // geográfico (dava pra cadastrar em Tóquio), e campos que a UI sempre
    // exige (contato, título, cargo, nome da empresa) não eram exigidos
    // aqui, só no formulário — uma chamada direta à API passava sem eles.
    if (typeof dados.lat !== 'number' || typeof dados.lng !== 'number' || !Number.isFinite(dados.lat) || !Number.isFinite(dados.lng)) {
      return NextResponse.json({ error: 'Localização inválida.' }, { status: 400 })
    }
    if (!dentroFrutal(dados.lat, dados.lng)) {
      return NextResponse.json({ error: 'Localização fora da área de cobertura.' }, { status: 400 })
    }
    for (const campo of CAMPOS_OBRIGATORIOS[camada]) {
      if (!String(dados[campo] ?? '').trim()) {
        return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
      }
    }
    // Contato de pet é obrigatório, exceto pra "achado na rua" — pode ser só
    // um aviso de avistamento, sem o autor se responsabilizar pelo animal
    // (mesma regra já aplicada em FormPet.tsx e no prompt de moderação da IA).
    if (camada === 'pets' && dados.tipo !== 'achado' && !String(dados.contato ?? '').trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    // Data/hora aproximada é obrigatória só pra 'perdido'/'achado' (mesma
    // regra de exibeDataHora em FormPet.tsx) — 'adocao' não tem esse campo.
    if (camada === 'pets' && (dados.tipo === 'perdido' || dados.tipo === 'achado') && !dados.data_hora_aproximada) {
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

    // Localização de classificados é sempre aproximada — nunca confia no
    // "aproximado" que o cliente já mandou, recalcula aqui (ver comentário
    // de aproximarCoordenada acima).
    if (camada === 'classificados') {
      const aproximado = aproximarCoordenada(dados.lat, dados.lng)
      registro.lat = aproximado.lat
      registro.lng = aproximado.lng
    }

    // Reaproveita o mesmo helper usado no PATCH, em vez de duplicar a lógica
    // aqui (evita as duas divergirem com o tempo).
    const erroFotoCriacao = erroDeFotoInvalida(camada, registro)
    if (erroFotoCriacao) {
      return NextResponse.json({ error: erroFotoCriacao }, { status: 400 })
    }

    // Valida os enums (pets/classificados/empregos) antes do banco — sem
    // isso, um valor fora da lista só era barrado pelo CHECK constraint do
    // Postgres, devolvendo o erro cru do banco pro cliente em vez de uma
    // mensagem clara.
    const erroEnumCriacao = erroDeEnum(camada, registro)
    if (erroEnumCriacao) {
      return NextResponse.json({ error: erroEnumCriacao }, { status: 400 })
    }

    // Pets e classificados nascem com ia_decisao='pendente' — a rota de IA atualiza ao terminar.
    // Assim registros que nunca foram analisados ficam visíveis no master como pendentes.
    if (camada === 'pets' || camada === 'classificados' || camada === 'imoveis') {
      registro.ia_decisao = 'pendente'
    }

    const { data, error } = await supabaseServer
      .from(TABELAS[camada]).insert(registro).select().single()

    if (error) {
      console.error('[camadas POST]', error)
      return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 400 })
    }

    // Dispara análise de IA em segundo plano para pets e classificados
    if (data?.id && (camada === 'pets' || camada === 'classificados' || camada === 'imoveis')) {
      dispararAnaliseIA(camada, data.id)
    }

    return NextResponse.json({ ok: true, registro: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao salvar.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * PATCH /api/camadas  { camada: 'pets'|'classificados', id, dados }
 *
 * Edição de pet/classificado já aprovado pela IA. Antes ia direto do
 * cliente (RLS) e nunca reenviava pra moderação — ver o comentário grande
 * no topo do arquivo. Empregos NÃO passam por aqui: continuam editando
 * direto do cliente (nunca tiveram moderação de IA).
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    // Reanálise pela IA tem custo por chamada, igual à criação — mesmo
    // limite, chave separada pra não brigar pela mesma cota de criação.
    if (limiteExcedido(`camadas-editar:${user.id}`, 15, 10 * 60_000)) {
      return NextResponse.json({ error: 'Muitas edições em pouco tempo. Aguarde um pouco.' }, { status: 429 })
    }

    const body = await req.json()
    const camada = body?.camada as Camada
    const id = body?.id as string | undefined
    if (!id || (camada !== 'pets' && camada !== 'classificados' && camada !== 'imoveis')) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    const { data: existente } = await supabaseServer.from(TABELAS[camada]).select('user_id, lat, lng').eq('id', id).single()
    if (!existente) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
    // BUG CORRIGIDO (B10-3, decisão confirmada com o usuário): só o dono
    // podia editar — o master não tinha nenhum caminho pra corrigir o
    // conteúdo de um pet/classificado de outro usuário (só ocultar/aprovar/
    // excluir, no painel). Dono continua liberado sem consulta extra;
    // qualquer outra pessoa só passa se for master.
    if (existente.user_id !== user.id) {
      const { data: perfilEditor } = await supabaseServer.from('perfis').select('role').eq('id', user.id).single()
      if (perfilEditor?.role !== 'master') return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    }

    const dados = body?.dados ?? {}
    const atualizacao: Record<string, unknown> = {}
    for (const campo of CAMPOS[camada]) {
      if (dados[campo] !== undefined) atualizacao[campo] = dados[campo]
    }

    const erroFoto = erroDeFotoInvalida(camada, atualizacao)
    if (erroFoto) return NextResponse.json({ error: erroFoto }, { status: 400 })
    const erroEnum = erroDeEnum(camada, atualizacao)
    if (erroEnum) return NextResponse.json({ error: erroEnum }, { status: 400 })

    // Localização de classificados é sempre aproximada (ver aproximarCoordenada
    // acima). Só recalcula se o ponto mudou de verdade — comparado ao que já
    // estava salvo (que já é aproximado) — senão cada edição sem trocar o
    // local (ex: só o preço) deslocaria o pin de novo, degradando a precisão
    // a cada save sem necessidade nenhuma.
    if (camada === 'classificados' && atualizacao.lat !== undefined && atualizacao.lng !== undefined) {
      const mudouLocal = atualizacao.lat !== existente.lat || atualizacao.lng !== existente.lng
      if (mudouLocal) {
        const aproximado = aproximarCoordenada(atualizacao.lat as number, atualizacao.lng as number)
        atualizacao.lat = aproximado.lat
        atualizacao.lng = aproximado.lng
      } else {
        atualizacao.lat = existente.lat
        atualizacao.lng = existente.lng
      }
    }

    // O motivo de tudo isto existir: volta pra moderação como se fosse
    // recém-criado — some do mapa público (que só mostra ia_decisao =
    // 'aprovada') até a IA (re)analisar o conteúdo novo.
    atualizacao.ia_decisao = 'pendente'
    atualizacao.ia_motivo = null
    atualizacao.ia_analisado_em = null

    const { data, error } = await supabaseServer
      .from(TABELAS[camada]).update(atualizacao).eq('id', id).select().single()

    if (error) {
      console.error('[camadas PATCH]', error)
      return NextResponse.json({ error: 'Não foi possível salvar a edição.' }, { status: 400 })
    }

    dispararAnaliseIA(camada, id)

    return NextResponse.json({ ok: true, registro: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao salvar edição.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
