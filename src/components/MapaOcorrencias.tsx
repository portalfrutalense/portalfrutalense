'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Ocorrencia, CategoriaMapa } from '@/types'
import { validarCPF, formatarCPF } from '@/lib/cpf'

const FRUTAL_LAT = -20.02752
const FRUTAL_LNG = -48.92702

export default function MapaOcorrencias() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaIniciado = useRef(false)
  const mapaObj = useRef<any>(null)
  const leafletObj = useRef<any>(null)
  const pinDraggavel = useRef<any>(null)
  const miniMapRef = useRef<HTMLDivElement>(null)
  const miniMapObj = useRef<any>(null)
  const miniMapIniciado = useRef(false)
  const miniPinRef = useRef<any>(null)

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [modalAberto, setModalAberto] = useState(false)
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
  const [locConfirmada, setLocConfirmada] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('ocorrencias').select('*, categoria:categorias_mapa(*)').eq('status', 'publicada').eq('oculto', false),
      supabase.from('categorias_mapa').select('*').eq('ativo', true).order('nome'),
    ]).then(([{ data: ocs }, { data: cats }]) => {
      setOcorrencias((ocs || []) as Ocorrencia[])
      setCategorias((cats || []) as CategoriaMapa[])
    })
  }, [])

  // Inicializa o mapa uma vez
  useEffect(() => {
    if (!mapRef.current || mapaIniciado.current) return
    mapaIniciado.current = true

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const zoomInicial = window.innerWidth <= 600 ? 13 : 14
      const mapa = L.map(mapRef.current!, { zoomControl: true }).setView([FRUTAL_LAT, FRUTAL_LNG], zoomInicial)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapa)
      mapaObj.current = mapa
      leafletObj.current = L
    })
  }, [])

  // Adiciona pins quando ocorrências carregarem
  useEffect(() => {
    if (!mapaObj.current || !leafletObj.current || ocorrencias.length === 0) return
    const L = leafletObj.current
    const mapa = mapaObj.current

    ocorrencias.forEach((o) => {
      const cor = o.categoria?.cor || '#3b82f6'
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${cor};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      L.marker([o.lat, o.lng], { icon })
        .addTo(mapa)
        .bindPopup(`<strong>${o.categoria?.nome || 'Ocorrência'}</strong><br/>${o.descricao}`)
    })
  }, [ocorrencias])


  // Mini-mapa estilo iFood: pin fixo no centro, mapa se move
  useEffect(() => {
    if (!coordenadas || !miniMapRef.current || !leafletObj.current || miniMapIniciado.current) return
    const L = leafletObj.current
    miniMapIniciado.current = true

    const mapa = L.map(miniMapRef.current, { zoomControl: true }).setView([coordenadas.lat, coordenadas.lng], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapa)
    miniMapObj.current = mapa
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordenadas !== null])

  // Resetar mini-mapa ao fechar modal ou ao limpar coordenadas
  useEffect(() => {
    if (!modalAberto || !coordenadas) {
      if (miniMapObj.current) { miniMapObj.current.remove(); miniMapObj.current = null }
      miniMapIniciado.current = false
      miniPinRef.current = null
      setLocConfirmada(false)
    }
  }, [modalAberto, coordenadas])

  function confirmarLocalizacao() {
    if (!miniMapObj.current) return
    const centro = miniMapObj.current.getCenter()
    setCoordenadas(prev => prev ? { ...prev, lat: centro.lat, lng: centro.lng } : null)
    setLocConfirmada(true)
  }

  function capitalizarNome(valor: string) {
    return valor.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) { setErro('Seu dispositivo não suporta geolocalização.'); return }
    setBuscando(true)
    setErro('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCoordenadas({ lat: latitude, lng: longitude, label: endereco.trim() || 'Localização do dispositivo' })
        setBuscando(false)
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Permissão negada. Vá em Configurações do Chrome → Configurações do site → Localização e permita este site.',
          2: 'GPS indisponível no momento. Tente em um local com melhor sinal ou use a busca por endereço.',
          3: 'Tempo esgotado. Tente novamente.',
        }
        setErro(msgs[err.code] || 'Não foi possível obter sua localização.')
        setBuscando(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
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
      if (!data || data.length === 0) { setErro('Endereço não encontrado. Tente ser mais específico.'); return }
      setCoordenadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: endereco.trim() })
    } catch {
      setErro('Erro ao buscar endereço.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim() || nome.trim().split(' ').length < 2) { setErro('Nome completo obrigatório.'); return }
    if (!validarCPF(cpf)) { setErro('CPF inválido.'); return }
    if (!categoriaId) { setErro('Selecione a categoria.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva melhor o problema.'); return }
    if (!coordenadas || !locConfirmada) { setErro('Busque o endereço e confirme a localização no mapa.'); return }
    setEnviando(true)
    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ morador_nome: nome.trim(), morador_cpf: cpf.replace(/\D/g, ''), descricao: descricao.trim(), lat: coordenadas.lat, lng: coordenadas.lng, categoria_id: categoriaId, endereco_label: coordenadas.label }),
      })
      if (!res.ok) throw new Error()
      setSucesso(true)
      setNome(''); setCpf(''); setDescricao(''); setCategoriaId(''); setEndereco(''); setCoordenadas(null); setLocConfirmada(false)
      if (pinDraggavel.current) { pinDraggavel.current.remove(); pinDraggavel.current = null }
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

      {/* Mapa */}
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
        <div ref={mapRef} style={{ width: '100%', height: 'clamp(300px, 55vw, 460px)' }} />
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'white', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', zIndex: 1000 }}>
          {ocorrencias.length} ocorrência(s) no mapa
        </div>
      </div>

      <button onClick={() => { setModalAberto(true); setSucesso(false) }}
        style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
        Registrar Ocorrência
      </button>

      {/* Modal */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Registrar Ocorrência</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9ca3af', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {sucesso ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#166534' }}>Ocorrência registrada!</p>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Será publicada no mapa após aprovação.</p>
                <button onClick={() => setModalAberto(false)} style={{ marginTop: '16px', fontSize: '13px', color: '#1e3a5f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleEnviar} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}

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

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Categoria *</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Selecione</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Endereço *</label>
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
                  <button type="button" onClick={usarMinhaLocalizacao} disabled={buscando}
                    style={{ marginTop: '8px', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', color: '#374151', cursor: 'pointer', width: '100%' }}>
                    {buscando ? 'Obtendo localização...' : 'Usar minha localização atual'}
                  </button>
                  {coordenadas && !locConfirmada && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '6px 10px', margin: '0 0 6px' }}>
                        Mova o mapa até o local exato e toque em <strong>Confirmar localização</strong>.
                      </p>
                      {/* Container do mapa com pin fixo no centro */}
                      <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '6px', border: '1px solid #d1d5db', overflow: 'hidden' }}>
                        <div ref={miniMapRef} style={{ width: '100%', height: '100%' }} />
                        {/* Pin fixo no centro */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none' }}>
                          <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.4 23.04 15.04 23.573a1.333 1.333 0 001.92 0C17.6 39.04 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#f97316"/>
                            <circle cx="16" cy="16" r="7" fill="white"/>
                          </svg>
                        </div>
                        {/* Botão confirmar dentro do mapa */}
                        <button type="button" onClick={confirmarLocalizacao}
                          style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                          Confirmar localização
                        </button>
                      </div>
                    </div>
                  )}
                  {coordenadas && locConfirmada && (
                    <div style={{ marginTop: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Localização confirmada: <strong>{coordenadas.label}</strong></span>
                      <button type="button" onClick={() => { setCoordenadas(null); setLocConfirmada(false) }}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0, marginLeft: '8px' }}>
                        Alterar
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descreva o problema..."
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <button type="submit" disabled={enviando}
                  style={{ backgroundColor: enviando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
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
