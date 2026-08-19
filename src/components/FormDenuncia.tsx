'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { validarCPF, formatarCPF } from '@/lib/cpf'
import { Entidade } from '@/types'

export default function FormDenuncia() {
  const [modalAberto, setModalAberto] = useState(false)
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [entidadeId, setEntidadeId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('entidades').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setEntidades(data || []))
  }, [])

  function fechar() {
    setModalAberto(false)
    setSucesso(false)
    setErro('')
  }

  function capitalizarNome(valor: string) {
    return valor.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!nome.trim() || nome.trim().split(' ').length < 2) {
      setErro('Informe seu nome completo.')
      return
    }
    if (!validarCPF(cpf)) {
      setErro('CPF inválido.')
      return
    }
    if (!mensagem.trim() || mensagem.trim().length < 10) {
      setErro('Descreva melhor a situação (mínimo 10 caracteres).')
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/denuncias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          morador_nome: nome.trim(),
          morador_cpf: cpf.replace(/\D/g, ''),
          entidade_id: entidadeId || null,
          mensagem: mensagem.trim(),
        }),
      })
      if (!res.ok) throw new Error()
      setSucesso(true)
      setNome(''); setCpf(''); setEntidadeId(''); setMensagem('')
    } catch {
      setErro('Ocorreu um erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button onClick={() => { setModalAberto(true); setSucesso(false) }}
        style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
        Registrar Denúncia
      </button>

      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Registrar Denúncia</h2>
              <button onClick={fechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9ca3af', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {sucesso ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#166534', fontSize: '15px' }}>Denúncia enviada com sucesso.</p>
                <p style={{ color: '#15803d', fontSize: '13px', marginTop: '4px' }}>
                  Sua denúncia foi recebida e será analisada. Se aprovada, será publicada para toda a cidade acompanhar.
                </p>
                <button onClick={fechar} style={{ marginTop: '16px', fontSize: '13px', color: '#1e3a5f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {erro && (
                  <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>
                    {erro}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="grid-2col">
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Nome Completo *</label>
                    <input type="text" value={nome} onChange={(e) => setNome(capitalizarNome(e.target.value))} placeholder="Seu nome completo"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>CPF *</label>
                    <input type="text" value={cpf} onChange={(e) => handleCPF(e.target.value)} placeholder="000.000.000-00" maxLength={14}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Destinatário</label>
                  <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Selecione (opcional)</option>
                    {entidades.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome} — {e.cargo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Mensagem *</label>
                  <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={5} placeholder="Descreva a situação..."
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <button type="submit" disabled={enviando}
                  style={{ backgroundColor: enviando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Enviando...' : 'Enviar Denúncia'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
