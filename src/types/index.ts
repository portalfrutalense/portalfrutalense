// LIMPEZA (código morto): estava exportado, mas nenhum arquivo do projeto o
// importa — só é usado internamente aqui embaixo, como o tipo de
// `Demanda.status`. Deixa de ser exportado.
type StatusDemanda = 'pendente' | 'aguardando_resposta' | 'respondida' | 'rejeitada_ia' | 'resolvida' | 'nao_resolvida' | 'denunciada'

/** Os 4 papéis que existem em `perfis.role` — todo o sistema de permissão
 * do site se baseia nessa comparação, então vale a pena fixar o tipo em
 * vez de deixar como string solta (onde um erro de digitação passaria
 * batido no compilador). */
export type Role = 'cidadao' | 'autoridade' | 'empresa' | 'master'

export interface DemandaEntidade {
  id: string
  demanda_id: string
  entidade_id: string
  entidade?: Entidade
  status: 'aguardando_resposta' | 'respondida'
  resposta?: string
  respondida_em?: string
}

export interface Demanda {
  id: string
  user_id: string
  morador_nome: string
  morador_cpf?: string
  categoria_id: string
  categoria?: CategoriaMapa
  /** BUG CORRIGIDO (B03-4): tipado como obrigatório, mas é coluna legada
   * anterior a `demanda_entidades` (permite NULL no banco — ver
   * `sql/migration-demandas.sql`). Hoje `/api/demandas` sempre preenche com
   * a primeira autoridade escolhida, então nunca é nulo na prática, mas o
   * tipo não deveria prometer isso ao compilador. Sem consumidores reais
   * (busca confirmou: nenhum lugar do app lê `Demanda.entidade_id`). */
  entidade_id: string | null
  entidade?: Entidade
  descricao: string
  lat: number
  lng: number
  endereco_label?: string
  foto_url?: string
  status: StatusDemanda
  ia_decisao?: string
  ia_motivo?: string
  resposta?: string
  respondido_em?: string
  vinculos?: DemandaEntidade[]
  link_enviado?: boolean
  oculto?: boolean
  created_at: string
  protocolo?: string
}

export interface Entidade {
  id: string
  nome: string
  cargo: string
  email: string
  foto_url?: string
  ativo: boolean
  created_at: string
}

export interface CategoriaMapa {
  id: string
  nome: string
  cor: string
  icone?: string
  icone_url?: string
  ativo: boolean
}

/* ----------------------------------------------------- camadas do mapa --- */

export type Camada = 'demandas' | 'pets' | 'classificados' | 'empregos'

/** Cores e ícones de cada pin, editáveis no painel master. */
export interface CamadaConfig {
  chave: string
  camada: Camada
  rotulo: string
  cor: string
  icone_url?: string
  ordem: number
  ativo: boolean
}

/* --------------------------------------------------------------- pets --- */

/** 'perdido', 'achado' e 'adocao' são registros independentes — nunca se convertem. */
export type TipoPet = 'perdido' | 'achado' | 'adocao'
export type EspeciePet = 'cachorro' | 'gato'
export type PortePet = 'pequeno' | 'medio' | 'grande'

export interface Pet {
  id: string
  user_id: string
  autor_nome: string
  tipo: TipoPet
  /** Só 'perdido' pode ser marcado como reencontrado. */
  reencontrado: boolean
  reencontrado_em?: string
  especie: EspeciePet
  nome_pet?: string
  raca?: string
  cor?: string
  porte?: PortePet
  descricao: string
  /** Data/hora aproximada de quando sumiu ('perdido') ou foi encontrado
   * ('achado') — obrigatório só nesses dois tipos (ver FormPet.tsx). */
  data_hora_aproximada?: string
  lat: number
  lng: number
  endereco_label?: string
  foto_url?: string
  contato: string
  oculto?: boolean
  ia_decisao?: string
  ia_motivo?: string
  ia_analisado_em?: string
  protocolo?: string
  expira_em: string
  created_at: string
  updated_at: string
}

/* ------------------------------------------------------- classificados --- */

export type TipoVeiculo = 'carro' | 'moto' | 'onibus' | 'caminhao'

export interface Classificado {
  id: string
  user_id: string
  autor_nome: string
  tipo_veiculo: TipoVeiculo
  titulo: string
  marca?: string
  modelo?: string
  ano?: number
  km?: number
  cor?: string
  preco?: number
  aceita_troca: boolean
  descricao: string
  /** Coordenada já aproximada — o endereço exato nunca chega ao cliente. */
  lat: number
  lng: number
  bairro_label?: string
  fotos: string[]
  contato: string
  vendido: boolean
  oculto?: boolean
  ia_decisao?: string
  ia_motivo?: string
  ia_analisado_em?: string
  protocolo?: string
  created_at: string
  updated_at: string
}

/* ----------------------------------------------------------- empregos --- */

export type TipoContrato = 'clt' | 'pj' | 'temporario' | 'estagio' | 'freelance'

export interface Emprego {
  id: string
  user_id: string
  empresa_nome: string
  cargo: string
  area?: string
  contrato: TipoContrato
  salario?: number
  salario_a_combinar: boolean
  vagas: number
  descricao: string
  requisitos?: string
  lat: number
  lng: number
  endereco_label?: string
  logo_url?: string
  contato: string
  encerrada: boolean
  oculto?: boolean
  protocolo?: string
  created_at: string
  updated_at: string
}

/* -------------------------------------------------------------- perfil --- */

// BUG CORRIGIDO (B03-5): não existia um tipo `Perfil` central — era
// redefinido à mão em `AuthProvider.tsx` e de novo (com campos a mais, pra
// listagem administrativa) como `PerfilLinha` em `master/page.tsx`. Centraliza
// aqui a forma "de sessão" (a que `AuthProvider` expõe pro resto do app via
// contexto); `master/page.tsx` continua com seu próprio `PerfilLinha` (a
// listagem do painel precisa de campos extras — `cargo`, `_legado` — e trata
// `role` como texto solto pra também caber autoridades legadas sem role
// definido), mas agora derivado deste em vez de redigitado do zero.
export interface Perfil {
  id: string
  nome: string
  cpf: string
  email?: string
  role?: Role
  bloqueado?: boolean
  whatsapp?: string
  data_nascimento?: string
}
