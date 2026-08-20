'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import { validarCPF, formatarCPF } from '@/lib/cpf'

export default function ModalCPF() {
  const { user, setPerfil, sair } = useAuth()
  const supabase = createClient()
  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  )
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!validarCPF(cpf)) { setErro('CPF inválido. Verifique e tente novamente.'); return }
    if (!user) return
    setEnviando(true)
    if (!nome.trim()) { setErro('Informe seu nome completo.'); setEnviando(false); return }
    try {
      const cpfLimpo = cpf.replace(/\D/g, '')
      const { error } = await supabase.from('perfis').upsert({
        id: user.id,
        nome: nome.trim(),
        cpf: cpfLimpo,
      })
      if (error) throw error
      setPerfil({ id: user.id, nome: nome.trim(), cpf: cpfLimpo })
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '380px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#1e3a5f', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '18px', color: 'white' }}>Quase lá!</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Complete seu cadastro</div>
        </div>

        {/* Body */}
        <form onSubmit={handleEnviar} style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 4px', lineHeight: 1.5 }}>
              Para continuar, precisamos de mais algumas informações.
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Seu CPF nunca será exibido publicamente.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Nome completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
              required
              style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
            {nome && <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>Pré-preenchido com sua conta Google. Corrija se necessário.</p>}
          </div>

          {erro && (
            <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>
              {erro}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>CPF *</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => handleCPF(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              required
              style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '11px 14px', fontSize: '15px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em' }}
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            style={{ backgroundColor: enviando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 700, padding: '13px', borderRadius: '8px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '15px' }}
          >
            {enviando ? 'Salvando...' : 'Confirmar e entrar'}
          </button>

          <button
            type="button"
            onClick={sair}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9ca3af', padding: '4px', textDecoration: 'underline' }}
          >
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  )
}
