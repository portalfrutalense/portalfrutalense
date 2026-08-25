'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import { validarCPF, formatarCPF } from '@/lib/cpf'

function capitalizarNome(str: string) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

function formatarWhatsapp(valor: string) {
  // Mantém só dígitos, máximo 13 (55 + DDD + 9 dígitos)
  return valor.replace(/\D/g, '').slice(0, 13)
}

export default function ModalCPF() {
  const { user, setPerfil, sair } = useAuth()
  const supabase = createClient()
  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState(
    capitalizarNome(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
  )
  const [whatsapp, setWhatsapp] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome completo.'); return }
    if (!validarCPF(cpf)) { setErro('CPF inválido. Verifique e tente novamente.'); return }
    if (!user) return
    setEnviando(true)
    try {
      const cpfLimpo = cpf.replace(/\D/g, '')

      // Verifica se o perfil já existe (ex: usuário master que ainda não preencheu CPF)
      const { data: perfilExistente, error: erroLeitura } = await supabase
        .from('perfis').select('id, role').eq('id', user.id).maybeSingle()
      if (erroLeitura) throw erroLeitura

      const campos: Record<string, unknown> = {
        nome: nome.trim(),
        cpf: cpfLimpo,
      }
      if (whatsapp) campos.whatsapp = whatsapp
      if (dataNascimento) campos.data_nascimento = dataNascimento

      let error
      if (perfilExistente) {
        ;({ error } = await supabase.from('perfis').update(campos).eq('id', user.id))
      } else {
        ;({ error } = await supabase.from('perfis').insert({ id: user.id, email: user.email || null, role: 'cidadao', ...campos }))
      }
      if (error) throw error

      // Se informou WhatsApp, vincula conversa pendente (se houver)
      if (whatsapp) {
        await supabase.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', whatsapp)
      }

      setPerfil({ id: user.id, nome: nome.trim(), cpf: cpfLimpo, email: user.email || undefined, role: perfilExistente?.role })
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: string; hint?: string }
      console.error('[ModalCPF] falha ao salvar perfil:', {
        code: err.code, message: err.message, details: err.details, hint: err.hint,
      })
      const detalhe = [err.code, err.message].filter(Boolean).join(' — ')
      setErro(detalhe ? `Erro ao salvar: ${detalhe}` : 'Erro ao salvar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '380px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#4256c8', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '18px', color: 'white' }}>Quase lá!</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Complete seu cadastro</div>
        </div>

        {/* Body */}
        <form onSubmit={handleEnviar} style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#111827', margin: '0 0 4px', lineHeight: 1.5 }}>
              Para continuar, precisamos de mais algumas informações.
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Seus dados nunca serão exibidos publicamente.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>Nome completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
              required
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
            {nome && <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>Pré-preenchido com sua conta Google. Corrija se necessário.</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>CPF *</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => handleCPF(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              required
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '15px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>Data de nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>WhatsApp</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatarWhatsapp(e.target.value))}
              placeholder="5534999999999"
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.03em' }}
            />
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>Com código do país e DDD. Ex: 5534999999999</p>
          </div>

          {erro && (
            <div style={{ color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            style={{ backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 700, padding: '13px', borderRadius: '8px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '15px' }}
          >
            {enviando ? 'Salvando...' : 'Confirmar e entrar'}
          </button>

          <button
            type="button"
            onClick={sair}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', padding: '4px', textDecoration: 'underline' }}
          >
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  )
}
