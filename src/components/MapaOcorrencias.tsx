'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ocorrencia, CategoriaMapa } from '@/types'
import { validarCPF, formatarCPF } from '@/lib/cpf'

export default function MapaOcorrencias() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [modalAberto, setModalAberto] = useState(false)

  // Form
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [endereco, setEndereco] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(null)
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

  async function buscarEndereco() {
    if (!endereco.trim()) return
    setBuscando(true)
    setCoordenadas(null)
    setErro('')

    try {
      const query = encodeURIComponent(`${endereco}, Frutal, Minas Gerais, Brasil`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
      const data = await res.json()

      if (!data || data.length === 0) {
        setErro('Endereco nao encontrado. Tente ser mais especifico.')
        return
      }

      setCoordenadas({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name,
      })
    } catch {
      setErro('Erro ao buscar endereco. Tente novamente.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!nome.trim() || nome.trim().split(' ').length < 2) { setErro('Nome completo obrigatorio.'); return }
    if (!validarCPF(cpf)) { setErro('CPF invalido.'); return }
    if (!categoriaId) { setErro('Selecione a categoria.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva melhor o problema.'); return }
    if (!coordenadas) { setErro('Busque e confirme o endereco.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          morador_nome: nome.trim(),
          morador_cpf: cpf.replace(/\D/g, ''),
          descricao: descricao.trim(),
          lat: coordenadas.lat,
          lng: coordenadas.lng,
          categoria_id: categoriaId,
        }),
      })
      if (!res.ok) throw new Error()
      setSucesso(true)
      setNome(''); setCpf(''); setDescricao(''); setCategoriaId('')
      setEndereco(''); setCoordenadas(null)
    } catch {
      setErro('Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      {/* Legenda */}
      {categorias.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {categorias.map((cat) => (
            <span key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', borderRadius: '999px', background: 'white', border: '1px solid #e5e7eb', fontWeight: 500 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.cor, display: 'inline-block' }} />
              {cat.nome}
            </span>
          ))}
        </div>
      )}

      {/* Mapa embed */}
      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
        <iframe
          title="Mapa de Ocorrencias - Frutal MG"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-48.9883,-20.0764,-48.8883,-19.9764&layer=mapnik"
          style={{ width: '100%', height: '440px', display: 'block' }}
        />
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'white', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {ocorrencias.length} ocorrencia(s) publicada(s)
        </div>
      </div>

      {/* Botao registrar */}
      <button
        onClick={() => { setModalAberto(true); setSucesso(false) }}
        style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
      >
        Registrar Ocorrencia
      </button>

      {/* Modal */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontWeight: 700, color: '#111827', margin: 0 }}>Registrar Ocorrencia</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>×</button>
            </div>

            {sucesso ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#166534', fontSize: '16px' }}>Ocorrencia registrada!</p>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Sera publicada no mapa apos aprovacao.</p>
                <button onClick={() => setModalAberto(false)} style={{ marginTop: '16px', fontSize: '13px', color: '#1e3a5f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleEnviar} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {erro && (
                  <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>
                    {erro}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Nome Completo *</label>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>CPF *</label>
                  <input type="text" value={cpf} onChange={(e) => handleCPF(e.target.value)}
                    placeholder="000.000.000-00" maxLength={14}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', fontFamily: 'monospace', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Categoria *</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none' }}>
                    <option value="">Selecione</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Endereco *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarEndereco())}
                      placeholder="Ex: Rua XV de Novembro, 123"
                      style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                    <button type="button" onClick={buscarEndereco} disabled={buscando}
                      style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  {coordenadas && (
                    <div style={{ marginTop: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#166534' }}>
                      Localizado: {coordenadas.label.split(',').slice(0, 3).join(',')}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Descricao do Problema *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    rows={3} placeholder="Descreva o problema..."
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none' }} />
                </div>

                <button type="submit" disabled={enviando}
                  style={{ backgroundColor: enviando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Enviando...' : 'Registrar Ocorrencia'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
