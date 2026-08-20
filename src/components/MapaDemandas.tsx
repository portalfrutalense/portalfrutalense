'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'
import { Demanda, CategoriaMapa, Entidade } from '@/types'

const FRUTAL_LAT = -20.02752
const FRUTAL_LNG = -48.92702

async function comprimirFoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 600
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', 0.25)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
}

export default function MapaDemandas() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const [modalAuth, setModalAuth] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapaIniciado = useRef(false)
  const mapaObj = useRef<any>(null)
  const leafletObj = useRef<any>(null)
  const tileAtual = useRef<any>(null)
  const miniMapRef = useRef<HTMLDivElement>(null)
  const miniMapObj = useRef<any>(null)
  const miniMapIniciado = useRef(false)

  const [mapaCarregado, setMapaCarregado] = useState(false)
  const [satelite, setSatelite] = useState(false)
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [demandaSelecionada, setDemandaSelecionada] = useState<Demanda | null>(null)

  // Form state
  const [etapa, setEtapa] = useState<'fechado' | 'formulario'>('fechado')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [entidadeId, setEntidadeId] = useState('')
  const [endereco, setEndereco] = useState('')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [locConfirmada, setLocConfirmada] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('demandas').select('*, categoria:categorias_mapa(*), entidade:entidades(*)').in('status', ['aguardando_resposta', 'respondida', 'resolvida']).eq('oculto', false),
      supabase.from('categorias_mapa').select('*').eq('ativo', true).order('nome'),
      supabase.from('entidades').select('*').eq('ativo', true).order('nome'),
    ]).then(([{ data: d }, { data: c }, { data: e }]) => {
      setDemandas((d || []) as Demanda[])
      setCategorias((c || []) as CategoriaMapa[])
      setEntidades((e || []) as Entidade[])
    })
  }, [])

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
      const zoom = window.innerWidth <= 600 ? 13 : 14
      const mapa = L.map(mapRef.current!, { zoomControl: true }).setView([FRUTAL_LAT, FRUTAL_LNG], zoom)
      const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
      tile.addTo(mapa)
      tileAtual.current = tile
      mapaObj.current = mapa
      leafletObj.current = L
      setMapaCarregado(true)
    })
  }, [])

  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !leafletObj.current || demandas.length === 0) return
    const L = leafletObj.current
    const mapa = mapaObj.current

    demandas.forEach((d) => {
      const cor = d.categoria?.cor || '#3b82f6'
      const icon = d.foto_url
        ? L.divIcon({
            className: '',
            html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))">
              <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;overflow:hidden;">
                <img src="${d.foto_url}" style="width:100%;height:100%;object-fit:cover;display:block;" />
              </div>
              <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
            </div>`,
            iconSize: [32, 41], iconAnchor: [16, 41],
          })
        : L.divIcon({
            className: '',
            html: `<div style="width:22px;height:22px;border-radius:50%;background:${cor};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          })

      const marker = L.marker([d.lat, d.lng], { icon }).addTo(mapa)
      marker.on('click', () => {
        if (!user) { setModalAuth(true); return }
        setDemandaSelecionada(d)
      })
    })
  }, [demandas, user, mapaCarregado])

  // Mini-mapa no formulário
  useEffect(() => {
    if (!coordenadas || !miniMapRef.current || !leafletObj.current || miniMapIniciado.current) return
    const L = leafletObj.current
    miniMapIniciado.current = true
    const mapa = L.map(miniMapRef.current, { zoomControl: true }).setView([coordenadas.lat, coordenadas.lng], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapa)
    miniMapObj.current = mapa
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordenadas !== null])

  useEffect(() => {
    if (etapa !== 'formulario' || !coordenadas) {
      if (miniMapObj.current) { miniMapObj.current.remove(); miniMapObj.current = null }
      miniMapIniciado.current = false
      setLocConfirmada(false)
    }
  }, [etapa, coordenadas])

  function alternarCamada() {
    if (!mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    if (tileAtual.current) tileAtual.current.remove()
    const novoSatelite = !satelite
    const tile = novoSatelite
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
    tile.addTo(mapaObj.current)
    tileAtual.current = tile
    setSatelite(novoSatelite)
  }

  async function buscarEndereco() {
    if (!endereco.trim()) return
    setBuscando(true); setCoordenadas(null); setErro('')
    try {
      const q = encodeURIComponent(`${endereco}, Frutal, Minas Gerais, Brasil`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
      const data = await res.json()
      if (!data?.length) { setErro('Endereço não encontrado.'); return }
      setCoordenadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: endereco.trim() })
    } catch { setErro('Erro ao buscar endereço.') }
    finally { setBuscando(false) }
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) { setErro('Geolocalização não suportada.'); return }
    setBuscando(true); setErro('')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoordenadas({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: endereco.trim() || 'Minha localização' }); setBuscando(false) },
      () => { setErro('Não foi possível obter sua localização.'); setBuscando(false) },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  function confirmarLocalizacao() {
    if (!miniMapObj.current) return
    const c = miniMapObj.current.getCenter()
    setCoordenadas(prev => prev ? { ...prev, lat: c.lat, lng: c.lng } : null)
    setLocConfirmada(true)
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (!user || !perfil) return
    if (!categoriaId) { setErro('Selecione a categoria.'); return }
    if (!entidadeId) { setErro('Selecione a autoridade responsável.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva melhor o problema.'); return }
    if (!coordenadas || !locConfirmada) { setErro('Confirme a localização no mapa.'); return }
    setEnviando(true)

    let foto_url: string | null = null
    if (fotoFile) {
      try {
        const blob = await comprimirFoto(fotoFile)
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadError } = await supabase.storage.from('ocorrencias-fotos').upload(path, blob, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        foto_url = supabase.storage.from('ocorrencias-fotos').getPublicUrl(path).data.publicUrl
      } catch { setErro('Erro ao enviar foto.'); setEnviando(false); return }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/demandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ descricao: descricao.trim(), lat: coordenadas.lat, lng: coordenadas.lng, categoria_id: categoriaId, entidade_id: entidadeId, foto_url, endereco_label: coordenadas.label }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSucesso(true)
      setDescricao(''); setCategoriaId(''); setEntidadeId(''); setEndereco('')
      setCoordenadas(null); setLocConfirmada(false); setFotoFile(null); setFotoPreview(null)
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar.')
    } finally { setEnviando(false) }
  }

  function fecharFormulario() {
    setEtapa('fechado'); setSucesso(false); setErro('')
    setDescricao(''); setCategoriaId(''); setEntidadeId(''); setEndereco('')
    setCoordenadas(null); setLocConfirmada(false); setFotoFile(null); setFotoPreview(null)
  }

  const statusLabel: Record<string, { label: string; cor: string }> = {
    aguardando_resposta: { label: 'Aguardando resposta', cor: '#f59e0b' },
    respondida: { label: 'Respondida', cor: '#10b981' },
    resolvida: { label: 'Resolvida', cor: '#6b7280' },
  }

  return (
    <div>
      {/* Legenda */}
      {categorias.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {categorias.map((c) => (
            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', borderRadius: '999px', background: 'white', border: '1px solid #e5e7eb', fontWeight: 500 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.cor, display: 'inline-block' }} />
              {c.nome}
            </span>
          ))}
        </div>
      )}

      {/* Mapa */}
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
        <div ref={mapRef} style={{ width: '100%', height: 'clamp(300px, 55vw, 460px)' }} />
        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', zIndex: 1000 }}>
          <button onClick={alternarCamada} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#1e3a5f', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {satelite ? '🗺️ Mapa de ruas' : '🛰️ Satélite'}
          </button>
          <div style={{ background: 'white', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {demandas.length} demanda(s)
          </div>
        </div>
        {!user && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(15,36,64,0.92), transparent)', padding: '40px 24px 20px', zIndex: 1000, textAlign: 'center' }}>
            <p style={{ color: 'white', fontWeight: 600, fontSize: '14px', margin: '0 0 10px' }}>Faça login para ver as demandas completas</p>
            <button onClick={() => setModalAuth(true)} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              Entrar com Google
            </button>
          </div>
        )}
      </div>

      {/* Botão registrar */}
      {user ? (
        <button onClick={() => setEtapa('formulario')} style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
          + Registrar Demanda
        </button>
      ) : (
        <button onClick={() => setModalAuth(true)} style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
          Entrar para registrar uma demanda
        </button>
      )}

      {/* Card da demanda selecionada */}
      {demandaSelecionada && (
        <div style={{ marginTop: '24px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: demandaSelecionada.categoria?.cor || '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: demandaSelecionada.categoria?.cor || '#3b82f6', textTransform: 'uppercase', letterSpacing: '.04em' }}>{demandaSelecionada.categoria?.nome}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: statusLabel[demandaSelecionada.status]?.cor || '#6b7280', background: '#f3f4f6', borderRadius: '4px', padding: '2px 8px' }}>
                {statusLabel[demandaSelecionada.status]?.label || demandaSelecionada.status}
              </span>
            </div>
            <button onClick={() => setDemandaSelecionada(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', padding: 0 }}>×</button>
          </div>

          <div style={{ padding: '20px' }}>
            {demandaSelecionada.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={demandaSelecionada.foto_url} alt="Foto da demanda" style={{ width: '100%', borderRadius: '8px', marginBottom: '16px', display: 'block' }} />
            )}
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 8px', lineHeight: 1.5 }}>{demandaSelecionada.descricao}</p>
            {demandaSelecionada.endereco_label && (
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px' }}>📍 {demandaSelecionada.endereco_label}</p>
            )}
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>
              Por <strong style={{ color: '#374151' }}>{demandaSelecionada.morador_nome}</strong> · {new Date(demandaSelecionada.created_at).toLocaleDateString('pt-BR')}
            </p>

            {/* Autoridade cobrada */}
            <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>Autoridade cobrada</p>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{demandaSelecionada.entidade?.nome}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{demandaSelecionada.entidade?.cargo}</p>
            </div>

            {/* Resposta */}
            {demandaSelecionada.resposta && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>✓ Resposta oficial</p>
                <p style={{ fontSize: '14px', color: '#166534', margin: 0, lineHeight: 1.6 }}>{demandaSelecionada.resposta}</p>
                {demandaSelecionada.respondido_em && (
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '8px 0 0' }}>{new Date(demandaSelecionada.respondido_em).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
            )}

            {/* Ações do próprio usuário */}
            {user && demandaSelecionada.user_id === user.id && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                <button
                  onClick={async () => {
                    if (!confirm('Marcar esta demanda como resolvida?')) return
                    await supabase.from('demandas').update({ status: 'resolvida' }).eq('id', demandaSelecionada.id)
                    setDemandas(prev => prev.filter(d => d.id !== demandaSelecionada.id))
                    setDemandaSelecionada(null)
                  }}
                  style={{ fontSize: '13px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontWeight: 500 }}>
                  ✓ Marcar como resolvida
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Excluir esta demanda? Esta ação não pode ser desfeita.')) return
                    await supabase.from('demandas').delete().eq('id', demandaSelecionada.id)
                    setDemandas(prev => prev.filter(d => d.id !== demandaSelecionada.id))
                    setDemandaSelecionada(null)
                  }}
                  style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontWeight: 500 }}>
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de auth */}
      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}

      {/* Formulário de demanda */}
      {etapa === 'formulario' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Registrar Demanda</h2>
              <button onClick={fecharFormulario} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9ca3af', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {sucesso ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Demanda registrada!</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Sua demanda está sendo analisada. Se aprovada, aparecerá no mapa e a autoridade será notificada por e-mail.
                </p>
                <button onClick={fecharFormulario} style={{ fontSize: '13px', color: '#1e3a5f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleEnviar} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}

                {/* Nome travado */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Cidadão</label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', background: '#f0fdf4' }}>
                    <span style={{ fontSize: '14px', color: '#166534', fontWeight: 500 }}>{perfil?.nome}</span>
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', borderRadius: '4px', padding: '2px 7px', fontWeight: 600 }}>✓ Google</span>
                  </div>
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Autoridade responsável *</label>
                  <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Selecione a autoridade</option>
                    {entidades.map((en) => <option key={en.id} value={en.id}>{en.nome} — {en.cargo}</option>)}
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
                      {buscando ? '...' : 'Buscar'}
                    </button>
                  </div>
                  <button type="button" onClick={usarMinhaLocalizacao} disabled={buscando}
                    style={{ marginTop: '8px', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', color: '#374151', cursor: 'pointer', width: '100%' }}>
                    {buscando ? 'Obtendo...' : '📍 Usar minha localização'}
                  </button>
                  {coordenadas && !locConfirmada && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '6px 10px', margin: '0 0 6px' }}>
                        Mova o mapa até o local exato e toque em <strong>Confirmar localização</strong>.
                      </p>
                      <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '6px', border: '1px solid #d1d5db', overflow: 'hidden' }}>
                        <div ref={miniMapRef} style={{ width: '100%', height: '100%' }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none' }}>
                          <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
                            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.4 23.04 15.04 23.573a1.333 1.333 0 001.92 0C17.6 39.04 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#f97316"/>
                            <circle cx="16" cy="16" r="7" fill="white"/>
                          </svg>
                        </div>
                        <button type="button" onClick={confirmarLocalizacao}
                          style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                          Confirmar localização
                        </button>
                      </div>
                    </div>
                  )}
                  {coordenadas && locConfirmada && (
                    <div style={{ marginTop: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>✓ <strong>{coordenadas.label}</strong></span>
                      <button type="button" onClick={() => { setCoordenadas(null); setLocConfirmada(false) }}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0, marginLeft: '8px' }}>
                        Alterar
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descreva o problema em detalhes..."
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Foto */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>
                    Foto <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  {!fotoPreview ? (
                    <label style={{ display: 'block', border: '2px dashed #d1d5db', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} style={{ display: 'none' }} />
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>📷</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}><strong style={{ color: '#2563eb' }}>Toque para tirar foto</strong> ou escolher da galeria</div>
                    </label>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fotoPreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={enviando}
                  style={{ backgroundColor: enviando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Enviando...' : 'Registrar Demanda'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
