'use client'

import { useState } from 'react'
import { Denuncia } from '@/types'
import CardDenuncia from '@/components/CardDenuncia'

interface Props {
  denuncias: Denuncia[]
}

export default function ListaDenuncias({ denuncias }: Props) {
  const [entidadeId, setEntidadeId] = useState('')

  // Monta lista única de entidades presentes nas denúncias
  const entidades = Array.from(
    new Map(
      denuncias
        .filter(d => d.entidade)
        .map(d => [d.entidade!.id, d.entidade!])
    ).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome))

  const filtradas = entidadeId
    ? denuncias.filter(d => d.entidade_id === entidadeId)
    : denuncias

  return (
    <div>
      {entidades.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>Filtrar por:</label>
          <select
            value={entidadeId}
            onChange={(e) => setEntidadeId(e.target.value)}
            style={{ flex: 1, maxWidth: '320px', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', background: 'white', outline: 'none', color: '#111827' }}
          >
            <option value="">Todas as autoridades</option>
            {entidades.map(e => (
              <option key={e.id} value={e.id}>{e.nome} — {e.cargo}</option>
            ))}
          </select>
          {entidadeId && (
            <button onClick={() => setEntidadeId('')}
              style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Limpar
            </button>
          )}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '14px' }}>Nenhuma denúncia encontrada.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtradas.map((d) => (
            <CardDenuncia key={d.id} denuncia={d} />
          ))}
        </div>
      )}
    </div>
  )
}
