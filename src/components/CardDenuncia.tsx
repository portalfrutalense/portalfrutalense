import { Denuncia } from '@/types'

interface Props {
  denuncia: Denuncia
}

const statusConfig = {
  aguardando_resposta: {
    label: 'Aguardando Resposta',
    style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },
  },
  respondida: {
    label: 'Respondida',
    style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
  },
  nao_respondida: {
    label: 'Não Respondida',
    style: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  },
}

export default function CardDenuncia({ denuncia }: Props) {
  const status = statusConfig[denuncia.status as keyof typeof statusConfig]
  const data = new Date(denuncia.created_at).toLocaleDateString('pt-BR')

  return (
    <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <p style={{ fontWeight: 600, color: '#111827', fontSize: '14px', margin: 0 }}>{denuncia.morador_nome}</p>
          {denuncia.entidade && (
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
              Para: <strong style={{ color: '#374151' }}>{denuncia.entidade.nome}</strong> — {denuncia.entidade.cargo}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
          {status && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '4px', ...status.style }}>
              {status.label}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{data}</span>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{denuncia.mensagem}</p>
      </div>

      {denuncia.status === 'respondida' && denuncia.resposta && (
        <div style={{ margin: '0 20px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '14px 16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Resposta Oficial</p>
          {denuncia.entidade && (
            <p style={{ fontSize: '12px', color: '#1e40af', margin: '0 0 10px' }}>
              {denuncia.entidade.nome} — {denuncia.entidade.cargo}
            </p>
          )}
          <p style={{ color: '#1e3a5f', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{denuncia.resposta}</p>
          <p style={{ fontSize: '11px', color: '#93c5fd', margin: '8px 0 0' }}>
            {denuncia.respondido_em && new Date(denuncia.respondido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            {denuncia.resposta_ip && ` · IP ${denuncia.resposta_ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.xx.xx')}`}
          </p>
        </div>
      )}
    </div>
  )
}
