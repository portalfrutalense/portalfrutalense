export type StatusDenuncia = 'pendente' | 'aguardando_resposta' | 'aguardando_aprovacao_resposta' | 'respondida' | 'rejeitada' | 'nao_respondida'
export type StatusOcorrencia = 'pendente' | 'publicada' | 'rejeitada' | 'resolvida'

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
  cor: string // hex, ex: "#ef4444"
  icone?: string
  ativo: boolean
}

export interface Denuncia {
  id: string
  morador_nome: string
  morador_cpf: string // armazenado hasheado no banco
  morador_cpf_display: string // ex: "123.456.789-00" (somente para exibição após aprovação)
  mensagem: string
  status: StatusDenuncia
  entidade_id?: string
  entidade?: Entidade
  resposta?: string
  respondido_em?: string
  resposta_ip?: string
  magic_token?: string
  magic_token_expira_em?: string
  created_at: string
  updated_at: string
}

export interface Ocorrencia {
  id: string
  morador_nome: string
  morador_cpf: string
  descricao: string
  lat: number
  lng: number
  foto_url?: string
  endereco_label?: string
  status: StatusOcorrencia
  categoria_id: string
  categoria?: CategoriaMapa
  created_at: string
  updated_at: string
}
