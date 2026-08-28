'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function PageRedefinirSenha() {
  const supabase = createClient()
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [sessaoOk, setSessaoOk] = useState(false)

  useEffect(() => {
    // O Supabase processa o hash da URL automaticamente e cria uma sessão temporária
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessaoOk(true)
      else setErro('Link inválido ou expirado. Solicite um novo link de redefinição.')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro('Erro ao redefinir a senha. Tente novamente.')
    } else {
      setSucesso(true)
      setTimeout(() => router.push('/'), 3000)
    }
    setCarregando(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '360px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div style={{ background: '#4256c8', height: '66px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '46px', width: 'auto' }} />
        </div>

        <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>Redefinir senha</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Digite sua nova senha abaixo.</p>
          </div>

          {erro && (
            <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>
              {erro}
            </div>
          )}

          {sucesso ? (
            <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px', fontSize: '14px', lineHeight: 1.5, textAlign: 'center' }}>
              ✅ Senha redefinida com sucesso! Redirecionando...
            </div>
          ) : sessaoOk ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="Nova senha (mín. 6 caracteres)"
                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                placeholder="Confirme a nova senha"
                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                type="submit"
                disabled={carregando}
                style={{ backgroundColor: carregando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 700, padding: '12px', borderRadius: '8px', border: 'none', cursor: carregando ? 'not-allowed' : 'pointer', fontSize: '15px', marginTop: '4px' }}>
                {carregando ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          ) : !erro ? (
            <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>Verificando link...</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
