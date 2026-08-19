import { Denuncia } from '@/types'
import { Clock, CheckCircle, User, Building2 } from 'lucide-react'

interface Props {
  denuncia: Denuncia
}

const statusConfig = {
  aguardando_resposta: {
    label: '⌛ Aguardando Resposta',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  respondida: {
    label: '✅ Respondida',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
}

export default function CardDenuncia({ denuncia }: Props) {
  const status = statusConfig[denuncia.status as keyof typeof statusConfig]
  const data = new Date(denuncia.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header do card */}
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          {/* Destinatário */}
          {denuncia.entidade && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
              <Building2 size={14} />
              <span>Para: <strong>{denuncia.entidade.nome}</strong> · {denuncia.entidade.cargo}</span>
            </div>
          )}

          {/* Autor */}
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <User size={14} />
            <span className="font-medium">{denuncia.morador_nome}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400 font-mono text-xs">{denuncia.morador_cpf_display}</span>
          </div>
        </div>

        {/* Status badge */}
        {status && (
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${status.className}`}>
            {status.label}
          </span>
        )}
      </div>

      {/* Mensagem */}
      <div className="px-5 py-3">
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{denuncia.mensagem}</p>
      </div>

      {/* Resposta (se houver) */}
      {denuncia.status === 'respondida' && denuncia.resposta && (
        <div className="mx-5 mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs font-bold text-green-700 mb-1 uppercase tracking-wide">
            Resposta Oficial
          </p>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {denuncia.resposta}
          </p>
          {denuncia.respondido_em && (
            <p className="text-xs text-gray-400 mt-2">
              Respondido em {new Date(denuncia.respondido_em).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400">
        <Clock size={12} />
        <span>Publicado em {data}</span>
      </div>
    </div>
  )
}
