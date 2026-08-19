'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { validarCPF, formatarCPF } from '@/lib/cpf'
import { Entidade } from '@/types'

export default function FormDenuncia() {
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
    if (!mensagem.trim() || mensagem.trim().length < 20) {
      setErro('Descreva melhor a situação (mínimo 20 caracteres).')
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

  if (sucesso) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <p className="text-green-800 font-semibold">Denúncia enviada com sucesso.</p>
        <p className="text-green-700 text-sm mt-1">
          Sua denúncia foi recebida e será analisada. Se aprovada, será publicada para toda a cidade acompanhar.
        </p>
        <button onClick={() => setSucesso(false)} className="mt-3 text-sm text-green-700 underline">
          Enviar outra denúncia
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Registrar Cobrança</h2>

      {erro && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
          {erro}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome Completo *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CPF *</label>
          <input
            type="text"
            value={cpf}
            onChange={(e) => handleCPF(e.target.value)}
            placeholder="000.000.000-00"
            maxLength={14}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Destinatário</label>
        <select
          value={entidadeId}
          onChange={(e) => setEntidadeId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione (opcional)</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>{e.nome} — {e.cargo}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem *</label>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={5}
          placeholder="Descreva a situação ou cobrança..."
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Nome e CPF serão exibidos publicamente se aprovado. Evite ofensas.
        </p>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="bg-blue-800 hover:bg-blue-900 disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded text-sm transition-colors"
      >
        {enviando ? 'Enviando...' : 'Enviar Denúncia'}
      </button>
    </form>
  )
}
