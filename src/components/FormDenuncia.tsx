'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Entidade } from '@/types'
import ModalIdentificacao, { DadosIdentificacao } from './ModalIdentificacao'

export default function FormDenuncia() {
  const [etapa, setEtapa] = useState<'fechado' | 'identificacao' | 'formulario'>('fechado')
  const [identificacao, setIdentificacao] = useState<DadosIdentificacao | null>(null)

  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [entidadeId, setEntidadeId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('entidades').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setEntidades(data || []))
  }, [])

  function abrir() {
    setEtapa('identificacao')
    setSucesso(false)
    setErro('')
  }

  function fechar() {
    setEtapa('fechado')
    setIdentificacao(null)
    setEntidadeId('')
    setMensagem('')
    setSucesso(false)
    setErro('')
  }

  function onIdentificado(dados: DadosIdentificacao) {
    setIdentificacao(dados)
    setEtapa('formulario')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!identificacao) return
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
          morador_nome: identificacao.nome,
          morador_cpf: identificacao.cpf || null,
          verificacao_metodo: identificacao.metodo,
          entidade_id: entidadeId || null,
          mensagem: mensagem.trim(),
        }),
      })
      if (!res.ok) throw new Error()
      setSucesso(true)
      setEntidadeId('')
      setMensagem('')
    } catch {
      setErro('Ocorreu um erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
      >
        + Registrar Denúncia
      </button>

      {/* Passo 1: identificação */}
      {etapa === 'identificacao' && (
        <ModalIdentificacao onConfirmar={onIdentificado} onFechar={fechar} />
      )}

      {/* Passo 2: formulário */}
      {etapa === 'formulario' && identificacao && (
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

                {/* Nome travado */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Nome</label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', background: '#f0fdf4' }}>
                    <span style={{ fontSize: '14px', color: '#166534', fontWeight: 500 }}>{identificacao.nome}</span>
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', borderRadius: '4px', padding: '2px 7px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                      {identificacao.metodo === 'google' ? '✓ Google' : '✓ CPF'}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Autoridade</label>
                  <select
                    value={entidadeId}
                    onChange={(e) => setEntidadeId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">Selecione a autoridade (opcional)</option>
                    {entidades.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome} — {e.cargo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Mensagem *</label>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    rows={5}
                    placeholder="Descreva a situação..."
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  style={{ backgroundColor: enviando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                >
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
