'use client'

import { useState } from 'react'
import { validarCPF, formatarCPF } from '@/lib/cpf'

export interface DadosIdentificacao {
  nome: string
  cpf?: string
  metodo: 'google' | 'cpf'
}

interface Props {
  onConfirmar: (dados: DadosIdentificacao) => void
  onFechar: () => void
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default function ModalIdentificacao({ onConfirmar, onFechar }: Props) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [erro, setErro] = useState('')
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)

  function capitalizarNome(valor: string) {
    return valor.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  function confirmarCPF() {
    setErro('')
    if (!nome.trim() || nome.trim().split(' ').length < 2) {
      setErro('Informe seu nome completo.')
      return
    }
    if (!validarCPF(cpf)) {
      setErro('CPF inválido.')
      return
    }
    onConfirmar({ nome: nome.trim(), cpf: cpf.replace(/\D/g, ''), metodo: 'cpf' })
  }

  function iniciarGoogle() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      setErro('Google Sign-In não configurado. Use o CPF.')
      return
    }
    setCarregandoGoogle(true)
    setErro('')

    function abrirPopup() {
      ;(window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          try {
            const payload = JSON.parse(atob(response.credential.split('.')[1]))
            const nomeGoogle = payload.name || payload.given_name || ''
            ;(window as any).google.accounts.id.disableAutoSelect()
            onConfirmar({ nome: nomeGoogle, metodo: 'google' })
          } catch {
            setErro('Erro ao identificar com Google. Tente pelo CPF.')
            setCarregandoGoogle(false)
          }
        },
        auto_select: false,
      })
      ;(window as any).google.accounts.id.prompt((notif: any) => {
        if (notif.isSkippedMoment() || notif.isDismissedMoment()) {
          setCarregandoGoogle(false)
        }
      })
    }

    if ((window as any).google?.accounts?.id) {
      abrirPopup()
    } else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.onload = () => abrirPopup()
      script.onerror = () => {
        setErro('Não foi possível carregar o Google. Tente pelo CPF.')
        setCarregandoGoogle(false)
      }
      document.head.appendChild(script)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Identificação</h2>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            Para registrar, confirme quem você é. Seu nome aparecerá publicamente na denúncia.
          </p>

          {erro && (
            <div style={{ color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>
              {erro}
            </div>
          )}

          {/* Google */}
          <button
            onClick={iniciarGoogle}
            disabled={carregandoGoogle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '11px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: carregandoGoogle ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 600, color: '#111827' }}
          >
            <GoogleIcon />
            {carregandoGoogle ? 'Abrindo Google...' : 'Continuar com Google'}
          </button>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            <span style={{ fontSize: '12px', color: '#6b7280' }}>ou identifique-se com CPF</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          </div>

          {/* CPF */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Nome Completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(capitalizarNome(e.target.value))}
                placeholder="Seu nome completo"
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>CPF *</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => handleCPF(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={confirmarCPF}
              style={{ backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
