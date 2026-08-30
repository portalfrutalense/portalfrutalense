'use client'

import { useAuth } from './AuthProvider'
import ModalCPF from './ModalCPF'

export default function GlobalModals() {
  const { precisaCPF, bloqueado, sair } = useAuth()

  if (bloqueado) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
        </svg>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Acesso bloqueado</h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
          Sua conta foi bloqueada. Entre em contato com a administração do CidadanIA Frutal para mais informações.
        </p>
        <button onClick={sair} style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
          Sair
        </button>
      </div>
    </div>
  )

  if (precisaCPF) return <ModalCPF />
  return null
}
