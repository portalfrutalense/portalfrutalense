import { Denuncia } from '@/types'

interface Props {
  denuncia: Denuncia
}

const statusConfig = {
  aguardando_resposta: {
    label: 'Aguardando Resposta',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  respondida: {
    label: 'Respondida',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
}

export default function CardDenuncia({ denuncia }: Props) {
  const status = statusConfig[denuncia.status as keyof typeof statusConfig]
  const data = new Date(denuncia.created_at).toLocaleDateString('pt-BR')

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-gray-100">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{denuncia.morador_nome}</p>
          <p className="text-gray-400 text-xs font-mono mt-0.5">{denuncia.morador_cpf_display}</p>
          {denuncia.entidade && (
            <p className="text-xs text-gray-500 mt-1">
              Para: <span className="font-medium text-gray-700">{denuncia.entidade.nome}</span> — {denuncia.entidade.cargo}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {status && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded border ${status.className}`}>
              {status.label}
            </span>
          )}
          <span className="text-xs text-gray-400">{data}</span>
        </div>
      </div>

      {/* Mensagem */}
      <div className="px-5 py-4">
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{denuncia.mensagem}</p>
      </div>

      {/* Resposta */}
      {denuncia.status === 'respondida' && denuncia.resposta && (
        <div className="mx-5 mb-4 bg-blue-50 border border-blue-100 rounded p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Resposta Oficial</p>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{denuncia.resposta}</p>
          {denuncia.respondido_em && (
            <p className="text-xs text-gray-400 mt-2">
              {new Date(denuncia.respondido_em).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
