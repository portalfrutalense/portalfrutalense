'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Ocorrencia, CategoriaMapa } from '@/types'
import { validarCPF, formatarCPF } from '@/lib/cpf'
import { MapPin, X, Send, AlertCircle } from 'lucide-react'

// Coordenadas centrais de Frutal-MG
const FRUTAL_CENTER = { lat: -20.0264, lng: -48.9383 }

export default function MapaOcorrencias() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [marcando, setMarcando] = useState<{ lat: number; lng: number } | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionada, setSelecionada] = useState<Ocorrencia | null>(null)

  // Form state
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('ocorrencias').select('*, categoria:categorias_mapa(*)').eq('status', 'publicada'),
      supabase.from('categorias_mapa').select('*').eq('ativo', true).order('nome'),
    ]).then(([{ data: ocs }, { data: cats }]) => {
      setOcorrencias((ocs || []) as Ocorrencia[])
      setCategorias((cats || []) as CategoriaMapa[])
    })
  }, [])

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim() || nome.trim().split(' ').length < 2) { setErro('Nome completo obrigatório.'); return }
    if (!validarCPF(cpf)) { setErro('CPF inválido.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva melhor o problema.'); return }
    if (!categoriaId) { setErro('Selecione a categoria.'); return }
    if (!marcando) { setErro('Marque a localização no mapa.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          morador_nome: nome.trim(),
          morador_cpf: cpf.replace(/\D/g, ''),
          descricao: descricao.trim(),
          lat: marcando.lat,
          lng: marcando.lng,
          categoria_id: categoriaId,
        }),
      })
      if (!res.ok) throw new Error()
      setSucesso(true)
      setNome(''); setCpf(''); setDescricao(''); setCategoriaId(''); setMarcando(null)
    } catch {
      setErro('Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  // Mapa simples via iframe OpenStreetMap (sem API key)
  return (
    <div className="space-y-4">
      {/* Legenda de categorias */}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <span key={cat.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 font-medium">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: cat.cor }} />
              {cat.nome}
            </span>
          ))}
        </div>
      )}

      {/* Mapa embed (OpenStreetMap) */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          title="Mapa de Ocorrências - Frutal MG"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${FRUTAL_CENTER.lng - 0.05},${FRUTAL_CENTER.lat - 0.05},${FRUTAL_CENTER.lng + 0.05},${FRUTAL_CENTER.lat + 0.05}&layer=mapnik`}
          className="w-full h-[480px]"
        />
        <div className="absolute top-3 right-3 bg-white rounded-lg shadow px-3 py-2 text-xs text-gray-500">
          {ocorrencias.length} ocorrência(s) publicada(s)
        </div>
      </div>

      {/* Botão registrar */}
      <button
        onClick={() => { setModalAberto(true); setSucesso(false) }}
        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
      >
        <MapPin size={16} />
        Registrar Ocorrência
      </button>

      {/* Modal de registro */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-gray-800">📍 Registrar Ocorrência</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {sucesso ? (
              <div className="p-6 text-center">
                <p className="text-4xl mb-2">✅</p>
                <p className="font-semibold text-green-800">Ocorrência registrada!</p>
                <p className="text-sm text-gray-500 mt-1">Será publicada no mapa após aprovação.</p>
                <button onClick={() => setModalAberto(false)} className="mt-4 text-green-700 underline text-sm">Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleEnviar} className="p-5 space-y-4">
                {erro && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                    <AlertCircle size={14} /> {erro}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                  <input type="text" value={cpf} onChange={(e) => handleCPF(e.target.value)}
                    placeholder="000.000.000-00" maxLength={14}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Selecione</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    rows={3} placeholder="Descreva o problema..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                  <strong>Localização:</strong> Informe o endereço aproximado na descrição. A marcação exata no mapa será implementada em breve.
                </div>
                <button type="submit" disabled={enviando}
                  className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm w-full justify-center">
                  <Send size={14} />
                  {enviando ? 'Enviando...' : 'Registrar Ocorrência'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
