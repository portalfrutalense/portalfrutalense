export type StatusDemanda = 'pendente' | 'aguardando_resposta' | 'respondida' | 'rejeitada_ia' | 'resolvida' | 'nao_resolvida'

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
  entidade_id: string
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
