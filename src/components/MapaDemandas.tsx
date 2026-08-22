'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'
import Turnstile from './Turnstile'
import MiniMapaConfirmar from './MiniMapaConfirmar'
import { Demanda, CategoriaMapa, Entidade } from '@/types'

const FRUTAL_LAT = -20.02752
const FRUTAL_LNG = -48.92702

function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

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
  const markersRef = useRef<any[]>([])
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [voo, setVoo] = useState<{ fromX: number; fromY: number; fromW: number; fromH: number; toX: number; toY: number; toW: number; toH: number; animando: boolean } | null>(null)
  const [mapaCarregado, setMapaCarregado] = useState(false)
  const [satelite, setSatelite] = useState(true)
  const sateliteRef = useRef(true)
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({})
  const [demandaSelecionada, setDemandaSelecionada] = useState<Demanda | null>(null)

  // Bottom sheet (mobile)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  const [sheetState, setSheetState] = useState<'peek' | 'half' | 'full'>('peek')
  const [dicaArrasteVisivel, setDicaArrasteVisivel] = useState(true)
  const arrasteRef = useRef<{ startY: number; startFrac: number } | null>(null)
  const SNAP: Record<'peek' | 'half' | 'full', number> = { peek: 0.17, half: 0.45, full: 0.75 }

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  // Form state
  const [etapa, setEtapa] = useState<'fechado' | 'formulario'>('fechado')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [entidadeId, setEntidadeId] = useState('')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [locConfirmada, setLocConfirmada] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('demandas').select('*, categoria:categorias_mapa(*), entidade:entidades(*)').in('status', ['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida']).eq('oculto', false),
      supabase.from('categorias_mapa').select('*').eq('ativo', true).order('nome'),
      supabase.from('entidades').select('*').eq('ativo', true).order('nome'),
      supabase.from('categoria_entidades').select('categoria_id, entidade_id'),
    ]).then(([{ data: d }, { data: c }, { data: e }, { data: ce }]) => {
      setDemandas((d || []) as Demanda[])
      setCategorias((c || []) as CategoriaMapa[])
      setEntidades((e || []) as Entidade[])
      const mapa: Record<string, string[]> = {}
      for (const row of (ce || [])) {
        if (!mapa[row.categoria_id]) mapa[row.categoria_id] = []
        mapa[row.categoria_id].push(row.entidade_id)
      }
      setCatEntidades(mapa)
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
        shadowUrl: '',
      })
      const zoom = window.innerWidth <= 600 ? 13 : 14
      const mapa = L.map(mapRef.current!, { zoomControl: false }).setView([FRUTAL_LAT, FRUTAL_LNG], zoom)
      const tile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' })
      tile.addTo(mapa)
      tileAtual.current = tile
      mapaObj.current = mapa
      leafletObj.current = L
      setMapaCarregado(true)

      // blur no tile pane em zoom alto, some em zoom baixo
      function atualizarBlur() {
        const z = mapa.getZoom()
        const tilePane = mapa.getPanes().tilePane as HTMLElement | null
        if (!tilePane) return
        const zoomBlur = window.innerWidth <= 600 ? 13 : 14
        const gs = sateliteRef.current ? 50 : 20
        tilePane.style.filter = z === zoomBlur ? `grayscale(${gs}%) blur(0.6px)` : `grayscale(${gs}%)`
      }
      mapa.on('zoomend', atualizarBlur)
      mapa.whenReady(() => requestAnimationFrame(atualizarBlur))
      mapa.once('tilesloaded', atualizarBlur)

      // Corrige o mapa esticando quando o tamanho do container muda (zoom do navegador, resize de janela)
      const resizeObserver = new ResizeObserver(() => {
        mapa.invalidateSize()
      })
      resizeObserver.observe(mapRef.current!)
      resizeObserverRef.current = resizeObserver
    })

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [])

  // Renderiza markers conforme filtros
  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    const mapa = mapaObj.current

    // Limpa markers anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const filtradas = demandas.filter(d => {
      if (filtroStatus && d.status !== filtroStatus) return false
      if (filtroCategoria && d.categoria_id !== filtroCategoria) return false

      return true
    })

    function criarIcone(d: typeof filtradas[0], zoom: number) {
      const cor = d.categoria?.cor || '#4256c8'
      const iconeUrl = d.categoria?.icone_url

      // Miolo do pin — o que muda entre os 3 casos
      let miolo: string
      if (d.foto_url) {
        miolo = `<img src="${d.foto_url}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;object-fit:cover;" />`
      } else if (iconeUrl) {
        miolo = `<img src="${iconeUrl}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:125%;height:125%;object-fit:contain;filter:brightness(1.3);" />`
      } else {
        miolo = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:23px;height:23px;border-radius:50%;background:${cor};"></div>`
      }

      const fundoExtra = d.foto_url ? `background:transparent;` : `background:white;`

      return L.divIcon({
        className: 'pin-demanda',
        html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))">
          <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;overflow:hidden;position:relative;${fundoExtra}">
            ${miolo}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
        </div>`,
        iconSize: [32, 41], iconAnchor: [16, 41],
      })
    }

    function escapeHtml(s?: string) {
      if (!s) return ''
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    const demandaPorId = new Map(filtradas.map(d => [d.id, d]))

    filtradas.forEach((d) => {
      const marker = L.marker([d.lat, d.lng], { icon: criarIcone(d, mapa.getZoom()) }).addTo(mapa)

      const popupHtml = `
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          ${d.foto_url ? `<img src="${d.foto_url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />` : ''}
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#4256c8;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(d.categoria?.nome) || 'Sem categoria'}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${escapeHtml(d.endereco_label)}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#111827;line-height:1.4;">${escapeHtml(sentenceCase(d.descricao))}</p>
          <button class="ver-mais-btn" data-ver-mais="${d.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver demanda
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `

      marker.bindPopup(popupHtml, { maxWidth: 260, closeButton: true })
      marker.on('click', () => {
        if (!user) { setModalAuth(true); return }
        marker.openPopup()
      })
      markersRef.current.push(marker)
    })

    // Delegação: clique no botão "Ver mais" de qualquer popup abre o card completo no sidebar
    const container = mapa.getContainer()
    function aoClicarNoContainer(e: MouseEvent) {
      const alvo = (e.target as HTMLElement).closest('.ver-mais-btn') as HTMLElement | null
      if (!alvo) return
      const id = alvo.getAttribute('data-ver-mais')
      const demanda = id ? demandaPorId.get(id) : null
      if (!demanda) return

      // Voo: o popup "voa" da posição atual até o sidebar, onde o card completo assenta
      const popupEl = alvo.closest('.leaflet-popup-content-wrapper') as HTMLElement | null
      const fromRect = (popupEl || alvo).getBoundingClientRect()
      const toRect = sidebarRef.current?.getBoundingClientRect()

      if (!toRect) {
        setDemandaSelecionada(demanda)
        setSheetState('full')
        mapa.closePopup()
        return
      }

      setVoo({
        fromX: fromRect.left, fromY: fromRect.top, fromW: fromRect.width, fromH: fromRect.height,
        toX: toRect.left, toY: toRect.top, toW: toRect.width, toH: toRect.height,
        animando: false,
      })
      mapa.closePopup()

      requestAnimationFrame(() => requestAnimationFrame(() => {
        setVoo(prev => prev ? { ...prev, animando: true } : null)
      }))

      setTimeout(() => {
        setDemandaSelecionada(demanda)
        setSheetState('full')
        setVoo(null)
      }, 380)
    }
    container.addEventListener('click', aoClicarNoContainer)

    return () => {
      container.removeEventListener('click', aoClicarNoContainer)
    }
  }, [demandas, user, mapaCarregado, filtroStatus, filtroCategoria])

  useEffect(() => {
    if (etapa !== 'formulario' || !coordenadas) {
      setLocConfirmada(false)
    }
  }, [etapa, coordenadas])

  // Detecta mobile (mesmo breakpoint do resto do layout)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const aoMudar = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  // Texto "Arraste para ver mais" some sozinho depois de 5s
  useEffect(() => {
    const t = setTimeout(() => setDicaArrasteVisivel(false), 5000)
    return () => clearTimeout(t)
  }, [])

  function cicloSheet() {
    setSheetState(prev => {
      if (prev === 'peek') return 'half'
      if (prev === 'half') return demandaSelecionada ? 'full' : 'peek'
      return 'peek'
    })
  }

  function aoIniciarArraste(e: React.TouchEvent) {
    arrasteRef.current = { startY: e.touches[0].clientY, startFrac: SNAP[sheetState] }
    if (sidebarRef.current) sidebarRef.current.style.transition = 'none'
    setDicaArrasteVisivel(false)
  }

  function aoArrastar(e: React.TouchEvent) {
    if (!arrasteRef.current || !sidebarRef.current) return
    const deltaY = arrasteRef.current.startY - e.touches[0].clientY
    const novaFrac = Math.min(0.94, Math.max(0.12, arrasteRef.current.startFrac + deltaY / window.innerHeight))
    sidebarRef.current.style.height = `${novaFrac * 100}vh`
  }

  function aoSoltarArraste() {
    if (!arrasteRef.current || !sidebarRef.current) return
    const alturaAtual = sidebarRef.current.getBoundingClientRect().height / window.innerHeight
    arrasteRef.current = null
    let melhor: 'peek' | 'half' | 'full' = 'peek'
    let menorDist = Infinity
    const candidatos = demandaSelecionada ? (['peek', 'half', 'full'] as const) : (['peek', 'half'] as const)
    candidatos.forEach((s) => {
      const d = Math.abs(SNAP[s] - alturaAtual)
      if (d < menorDist) { menorDist = d; melhor = s }
    })
    // Reaplica a altura oficial do snap na hora, sem depender do React re-renderizar
    // (se o estado escolhido for igual ao atual, o React pula o render e a altura
    // "fantasma" do arraste ficaria grudada no elemento)
    sidebarRef.current.style.transition = 'height 0.25s ease'
    sidebarRef.current.style.height = `${SNAP[melhor] * 100}vh`
    setSheetState(melhor)
  }

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
    sateliteRef.current = novoSatelite
    setSatelite(novoSatelite)
    // Atualiza grayscale imediatamente ao trocar camada
    const tilePane = mapaObj.current.getPanes().tilePane as HTMLElement | null
    if (tilePane) {
      const z = mapaObj.current.getZoom()
      const zoomBlur = window.innerWidth <= 600 ? 13 : 14
      const gs = novoSatelite ? 50 : 20
      tilePane.style.filter = z === zoomBlur ? `grayscale(${gs}%) blur(0.6px)` : `grayscale(${gs}%)`
    }
  }

  function aoConfirmarEndereco(endereco: string, lat: number, lng: number) {
    setCoordenadas({ lat, lng, label: endereco })
    setLocConfirmada(true)
  }

  function aoAlterarEndereco() {
    setCoordenadas(null)
    setLocConfirmada(false)
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
    if (!turnstileToken) { setErro('Aguarde a verificação de segurança concluir.'); return }
    setEnviando(true)

    let foto_url: string | null = null
    if (fotoFile) {
      try {
        const blob = await comprimirFoto(fotoFile)
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadError } = await supabase.storage.from('demandas-fotos').upload(path, blob, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        foto_url = supabase.storage.from('demandas-fotos').getPublicUrl(path).data.publicUrl
      } catch (err: any) { setErro(`Erro ao enviar foto: ${err?.message || JSON.stringify(err)}`); setEnviando(false); return }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/demandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ descricao: descricao.trim(), lat: coordenadas.lat, lng: coordenadas.lng, categoria_id: categoriaId, entidade_id: entidadeId, foto_url, endereco_label: coordenadas.label, turnstile_token: turnstileToken }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSucesso(true)
      setDescricao(''); setCategoriaId(''); setEntidadeId('')
      setCoordenadas(null); setLocConfirmada(false); setFotoFile(null); setFotoPreview(null); setTurnstileToken('')
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar.')
    } finally { setEnviando(false) }
  }

  function fecharFormulario() {
    setEtapa('fechado'); setSucesso(false); setErro('')
    setDescricao(''); setCategoriaId(''); setEntidadeId('')
    setCoordenadas(null); setLocConfirmada(false); setFotoFile(null); setFotoPreview(null); setTurnstileToken('')
  }

  const statusOpcoes: { value: string; label: string }[] = [
    { value: '', label: 'Todos os status' },
    { value: 'aguardando_resposta', label: 'Aguardando resposta' },
    { value: 'respondida', label: 'Respondida' },
    { value: 'nao_resolvida', label: 'Não resolvida' },
    { value: 'resolvida', label: 'Resolvida' },
  ]

  const statusLabel: Record<string, string> = {
    aguardando_resposta: 'Aguardando resposta',
    respondida: 'Respondida',
    nao_resolvida: 'Não resolvida',
    resolvida: 'Resolvida',
  }

  const statusCor: Record<string, { bg: string; color: string }> = {
    aguardando_resposta: { bg: '#f9fafb', color: '#4256c8' },
    respondida:          { bg: '#f9fafb', color: '#166534' },
    nao_resolvida:       { bg: '#f9fafb', color: '#92400e' },
    resolvida:           { bg: '#f9fafb', color: '#6b7280' },
  }

  const demandasVisiveis = demandas.filter(d => {
    if (filtroStatus && d.status !== filtroStatus) return false
    if (filtroCategoria && d.categoria_id !== filtroCategoria) return false
    return true
  })

  const layoutEstilo: React.CSSProperties = isMobile
    ? { position: 'relative', height: '100%', overflow: 'hidden' }
    : { display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', flex: 1 }

  const sidebarEstilo: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500, background: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', boxShadow: '0 -2px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', height: `${SNAP[sheetState] * 100}vh`, transition: 'height 0.25s ease', overflow: 'hidden' }
    : { width: '260px', flexShrink: 0, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 'clamp(300px, 55vw, 500px)', overflow: 'hidden' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Layout principal: sidebar + mapa */}
      <div className="mapa-layout" style={layoutEstilo}>

        {/* SIDEBAR */}
        <div ref={sidebarRef} className="mapa-sidebar" style={sidebarEstilo}>
          {isMobile && (
            <div
              onClick={cicloSheet}
              onTouchStart={aoIniciarArraste}
              onTouchMove={aoArrastar}
              onTouchEnd={aoSoltarArraste}
              style={{ flexShrink: 0, padding: '8px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'grab', touchAction: 'none' }}
            >
              <div style={{ width: '40px', height: '5px', borderRadius: '3px', background: '#d1d5db' }} />
              <svg className="sheet-chevron" width="16" height="9" viewBox="0 0 16 9" fill="none" style={{ color: '#9ca3af' }}>
                <path d="M1 1l7 6.5L15 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{
                fontSize: '11px', color: '#9ca3af', fontWeight: 500,
                opacity: dicaArrasteVisivel ? 1 : 0,
                maxHeight: dicaArrasteVisivel ? '16px' : '0px',
                transition: 'opacity 0.5s ease, max-height 0.5s ease',
                overflow: 'hidden',
              }}>
                Arraste para ver mais
              </span>
            </div>
          )}
          <div
            style={{ flex: 1, overflowY: isMobile ? 'hidden' : 'auto', minHeight: 0, touchAction: isMobile ? 'none' : undefined }}
            onTouchStart={isMobile ? aoIniciarArraste : undefined}
            onTouchMove={isMobile ? aoArrastar : undefined}
            onTouchEnd={isMobile ? aoSoltarArraste : undefined}
          >

          {demandaSelecionada ? (
            /* ── DETALHE DA DEMANDA ── */
            <div key={demandaSelecionada.id} className="demanda-detalhe-anim" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Voltar */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #f9fafb', flexShrink: 0 }}>
                <button
                  onClick={() => { setDemandaSelecionada(null); setSheetState('peek') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ← Voltar
                </button>
              </div>

              {/* Conteúdo */}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* Badge de status */}
                <div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
                    background: statusCor[demandaSelecionada.status]?.bg || '#f9fafb',
                    color: statusCor[demandaSelecionada.status]?.color || '#6b7280',
                  }}>
                    {statusLabel[demandaSelecionada.status] || demandaSelecionada.status}
                  </span>
                </div>

                {/* Caixa principal — pares label/valor empilhados */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Demanda</p>
                    <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>{sentenceCase(demandaSelecionada.descricao)}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Categoria</p>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>{demandaSelecionada.categoria?.nome || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Nome</p>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>{titleCase(demandaSelecionada.morador_nome)}</p>
                    </div>
                  </div>

                  {demandaSelecionada.endereco_label && (
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Endereço</p>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>{titleCase(demandaSelecionada.endereco_label)}</p>
                    </div>
                  )}

                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Direcionada para</p>
                    <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>
                      {titleCase(demandaSelecionada.entidade?.nome)}
                      {demandaSelecionada.entidade?.cargo && <span style={{ color: '#6b7280' }}> ({titleCase(demandaSelecionada.entidade.cargo)})</span>}
                    </p>
                  </div>

                  {demandaSelecionada.foto_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={demandaSelecionada.foto_url}
                      alt="Foto da demanda"
                      onClick={() => window.open(demandaSelecionada.foto_url!, '_blank')}
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                    />
                  )}

                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                    Criada em {new Date(demandaSelecionada.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Resposta */}
                {demandaSelecionada.resposta && (
                  <div style={{ fontSize: '12px', color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', lineHeight: 1.5 }}>
                    <strong>Resposta:</strong> {demandaSelecionada.resposta}
                  </div>
                )}

                {/* Ações do próprio usuário */}
                {user && demandaSelecionada.user_id === user.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['aguardando_resposta', 'respondida', 'nao_resolvida'].includes(demandaSelecionada.status) && (
                      <button
                        onClick={async () => {
                          if (!confirm('Marcar esta demanda como resolvida?')) return
                          await supabase.from('demandas').update({ status: 'resolvida' }).eq('id', demandaSelecionada.id)
                          setDemandas(prev => prev.map(d => d.id === demandaSelecionada.id ? { ...d, status: 'resolvida' } : d))
                          setDemandaSelecionada(prev => prev ? { ...prev, status: 'resolvida' } : null)
                        }}
                        style={{ fontSize: '12px', color: '#166534', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px', cursor: 'pointer', fontWeight: 500 }}>
                        Marcar como resolvida
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm('Excluir esta demanda? Esta ação não pode ser desfeita.')) return
                        await supabase.from('demandas').delete().eq('id', demandaSelecionada.id)
                        setDemandas(prev => prev.filter(d => d.id !== demandaSelecionada.id))
                        setDemandaSelecionada(null)
                      }}
                      style={{ fontSize: '12px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px', cursor: 'pointer', fontWeight: 500 }}>
                      Excluir
                    </button>
                  </div>
                )}

              </div>
            </div>
          ) : (
            /* ── FILTROS ── */
            <>
              {/* Topo: título + descrição + filtros */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 12px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Mapa de Demandas</h2>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Demandas dos cidadãos de Frutal-MG direcionadas às autoridades públicas.
                </p>

                {/* Botão registrar */}
                {user ? (
                  <button
                    onClick={() => setEtapa('formulario')}
                    style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
                    Registrar Demanda
                  </button>
                ) : (
                  <button
                    onClick={() => setModalAuth(true)}
                    style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
                    Entrar para registrar
                  </button>
                )}

                {/* Filtro de status */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box' }}>
                    {statusOpcoes.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro de categoria */}
                {categorias.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Categoria</label>
                    <select
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                      style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box' }}>
                      <option value="">Todas as categorias</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Contador + Zoom */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid #f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{demandasVisiveis.length} demanda{demandasVisiveis.length !== 1 ? 's' : ''}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => mapaObj.current?.zoomIn()}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    +
                  </button>
                  <button
                    onClick={() => mapaObj.current?.zoomOut()}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    −
                  </button>
                </div>
              </div>

            </>
          )}
          </div>{/* fecha área rolável do sheet */}
        </div>

        {/* MAPA */}
        <div style={isMobile ? { position: 'absolute', inset: 0 } : { flex: 1, position: 'relative', minWidth: 0 }}>
          <div ref={mapRef} className="mapa-map-div" style={{ width: '100%', height: '100%', minHeight: 'clamp(300px, 55vw, 500px)' }} />

          {/* Controles sobrepostos */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', zIndex: 1000 }}>
            <button onClick={alternarCamada} style={{
              position: 'relative', display: 'flex', width: '150px', height: '28px',
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '3px',
              cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}>
              <div style={{
                position: 'absolute', top: '3px', left: satelite ? '75px' : '3px', width: '72px', height: '22px',
                background: '#4256c8', borderRadius: '16px', transition: 'left 0.2s ease',
              }} />
              <span style={{ position: 'relative', zIndex: 1, flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 600, lineHeight: '22px', color: satelite ? '#6b7280' : 'white' }}>
                Padrão
              </span>
              <span style={{ position: 'relative', zIndex: 1, flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 600, lineHeight: '22px', color: satelite ? 'white' : '#6b7280' }}>
                Satélite
              </span>
            </button>
          </div>

          {/* Banner de login */}
          {!user && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(15,36,64,0.92), transparent)', padding: '40px 24px 20px', zIndex: 1000, textAlign: 'center' }}>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '14px', margin: '0 0 10px' }}>Faça login para ver as demandas completas</p>
              <button onClick={() => setModalAuth(true)} style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                Entrar com Google
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de auth */}
      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}

      {/* Formulário de demanda */}
      {etapa === 'formulario' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Registrar uma nova demanda</h2>
              <button onClick={fecharFormulario} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {sucesso ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Demanda registrada!</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Sua demanda está sendo analisada. Se aprovada, aparecerá no mapa e a autoridade será notificada por e-mail.
                </p>
                <button onClick={fecharFormulario} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
              </div>
            ) : (
              <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
              <form id="form-registrar-demanda" onSubmit={handleEnviar} className="registro-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                {erro && <div style={{ gridColumn: '1 / -1', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}

                {/* Coluna esquerda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Categoria *</label>
                  <select value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setEntidadeId('') }}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Selecione</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Autoridade responsável *</label>
                  <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Selecione a autoridade</option>
                    {(categoriaId && catEntidades[categoriaId]?.length
                      ? entidades.filter(en => catEntidades[categoriaId].includes(en.id))
                      : entidades
                    ).map((en) => <option key={en.id} value={en.id}>{en.nome} — {en.cargo}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Endereço *</label>
                  <MiniMapaConfirmar onConfirmar={aoConfirmarEndereco} onAlterar={aoAlterarEndereco} />
                </div>
                </div>{/* fecha coluna esquerda */}

                {/* Coluna direita */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o problema em detalhes..."
                    style={{ width: '100%', flex: 1, minHeight: '80px', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>
                    Foto <span style={{ color: '#6b7280', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  {!fotoPreview ? (
                    <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} style={{ display: 'none' }} />
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}><strong style={{ color: '#4256c8' }}>Toque para tirar foto</strong> ou escolher da galeria</div>
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

                <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

                <button type="submit" disabled={enviando}
                  style={{ marginTop: 'auto', backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Enviando...' : 'Registrar Demanda'}
                </button>
                </div>{/* fecha coluna direita */}
              </form>
              </div>{/* fecha área rolável */}
              </>
            )}
          </div>
        </div>
      )}

      {voo && (
        <div style={{
          position: 'fixed', zIndex: 2000,
          left: voo.animando ? voo.toX : voo.fromX,
          top: voo.animando ? voo.toY : voo.fromY,
          width: voo.animando ? voo.toW : voo.fromW,
          height: voo.animando ? voo.toH : voo.fromH,
          background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          opacity: voo.animando ? 0.5 : 1,
          transition: 'left 0.38s cubic-bezier(.25,.46,.45,.94), top 0.38s cubic-bezier(.25,.46,.45,.94), width 0.38s cubic-bezier(.25,.46,.45,.94), height 0.38s cubic-bezier(.25,.46,.45,.94), opacity 0.32s',
          pointerEvents: 'none',
        }} />
      )}

      <style>{`
        @media (max-width: 640px) {
          .registro-form-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes card-assenta {
          0% { transform: translateY(-10px); opacity: 0.4; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .demanda-detalhe-anim { animation: card-assenta 0.28s cubic-bezier(.25,.46,.45,.94); }
        @keyframes sheet-chevron-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(3px); opacity: 1; }
        }
        .sheet-chevron { animation: sheet-chevron-bounce 1.6s ease-in-out infinite; }
      `}</style>

    </div>
  )
}
