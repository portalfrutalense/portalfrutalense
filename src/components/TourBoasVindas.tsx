'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'

const ITENS_BASE = [
  { label: 'Demandas municipais', desc: 'Registre problemas da cidade e acompanhe respostas da prefeitura.' },
  { label: 'Empregos', desc: 'Veja vagas disponíveis em Frutal e região.' },
  { label: 'Classificados', desc: 'Compre, venda ou anuncie serviços locais.' },
  { label: 'Achei/perdi um pet', desc: 'Ajude a reunir pets perdidos com seus donos.' },
]

// BUG CORRIGIDO: /mapa é página pública (mostra banner de "Faça login...")
// e o tour aparecia também pra quem não está logado — o último item
// ("Olá, seu nome") descreve um elemento que só existe depois do login.
const ITEM_LOGADO = { label: 'Olá, seu nome (canto superior direito)', desc: 'Acesse suas atividades, demandas registradas e informações da conta.' }

export default function TourBoasVindas() {
  const { user } = useAuth()
  const [visivel, setVisivel] = useState(false)
  const itens = user ? [...ITENS_BASE, ITEM_LOGADO] : ITENS_BASE

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        if (!localStorage.getItem('tour_visto')) setVisivel(true)
      } catch {}
    })
  }, [])

  function fechar() {
    try { localStorage.setItem('tour_visto', '1') } catch {}
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }} onClick={fechar}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '16px', padding: '28px 24px 24px',
        maxWidth: '380px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4256c8', margin: '0 0 6px' }}>Bem-vindo ao</p>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0d1425', margin: '0 0 6px' }}>CidadanIA Frutal</h2>
          <p style={{ fontSize: '13.5px', color: '#6b7280', margin: 0 }}>Use os atalhos da barra superior para navegar entre as funcionalidades:</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          {itens.map(({ label, desc }) => (
            <div key={label} style={{
              background: '#f9fafb', borderRadius: '10px', padding: '12px',
            }}>
              <p style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 600, color: '#0d1425' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#6b7280', lineHeight: 1.45 }}>{desc}</p>
            </div>
          ))}
        </div>

        <button onClick={fechar} style={{
          width: '100%', background: '#4256c8', color: '#fff',
          border: 'none', borderRadius: '10px', padding: '13px',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>
          Entendido, vamos lá!
        </button>
      </div>
    </div>
  )
}
