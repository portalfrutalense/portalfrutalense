'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import ModalAuth from './ModalAuth'
import { useMapaBase } from './mapa/useMapaBase'
import { usePets, useMarkersPets, SidebarPets, FormularioPet } from './mapa/CamadaPets'
import { useClassificados, useMarkersClassificados, SidebarClassificados, FormularioClassificado } from './mapa/CamadaClassificados'
import { useEmpregos, useMarkersEmpregos, SidebarEmpregos, FormularioEmprego } from './mapa/CamadaEmpregos'
import { FormDemanda } from './mapa/FormDemanda'
import { Demanda, CategoriaMapa, Entidade, DemandaEntidade, Camada, Pet, Classificado, Emprego } from '@/types'

const CAMADAS: { id: Camada; rotulo: string }[] = [
  { id: 'demandas', rotulo: 'Demandas' },
  { id: 'pets', rotulo: 'Pets' },
  { id: 'classificados', rotulo: 'Classificados' },
  { id: 'empregos', rotulo: 'Empregos' },
]

function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}


export default function MapaDemandas() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const [modalAuth, setModalAuth] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  // Mapa base compartilhado por todas as camadas — criado uma única vez
  const { mapRef, mapaObj, leafletObj, mapaCarregado } = useMapaBase()

  const markersRef = useRef<any[]>([])
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Camada ativa — sincroniza com ?camada= da URL
  const searchParams = useSearchParams()
  const camadaParam = (searchParams.get('camada') as Camada) || 'demandas'
  const [camada, setCamada] = useState<Camada>(camadaParam)
  useEffect(() => {
    const c = (searchParams.get('camada') as Camada) || 'demandas'
    if (c !== camada) trocarCamada(c)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Estado da camada de pets
  const { pets, cores: coresPets, recarregar: recarregarPets } = usePets()
  const [filtroPet, setFiltroPet] = useState('')
  const [petSelecionado, setPetSelecionado] = useState<Pet | null>(null)
  const [formPet, setFormPet] = useState<{ aberto: boolean; editando: Pet | null }>({ aberto: false, editando: null })

  // Estado da camada de classificados
  const { classificados, config: configClassificados, recarregar: recarregarClassificados } = useClassificados()
  const [filtroClassificado, setFiltroClassificado] = useState('')
  const [classificadoSelecionado, setClassificadoSelecionado] = useState<Classificado | null>(null)
  const [formClassificado, setFormClassificado] = useState<{ aberto: boolean; editando: Classificado | null }>({ aberto: false, editando: null })

  // Estado da camada de empregos
  const { empregos, config: configEmpregos, recarregar: recarregarEmpregos } = useEmpregos()
  const [filtroEmprego, setFiltroEmprego] = useState('')
  const [empregoSelecionado, setEmpregoSelecionado] = useState<Emprego | null>(null)
  const [formEmprego, setFormEmprego] = useState<{ aberto: boolean; editando: Emprego | null }>({ aberto: false, editando: null })
  const [voo, setVoo] = useState<{ fromX: number; fromY: number; fromW: number; fromH: number; toX: number; toY: number; toW: number; toH: number; animando: boolean } | null>(null)
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({})
  const [demandaSelecionada, setDemandaSelecionada] = useState<Demanda | null>(null)
  const [vinculosDemanda, setVinculosDemanda] = useState<DemandaEntidade[]>([])

  // Bottom sheet (mobile)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  const [sheetState, setSheetState] = useState<'peek' | 'half' | 'full'>('peek')
  const [dicaArrasteVisivel, setDicaArrasteVisivel] = useState(true)
  const arrasteRef = useRef<{ startY: number; startFrac: number } | null>(null)
  const SNAP: Record<'peek' | 'half' | 'full', number> = { peek: 0.14, half: 0.47, full: 0.75 }

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  // Form state (demanda)
  const [formDemandaAberto, setFormDemandaAberto] = useState(false)

  // Busca vínculos de autoridade e protocolo quando uma demanda é selecionada
  useEffect(() => {
    if (!demandaSelecionada) { setVinculosDemanda([]); return }
    supabase
      .from('demanda_entidades')
      .select('id, demanda_id, entidade_id, status, resposta, respondida_em, entidade:entidades(nome, cargo)')
      .eq('demanda_id', demandaSelecionada.id)
      .then(({ data }) => setVinculosDemanda((data || []) as unknown as DemandaEntidade[]))
    // Busca protocolo separadamente (campo não incluído no select público por restrições de role)
    supabase
      .from('demandas')
      .select('protocolo')
      .eq('id', demandaSelecionada.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.protocolo) setDemandaSelecionada(prev => prev ? { ...prev, protocolo: data.protocolo } : prev)
      })
  }, [demandaSelecionada?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([
      supabase.from('demandas')
        .select('id, user_id, morador_nome, categoria_id, entidade_id, descricao, lat, lng, endereco_label, foto_url, status, resposta, oculto, created_at, categoria:categorias_mapa(*), entidade:entidades(nome, cargo)')
        .in('status', ['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida']).eq('oculto', false),
      supabase.from('categorias_mapa').select('*').eq('ativo', true).order('nome'),
      supabase.from('entidades').select('id, nome, cargo').eq('ativo', true).order('nome'),
      supabase.from('categoria_entidades').select('categoria_id, entidade_id'),
    ]).then(([{ data: d }, { data: c }, { data: e }, { data: ce }]) => {
      setDemandas((d || []) as unknown as Demanda[])
      setCategorias((c || []) as CategoriaMapa[])
      setEntidades((e || []) as Entidade[])
      const mapa: Record<string, string[]> = {}
      for (const row of (ce || [])) {
        if (!mapa[row.categoria_id]) mapa[row.categoria_id] = []
        mapa[row.categoria_id].push(row.entidade_id)
      }
      setCatEntidades(mapa)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function recarregarDemandas() {
    supabase.from('demandas')
      .select('id, user_id, morador_nome, categoria_id, entidade_id, descricao, lat, lng, endereco_label, foto_url, status, resposta, oculto, created_at, categoria:categorias_mapa(*), entidade:entidades(nome, cargo)')
      .in('status', ['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida']).eq('oculto', false)
      .then(({ data }) => { if (data) setDemandas(data as unknown as Demanda[]) })
  }

  // Markers de demandas — inalterados; só não são desenhados quando outra camada está ativa
  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    const mapa = mapaObj.current

    // Limpa markers anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (camada !== 'demandas') return

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
  }, [demandas, user, mapaCarregado, filtroStatus, filtroCategoria, camada])

  // Markers da camada de pets — desenhados só quando ela está ativa
  useMarkersPets({
    ativo: camada === 'pets',
    pets, cores: coresPets, filtro: filtroPet,
    mapaObj, leafletObj, mapaCarregado,
    aoSelecionar: (p) => { setPetSelecionado(p); setSheetState('full') },
  })

  useMarkersClassificados({
    ativo: camada === 'classificados',
    classificados, config: configClassificados, filtro: filtroClassificado,
    mapaObj, leafletObj, mapaCarregado,
    aoSelecionar: (c) => { setClassificadoSelecionado(c); setSheetState('full') },
  })

  useMarkersEmpregos({
    ativo: camada === 'empregos',
    empregos, config: configEmpregos, filtro: filtroEmprego,
    mapaObj, leafletObj, mapaCarregado,
    aoSelecionar: (e) => { setEmpregoSelecionado(e); setSheetState('full') },
  })

  // Trocar de camada limpa a seleção da anterior — o mapa em si é preservado
  function trocarCamada(nova: Camada) {
    if (nova === camada) return
    setCamada(nova)
    setDemandaSelecionada(null)
    setPetSelecionado(null)
    setClassificadoSelecionado(null)
    setEmpregoSelecionado(null)
    setSheetState('peek')
  }

  async function excluirPet(p: Pet) {
    if (!confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return
    const { error } = await supabase.from('pets').delete().eq('id', p.id)
    if (error) return
    setPetSelecionado(null)
    recarregarPets()
  }

  async function marcarPetReencontrado(p: Pet) {
    const { error } = await supabase
      .from('pets')
      .update({ reencontrado: true, reencontrado_em: new Date().toISOString() })
      .eq('id', p.id)
    if (error) return
    setPetSelecionado(null)
    recarregarPets()
  }

  async function excluirClassificado(c: Classificado) {
    if (!confirm('Excluir este anúncio? Essa ação não pode ser desfeita.')) return
    const { error } = await supabase.from('classificados').delete().eq('id', c.id)
    if (error) return
    setClassificadoSelecionado(null)
    recarregarClassificados()
  }

  async function marcarClassificadoVendido(c: Classificado) {
    const { error } = await supabase.from('classificados').update({ vendido: true }).eq('id', c.id)
    if (error) return
    setClassificadoSelecionado(null)
    recarregarClassificados()
  }

  async function excluirEmprego(e: Emprego) {
    if (!confirm('Excluir esta vaga? Essa ação não pode ser desfeita.')) return
    const { error } = await supabase.from('empregos').delete().eq('id', e.id)
    if (error) return
    setEmpregoSelecionado(null)
    recarregarEmpregos()
  }

  async function encerrarEmprego(e: Emprego) {
    const { error } = await supabase.from('empregos').update({ encerrada: true }).eq('id', e.id)
    if (error) return
    setEmpregoSelecionado(null)
    recarregarEmpregos()
  }

  // Detecta mobile (mesmo breakpoint do resto do layout)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const aoMudar = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  // Texto "Arraste para ver mais" some sozinho depois de 5s
  useEffect(() => {
    const t = setTimeout(() => setDicaArrasteVisivel(false), 10000)
    return () => clearTimeout(t)
  }, [])

  function cicloSheet() {
    setSheetState(prev => {
      if (prev === 'peek') return 'half'
      if (prev === 'half') return (demandaSelecionada || petSelecionado || classificadoSelecionado || empregoSelecionado) ? 'full' : 'peek'
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
    const candidatos = (demandaSelecionada || petSelecionado || classificadoSelecionado || empregoSelecionado) ? (['peek', 'half', 'full'] as const) : (['peek', 'half'] as const)
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
              style={{ flexShrink: 0, padding: '10px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'grab', touchAction: 'none' }}
            >
              <svg className="sheet-chevron" width="22" height="13" viewBox="0 0 22 13" fill="none" style={{ color: '#9ca3af' }}>
                <path d="M1 12l10-10 10 10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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

          {camada === 'pets' ? (
            /* ── CAMADA: PETS ── */
            <SidebarPets
              pets={pets}
              cores={coresPets}
              filtro={filtroPet}
              setFiltro={setFiltroPet}
              selecionado={petSelecionado}
              setSelecionado={(p) => { setPetSelecionado(p); if (!p) setSheetState('peek') }}
              onRegistrar={() => user ? setFormPet({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(p) => setFormPet({ aberto: true, editando: p })}
              onExcluir={excluirPet}
              onMarcarReencontrado={marcarPetReencontrado}
              onFoto={setFotoAmpliada}
            />
          ) : camada === 'classificados' ? (
            /* ── CAMADA: CLASSIFICADOS ── */
            <SidebarClassificados
              classificados={classificados}
              config={configClassificados}
              filtro={filtroClassificado}
              setFiltro={setFiltroClassificado}
              selecionado={classificadoSelecionado}
              setSelecionado={(c) => { setClassificadoSelecionado(c); if (!c) setSheetState('peek') }}
              onRegistrar={() => user ? setFormClassificado({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(c) => setFormClassificado({ aberto: true, editando: c })}
              onExcluir={excluirClassificado}
              onMarcarVendido={marcarClassificadoVendido}
              onFoto={setFotoAmpliada}
            />
          ) : camada === 'empregos' ? (
            /* ── CAMADA: EMPREGOS ── */
            <SidebarEmpregos
              empregos={empregos}
              filtro={filtroEmprego}
              setFiltro={setFiltroEmprego}
              selecionado={empregoSelecionado}
              setSelecionado={(e) => { setEmpregoSelecionado(e); if (!e) setSheetState('peek') }}
              onPublicar={() => user ? setFormEmprego({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(e) => setFormEmprego({ aberto: true, editando: e })}
              onExcluir={excluirEmprego}
              onEncerrar={encerrarEmprego}
            />
          ) : demandaSelecionada ? (
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

                {/* Badge de status + protocolo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
                    background: statusCor[demandaSelecionada.status]?.bg || '#f9fafb',
                    color: statusCor[demandaSelecionada.status]?.color || '#6b7280',
                  }}>
                    {statusLabel[demandaSelecionada.status] || demandaSelecionada.status}
                  </span>
                  {demandaSelecionada.protocolo && (
                    <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                      Protocolo: <strong style={{ color: '#111827' }}>{demandaSelecionada.protocolo}</strong>
                    </span>
                  )}
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
                      onClick={() => setFotoAmpliada(demandaSelecionada.foto_url!)}
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                    />
                  )}

                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                    Criada em {new Date(demandaSelecionada.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Respostas das autoridades */}
                {vinculosDemanda.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Respostas das autoridades</p>
                    {vinculosDemanda.map(v => (
                      <div key={v.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: v.resposta ? '4px' : 0 }}>
                          <span style={{ fontSize: '11px' }}>{v.status === 'respondida' ? '✅' : '⏳'}</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(v.entidade as any)?.nome}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            — {(v.entidade as any)?.cargo}
                          </span>
                        </div>
                        {v.resposta ? (
                          <p style={{ margin: 0, fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>{v.resposta}</p>
                        ) : (
                          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Aguardando resposta...</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : demandaSelecionada.resposta ? (
                  // Fallback legado: demanda antiga com resposta única
                  <div style={{ fontSize: '12px', color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', lineHeight: 1.5 }}>
                    <strong>Resposta:</strong> {demandaSelecionada.resposta}
                  </div>
                ) : null}

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
                        const { data: { session } } = await supabase.auth.getSession()
                        const res = await fetch('/api/demandas/excluir', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                          body: JSON.stringify({ demanda_id: demandaSelecionada.id }),
                        })
                        if (!res.ok) return
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
                    onClick={() => setFormDemandaAberto(true)}
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

                {/* Filtro de categoria */}
                {categorias.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
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

                {/* Filtro de status */}
                <div>
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

          {/* Banner de login */}
          {!user && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(15,36,64,0.92), transparent)', padding: '40px 24px 20px', zIndex: 1000, textAlign: 'center' }}>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '14px', margin: '0 0 10px' }}>
                {{
                  demandas: 'Faça login para ver as demandas completas',
                  pets: 'Faça login para ver os registros completos',
                  classificados: 'Faça login para ver os anúncios completos',
                  empregos: 'Faça login para ver as vagas completas',
                }[camada]}
              </p>
              <button onClick={() => setModalAuth(true)} style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                Entrar com Google
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de auth */}
      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}

      {/* Formulário de pet (criar / editar) */}
      {formPet.aberto && (
        <FormularioPet
          editando={formPet.editando}
          aoFechar={() => setFormPet({ aberto: false, editando: null })}
          aoSalvar={() => { recarregarPets(); setPetSelecionado(null) }}
        />
      )}

      {/* Formulário de classificado (criar / editar) */}
      {formClassificado.aberto && (
        <FormularioClassificado
          editando={formClassificado.editando}
          aoFechar={() => setFormClassificado({ aberto: false, editando: null })}
          aoSalvar={() => { recarregarClassificados(); setClassificadoSelecionado(null) }}
        />
      )}

      {/* Formulário de vaga (criar / editar) */}
      {formEmprego.aberto && (
        <FormularioEmprego
          editando={formEmprego.editando}
          aoFechar={() => setFormEmprego({ aberto: false, editando: null })}
          aoSalvar={() => { recarregarEmpregos(); setEmpregoSelecionado(null) }}
        />
      )}

      {/* Lightbox: foto da demanda ampliada, sem sair da pagina */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}
        >
          <button
            onClick={() => setFotoAmpliada(null)}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '36px', height: '36px', borderRadius: '50%', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAmpliada}
            alt="Foto da demanda ampliada"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', cursor: 'default' }}
          />
        </div>
      )}

      {/* Formulário de demanda */}
      <FormDemanda
        aberto={formDemandaAberto}
        aoFechar={() => setFormDemandaAberto(false)}
        aoSalvar={recarregarDemandas}
        categorias={categorias}
        entidades={entidades}
        catEntidades={catEntidades}
      />


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
          50% { transform: translateY(-4px); opacity: 1; }
        }
        .sheet-chevron { animation: sheet-chevron-bounce 1.6s ease-in-out infinite; }
      `}</style>

    </div>
  )
}

