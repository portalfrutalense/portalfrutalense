'use client'

import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import { useSheet } from '@/contexts/SheetContext'
import ModalAuth from './ModalAuth'
import { useMapaBase } from './mapa/useMapaBase'
import { usePets, useMarkersPets, SidebarPets, FormularioPet } from './mapa/CamadaPets'
import { useClassificados, useMarkersClassificados, SidebarClassificados, FormularioClassificado } from './mapa/CamadaClassificados'
import { useEmpregos, useMarkersEmpregos, SidebarEmpregos, FormularioEmprego } from './mapa/CamadaEmpregos'
import { useImoveis, useMarkersImoveis, SidebarImoveis, FormularioImovel } from './mapa/CamadaImoveis'
import { FormDemanda } from './mapa/FormDemanda'
import MapaTopBar from './mapa/MapaTopBar'
import { Demanda, CategoriaMapa, Entidade, DemandaEntidade, Camada, Pet, Classificado, Emprego, Imovel } from '@/types'
import { escapeHtml } from '@/lib/escapeHtml'
// Só o tipo — o maplibre-gl em si continua carregado dinamicamente por
// useMapaBase (import type é apagado na compilação, não força o bundle).
import type { Marker, Popup } from 'maplibre-gl'

// BUG CORRIGIDO: `\b\w` é ASCII-only em JS — não reconhece letra acentuada
// como caractere de palavra, então o "limite de palavra" (\b) aparecia
// DEPOIS da primeira letra acentuada, não antes: "Ângela" (após o
// toLowerCase) virava "âNgela" (a 2ª letra que ganhava maiúscula, não a
// 1ª). Mesma classe de bug documentada como corrigida no webhook do
// WhatsApp (falta da flag `u`), não replicada aqui. Corrigido evitando
// `\w`/`\b` inteiramente: separa por espaço e capitaliza com métodos de
// string puros.
function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().split(' ').map((w) => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// `useLayoutEffect` gera aviso do React ao rodar em SSR (sem DOM) — cai pra
// `useEffect` nesse caso, mantendo o comportamento síncrono só no navegador.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function MapaDemandas() {
  const supabase = createClient()
  const { user } = useAuth()
  const [modalAuth, setModalAuth] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  // Mapa base compartilhado por todas as camadas — criado uma única vez
  const { mapRef, mapaObj, maplibreObj, mapaCarregado } = useMapaBase()

  const markersRef = useRef<Marker[]>([])
  const popupAbertoRef = useRef<Popup | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Camada ativa — sincroniza com ?camada= da URL
  const searchParams = useSearchParams()
  // "todos" (pins de todas as camadas juntos) é o padrão agora — pedido do
  // usuário, /mapa sem `?camada=` deve abrir nesse modo.
  const camadaParam = (searchParams.get('camada') as Camada) || 'todos'
  const [camada, setCamada] = useState<Camada>(camadaParam)
  // O efeito que reage a mudanças de "?camada=" na URL fica logo abaixo da
  // declaração de trocarCamada (perto do fim do componente) — antes ele
  // ficava aqui em cima, chamando trocarCamada antes dela ser declarada no
  // arquivo. Funcionava (declaração de função sobe em JS), mas o linter
  // não consegue garantir que a versão usada aqui sempre reflita o estado
  // mais atual do componente conforme ele muda.

  // Estado da camada de pets
  const { pets, cores: coresPets, icones: iconesPets, recarregar: recarregarPets } = usePets()
  const [filtroPet, setFiltroPet] = useState('')
  const [petSelecionado, setPetSelecionado] = useState<Pet | null>(null)
  const [formPet, setFormPet] = useState<{ aberto: boolean; editando: Pet | null }>({ aberto: false, editando: null })

  // Estado da camada de classificados
  const { classificados, config: configClassificados, recarregar: recarregarClassificados } = useClassificados()
  const [filtroClassificado, setFiltroClassificado] = useState('')
  const [classificadoSelecionado, setClassificadoSelecionado] = useState<Classificado | null>(null)
  const [formClassificado, setFormClassificado] = useState<{ aberto: boolean; editando: Classificado | null }>({ aberto: false, editando: null })

  // Estado da camada de empregos
  // BUG CORRIGIDO (pedido do usuário): vagas não são mais filtradas por
  // tipo de contrato — `filtroEmprego` foi removido (junto com o dropdown
  // e a prop `filtro` de useMarkersEmpregos/SidebarEmpregos).
  const { empregos, config: configEmpregos, recarregar: recarregarEmpregos } = useEmpregos()
  const [empregoSelecionado, setEmpregoSelecionado] = useState<Emprego | null>(null)
  const [formEmprego, setFormEmprego] = useState<{ aberto: boolean; editando: Emprego | null }>({ aberto: false, editando: null })

  // Estado da camada de imóveis
  const { imoveis, config: configImoveis, recarregar: recarregarImoveis } = useImoveis()
  const [filtroImovel, setFiltroImovel] = useState('')
  const [imovelSelecionado, setImovelSelecionado] = useState<Imovel | null>(null)
  const [formImovel, setFormImovel] = useState<{ aberto: boolean; editando: Imovel | null }>({ aberto: false, editando: null })
  const [voo, setVoo] = useState<{ fromX: number; fromY: number; fromW: number; fromH: number; toX: number; toY: number; toW: number; toH: number; animando: boolean } | null>(null)
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({})
  const [demandaSelecionada, setDemandaSelecionada] = useState<Demanda | null>(null)
  const [vinculosDemanda, setVinculosDemanda] = useState<DemandaEntidade[]>([])

  const { setSheetState: setSheetContext } = useSheet()

  // Bottom sheet (mobile)
  // Sempre inicia false para coincidir com o SSR; useEffect ajusta no cliente
  const [isMobile, setIsMobile] = useState(false)
  const [sheetState, setSheetStateLocal] = useState<'peek' | 'half' | 'full'>('peek')

  function setSheetState(s: 'peek' | 'half' | 'full') {
    setSheetStateLocal(s)
    setSheetContext(s)
  }

  // Inicializa o contexto global com 'peek' ao montar — só em mobile.
  //
  // BUG CORRIGIDO (pedido do usuário): rodava incondicionalmente, sem
  // checar `isMobile` — publicava 'peek' no contexto global mesmo em
  // desktop, onde não existe bottom sheet nenhum (a sidebar é fixa, sem
  // posição em % de altura de tela). O ChatBot.tsx lê esse contexto pra
  // posicionar o botão flutuante "grudado" no sheet (`calc(SNAP*100vh +
  // 12px)`) — em desktop isso empurrava o botão bem mais pra cima do que
  // os 24px fixos do canto inferior direito que deveria ter, já que 15%
  // (SNAP.peek) da altura da tela raramente bate com 24px do fundo.
  useEffect(() => {
    if (!isMobile) { setSheetContext(null); return }
    setSheetContext('peek')
    return () => setSheetContext(null)
  }, [isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  // `startState` guarda de que estado o arraste começou — usado pra travar
  // a saída do "full" só soltando o dedo (ver aoSoltarArraste).
  const arrasteRef = useRef<{ startY: number; startFrac: number; startState: 'peek' | 'half' | 'full' } | null>(null)
  const SNAP: Record<'peek' | 'half' | 'full', number> = { peek: 0.15, half: 0.75, full: 0.87 }

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  // Form state (demanda)
  const [formDemandaAberto, setFormDemandaAberto] = useState(false)

  // Busca vínculos de autoridade e protocolo quando uma demanda é selecionada
  useEffect(() => {
    if (!demandaSelecionada) { Promise.resolve().then(() => setVinculosDemanda([])); return }
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
        // LIMPEZA (código morto): tirado `entidade_id` cru daqui — só o objeto
        // relacionado `entidade` (nome/cargo) é lido em algum lugar da tela;
        // a coluna crua nunca era usada, só buscada à toa.
        .select('id, user_id, morador_nome, categoria_id, descricao, lat, lng, endereco_label, foto_url, status, resposta, oculto, created_at, categoria:categorias_mapa(*), entidade:entidades(nome, cargo)')
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
      .select('id, user_id, morador_nome, categoria_id, descricao, lat, lng, endereco_label, foto_url, status, resposta, oculto, created_at, categoria:categorias_mapa(*), entidade:entidades(nome, cargo)')
      .in('status', ['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida']).eq('oculto', false)
      .then(({ data }) => { if (data) setDemandas(data as unknown as Demanda[]) })
  }

  // Markers de demandas — inalterados; só não são desenhados quando outra camada está ativa
  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !maplibreObj.current) return
    const maplibregl = maplibreObj.current
    const mapa = mapaObj.current

    // Limpa markers anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (camada !== 'demandas' && camada !== 'todos') return

    const filtradas = demandas.filter(d => {
      if (filtroStatus && d.status !== filtroStatus) return false
      if (filtroCategoria && d.categoria_id !== filtroCategoria) return false

      return true
    })

    function criarElementoPin(d: typeof filtradas[0]) {
      const cor = d.categoria?.cor || '#4256c8'
      const iconeUrl = d.categoria?.icone_url

      // Miolo do pin — o que muda entre os 3 casos.
      // foto_url/iconeUrl vão pra dentro de um src="" de HTML bruto (não é
      // JSX, não escapa sozinho) — sem escapeHtml aqui, um valor malicioso
      // vira XSS armazenado pra quem visualizar o mapa.
      // BUG CORRIGIDO (PageSpeed Insights — acessibilidade): faltava `alt`
      // nesses <img> — vazio (`alt=""`) porque são puramente decorativos, o
      // conteúdo real (categoria/descrição) já vem em texto ao lado, e o
      // pin como um todo ganha aria-label descritivo logo abaixo.
      let miolo: string
      if (d.foto_url) {
        miolo = `<img src="${escapeHtml(d.foto_url)}" alt="" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;object-fit:cover;" />`
      } else if (iconeUrl) {
        miolo = `<img src="${escapeHtml(iconeUrl)}" alt="" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:125%;height:125%;object-fit:contain;filter:brightness(1.3);" />`
      } else {
        miolo = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:23px;height:23px;border-radius:50%;background:${cor};"></div>`
      }

      const fundoExtra = d.foto_url ? `background:transparent;` : `background:white;`

      const el = document.createElement('div')
      el.className = 'pin-demanda'
      el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,.35))'
      el.style.cursor = 'pointer'
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;overflow:hidden;position:relative;${fundoExtra}">
          ${miolo}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
      </div>`
      return el
    }

    const demandaPorId = new Map(filtradas.map(d => [d.id, d]))

    filtradas.forEach((d) => {
      const popupHtml = `
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          ${d.foto_url ? `<img src="${escapeHtml(d.foto_url)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />` : ''}
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#4256c8;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(d.categoria?.nome) || 'Sem categoria'}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${escapeHtml(titleCase(d.endereco_label))}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#111827;line-height:1.4;">${escapeHtml(sentenceCase(d.descricao))}</p>
          <button class="ver-mais-btn" data-ver-mais="${d.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver demanda
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `

      const popup = new maplibregl.Popup({ maxWidth: '260px', closeButton: true }).setHTML(popupHtml)
      popup.on('open', () => { popupAbertoRef.current = popup })
      popup.on('close', () => { if (popupAbertoRef.current === popup) popupAbertoRef.current = null })

      const el = criarElementoPin(d)
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([d.lng, d.lat])
        .addTo(mapa)
      // Acessibilidade (PageSpeed Insights — "Elements must only use
      // permitted ARIA attributes"): o MapLibre marca o container do marker
      // como `aria-label="Map marker"` genérico dentro do PRÓPRIO
      // construtor — sobrescrever `el` antes de criar o Marker não
      // funciona, ele reaplica o padrão. Precisa vir DEPOIS.
      el.setAttribute('aria-label', `Ver demanda: ${d.categoria?.nome || 'Sem categoria'}`)

      // Diferente das outras 3 camadas: aqui o popup só abre depois de checar
      // login — por isso não usa marker.setPopup() (que abriria direto no
      // clique), o clique é interceptado à mão.
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (!user) { setModalAuth(true); return }
        popup.setLngLat([d.lng, d.lat]).addTo(mapa)
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
      const popupEl = alvo.closest('.maplibregl-popup-content') as HTMLElement | null
      const fromRect = (popupEl || alvo).getBoundingClientRect()
      const toRect = sidebarRef.current?.getBoundingClientRect()

      // No modo "Todos", clicar em "Ver mais" já troca pra camada certa
      // (pedido do usuário), abrindo o card completo dela.
      if (camada === 'todos') setCamada('demandas')

      if (!toRect) {
        setDemandaSelecionada(demanda)
        setSheetState('full')
        popupAbertoRef.current?.remove()
        return
      }

      setVoo({
        fromX: fromRect.left, fromY: fromRect.top, fromW: fromRect.width, fromH: fromRect.height,
        toX: toRect.left, toY: toRect.top, toW: toRect.width, toH: toRect.height,
        animando: false,
      })
      popupAbertoRef.current?.remove()

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
      // Sem isso, um popup aberto (não anexado ao marker — ver comentário
      // acima) sobrevivia a esse efeito rerodar (nova demanda chegou, filtro
      // mudou): os markers somem, mas o popup solto continuava na tela,
      // "grudado", apontando pra um clique que não existe mais.
      popupAbertoRef.current?.remove()
      popupAbertoRef.current = null
    }
  }, [demandas, user, mapaCarregado, filtroStatus, filtroCategoria, camada]) // eslint-disable-line react-hooks/exhaustive-deps

  // Markers da camada de pets — desenhados quando ela está ativa OU no modo
  // "Todos" (pedido do usuário: mostra pins de todas as camadas juntos).
  useMarkersPets({
    ativo: camada === 'pets' || camada === 'todos',
    pets, cores: coresPets, icones: iconesPets, filtro: filtroPet,
    mapaObj, maplibreObj, mapaCarregado,
    // No modo "Todos", "Ver mais" no popup já troca pra camada certa antes
    // de abrir o card completo (pedido do usuário).
    aoSelecionar: (p) => { if (camada === 'todos') setCamada('pets'); setPetSelecionado(p); setSheetState('full') },
    logado: !!user, aoExigirLogin: () => setModalAuth(true),
  })

  useMarkersClassificados({
    ativo: camada === 'classificados' || camada === 'todos',
    classificados, config: configClassificados, filtro: filtroClassificado,
    mapaObj, maplibreObj, mapaCarregado,
    aoSelecionar: (c) => { if (camada === 'todos') setCamada('classificados'); setClassificadoSelecionado(c); setSheetState('full') },
    logado: !!user, aoExigirLogin: () => setModalAuth(true),
  })

  useMarkersEmpregos({
    ativo: camada === 'empregos' || camada === 'todos',
    empregos, config: configEmpregos,
    mapaObj, maplibreObj, mapaCarregado,
    aoSelecionar: (e) => { if (camada === 'todos') setCamada('empregos'); setEmpregoSelecionado(e); setSheetState('full') },
    logado: !!user, aoExigirLogin: () => setModalAuth(true),
  })

  useMarkersImoveis({
    ativo: camada === 'imoveis' || camada === 'todos',
    imoveis, config: configImoveis, filtro: filtroImovel,
    mapaObj, maplibreObj, mapaCarregado,
    aoSelecionar: (i) => { if (camada === 'todos') setCamada('imoveis'); setImovelSelecionado(i); setSheetState('full') },
    logado: !!user, aoExigirLogin: () => setModalAuth(true),
  })

  // Trocar de camada limpa a seleção da anterior — o mapa em si é preservado
  function trocarCamada(nova: Camada) {
    if (nova === camada) return
    setCamada(nova)
    setDemandaSelecionada(null)
    setPetSelecionado(null)
    setClassificadoSelecionado(null)
    setEmpregoSelecionado(null)
    setImovelSelecionado(null)
    setSheetState('peek')
  }

  useEffect(() => {
    const c = (searchParams.get('camada') as Camada) || 'todos'
    if (c !== camada) Promise.resolve().then(() => trocarCamada(c))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Passa pelo backend (service_role) em vez de apagar a linha direto do
  // client: só assim dá pra limpar a foto do Storage antes de excluir —
  // apagar via RLS comum nunca teve acesso pra isso, e a linha ficava
  // apagada mas o arquivo continuava órfão no bucket pra sempre.
  // BUG CORRIGIDO: devolvia só `res.ok` — quando a exclusão falhava, o item
  // simplesmente continuava na tela sem nenhuma mensagem ao usuário.
  async function excluirViaApi(camada: 'pets' | 'classificados' | 'empregos' | 'imoveis', id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/camadas/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ camada, id }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Não foi possível excluir. Tente novamente.')
      return false
    }
    return true
  }

  // BUG CORRIGIDO (achado ao implementar a trava do "full"): estas 6
  // funções desselecionavam o item sem tocar no sheetState — no mobile,
  // detalhe só existe com sheetState='full' (sem alcinha nenhuma agora),
  // então excluir/marcar por aqui devolvia a pessoa pra lista, mas com o
  // sheet ainda travado em "full" e sem nenhum jeito de sair (a única
  // saída do "full" é o botão "Voltar", que essas ações pulam). Todas
  // passam a devolver pro "half" também.
  async function excluirPet(p: Pet) {
    if (!confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('pets', p.id)) return
    setPetSelecionado(null)
    setSheetState('half')
    recarregarPets()
  }

  async function marcarPetReencontrado(p: Pet) {
    const { error } = await supabase
      .from('pets')
      .update({ reencontrado: true, reencontrado_em: new Date().toISOString() })
      .eq('id', p.id)
    // BUG CORRIGIDO: `if (error) return` engolia a falha em silêncio — o
    // botão parecia simplesmente não fazer nada.
    if (error) { alert('Não foi possível marcar como reencontrado. Tente novamente.'); return }
    setPetSelecionado(null)
    setSheetState('half')
    recarregarPets()
  }

  async function excluirClassificado(c: Classificado) {
    if (!confirm('Excluir este anúncio? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('classificados', c.id)) return
    setClassificadoSelecionado(null)
    setSheetState('half')
    recarregarClassificados()
  }

  // BUG CORRIGIDO (decisão confirmada com o usuário): "marcar vendido"
  // antes só ligava a flag `vendido` — a linha e as fotos continuavam no
  // banco/Storage pra sempre, só saindo do mapa público. Agora usa a mesma
  // rota de exclusão que excluirClassificado (apaga linha + fotos de
  // verdade, sem rastro) — mesmo padrão aplicado a encerrarEmprego e
  // marcarImovelVendidoAlugado logo abaixo.
  async function marcarClassificadoVendido(c: Classificado) {
    if (!confirm('Marcar como vendido? O anúncio será excluído e não poderá ser recuperado.')) return
    if (!await excluirViaApi('classificados', c.id)) return
    setClassificadoSelecionado(null)
    setSheetState('half')
    recarregarClassificados()
  }

  async function excluirEmprego(e: Emprego) {
    if (!confirm('Excluir esta vaga? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('empregos', e.id)) return
    setEmpregoSelecionado(null)
    setSheetState('half')
    recarregarEmpregos()
  }

  // BUG CORRIGIDO (decisão confirmada com o usuário): ver comentário de
  // marcarClassificadoVendido acima — mesma mudança de flag pra exclusão real.
  async function encerrarEmprego(e: Emprego) {
    if (!confirm('Encerrar esta vaga? O anúncio será excluído e não poderá ser recuperado.')) return
    if (!await excluirViaApi('empregos', e.id)) return
    setEmpregoSelecionado(null)
    setSheetState('half')
    recarregarEmpregos()
  }

  async function excluirImovel(i: Imovel) {
    if (!confirm('Excluir este anúncio? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('imoveis', i.id)) return
    setImovelSelecionado(null)
    setSheetState('half')
    recarregarImoveis()
  }

  // "Marcar vendido/alugado" já nasce como exclusão real (nunca teve uma
  // flag como `classificados.vendido`/`empregos.encerrada` — ver
  // sql/migration-imoveis.sql), mesmo comportamento das duas funções acima.
  async function marcarImovelVendidoAlugado(i: Imovel) {
    const acao = i.finalidade === 'aluguel' ? 'alugado' : 'vendido'
    if (!confirm(`Marcar como ${acao}? O anúncio será excluído e não poderá ser recuperado.`)) return
    if (!await excluirViaApi('imoveis', i.id)) return
    setImovelSelecionado(null)
    setSheetState('half')
    recarregarImoveis()
  }

  // Detecta mobile (mesmo breakpoint do resto do layout)
  //
  // CORREÇÃO DE CLS (PageSpeed Insights — 0.85, a pior nota possível,
  // achada depois do revert de 2026-09-03): antes usava `useEffect` normal,
  // que só roda DEPOIS da primeira pintura da tela — a página sempre
  // desenhava primeiro o layout desktop (padrão SSR-safe de `isMobile`),
  // pra só então trocar pro layout mobile (sidebar vira bottom sheet),
  // causando o maior salto de layout que o Lighthouse consegue medir.
  // `useIsomorphicLayoutEffect` roda de forma síncrona ANTES da pintura no
  // navegador (é só `useEffect` mesmo durante SSR, pra não disparar o aviso
  // do React sobre useLayoutEffect no servidor) — o layout certo já nasce
  // certo, sem o "flash" do desktop.
  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setIsMobile(mq.matches)
    const aoMudar = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  // Texto "Arraste para ver mais" — sempre visível

  // MUDANÇA DE COMPORTAMENTO (pedido do usuário): "full" só é alcançado
  // selecionando um item (pin no mapa ou card da lista — ver
  // MapaTopBar/SidebarX/o clique na lista de demandas), nunca por arrasto
  // nem clique na alcinha — e o "full" nem tem mais alcinha (ver JSX do
  // handle mais abaixo: só aparece quando `sheetState !== 'full'`). Sair do
  // "full" é só pelo botão "← Voltar" de dentro do card de detalhe, que
  // agora leva pro "half" (não mais pro "peek" — ver os 4 lugares que
  // chamam `setSheetState` ao desselecionar: aqui embaixo e dentro de cada
  // SidebarX). Por isso `cicloSheet` só precisa tratar "peek → half" — é
  // a única transição que a alcinha ainda cobre.
  function cicloSheet() {
    if (sheetState === 'peek') setSheetState('half')
  }

  function aoIniciarArraste(e: React.TouchEvent) {
    arrasteRef.current = { startY: e.touches[0].clientY, startFrac: SNAP[sheetState], startState: sheetState }
    if (sidebarRef.current) sidebarRef.current.style.transition = 'none'
  }

  function aoArrastar(e: React.TouchEvent) {
    if (!arrasteRef.current || !sidebarRef.current) return
    const deltaY = arrasteRef.current.startY - e.touches[0].clientY
    const novaFrac = Math.min(0.94, Math.max(0.12, arrasteRef.current.startFrac + deltaY / window.innerHeight))
    sidebarRef.current.style.height = `${novaFrac * 100}vh`
  }

  function aoSoltarArraste() {
    if (!arrasteRef.current || !sidebarRef.current) return
    const { startState } = arrasteRef.current
    const alturaAtual = sidebarRef.current.getBoundingClientRect().height / window.innerHeight
    arrasteRef.current = null
    let melhor: 'peek' | 'half' | 'full' = 'peek'
    if (startState === 'full') {
      // Travado: um arraste que começou em "full" sempre volta pro "full",
      // não importa até onde o dedo foi — a única saída é o botão "Voltar"
      // de dentro do card de detalhe (não tem mais alcinha no "full").
      melhor = 'full'
    } else {
      // BUG CORRIGIDO (pedido do usuário): "full" só pode ser alcançado
      // selecionando um item (pin ou card da lista) — nunca por arrasto,
      // nem a partir do "peek" nem do "half". Um arraste que começa em
      // qualquer um dos dois só alterna entre eles.
      //
      // BUG CORRIGIDO (pedido do usuário, "mais sensível"): decidir pelo
      // ponto mais próximo entre os dois snaps exigia arrastar quase até a
      // metade do caminho pra trocar — com "half" bem mais alto agora
      // (75%, contra o "peek" de 15%), isso significava arrastar uns 30%
      // da altura da tela só pra sair do peek. Troca pra um limiar fixo,
      // bem menor: qualquer arraste de mais de 10% da altura da tela na
      // direção certa já troca de estado (senão volta pro estado inicial).
      const LIMIAR = 0.10
      const delta = alturaAtual - SNAP[startState]
      if (startState === 'peek') melhor = delta > LIMIAR ? 'half' : 'peek'
      else melhor = delta < -LIMIAR ? 'peek' : 'half'
    }
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

  // "Mapa Grandão": sidebar+mapa passam a ocupar a tela inteira, sem a
  // moldura de cartão (borda/sombra/cantos arredondados) que existia
  // quando havia margem ao redor (a Navbar, removida desta página, dava
  // esse respiro). Mobile já era assim, sem moldura nenhuma.
  const layoutEstilo: React.CSSProperties = isMobile
    ? { position: 'relative', height: '100%', overflow: 'hidden' }
    : { display: 'flex', overflow: 'hidden', flex: 1 }

  const sidebarEstilo: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500, background: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', boxShadow: '0 -1px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', height: `${SNAP[sheetState] * 100}vh`, transition: 'height 0.25s ease', overflow: 'hidden' }
    // BUG CORRIGIDO (pedido do usuário): a borda direita ia até o topo do
    // sidebar, atravessando a faixa azul da logo — contra o azul, essa
    // linha clara (#e5e7eb) aparecia como uma "listrinha branca" indevida.
    // A borda saiu daqui (não cobre mais a altura da logo) e foi para o
    // wrapper do conteúdo abaixo dela — ver comentário lá.
    : { width: '260px', flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', minHeight: 'clamp(300px, 55vw, 500px)', overflow: 'hidden' }

  // Se tem algo selecionado (card de detalhe aberto, em qualquer camada),
  // o wrapper externo do conteúdo volta a controlar arrasto/scroll como um
  // bloco só (comportamento de sempre) — só as telas de LISTAGEM (filtros +
  // lista de cards) usam o arrasto restrito ao cabeçalho.
  const algumSelecionado = !!(demandaSelecionada || petSelecionado || classificadoSelecionado || empregoSelecionado || imovelSelecionado)

  // Clicar num card resumido da lista (só desktop) centraliza o mapa nele,
  // com um voo suave — mesma biblioteca que o mapa já usa (MapLibre), sem
  // dependência nova.
  function centralizarNoMapa(lat: number, lng: number) {
    const mapa = mapaObj.current
    if (!mapa) return
    mapa.flyTo({ center: [lng, lat], zoom: Math.max(mapa.getZoom(), 16), duration: 800 })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Layout principal: sidebar + mapa */}
      <div className="mapa-layout" style={layoutEstilo}>

        {/* Overlay escuro no mapa quando sheet está aberto (mobile) */}
        {isMobile && sheetState === 'full' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0,0,0,0.25)', pointerEvents: 'none', transition: 'opacity 0.25s ease' }} />
        )}

        {/* SIDEBAR */}
        <div ref={sidebarRef} className="mapa-sidebar" style={sidebarEstilo}>
          {/* Logo fixa — substitui a Navbar (removida desta página) só no
              desktop; no mobile o sidebar não tem cabeçalho, por decisão.
              Fundo azul (não branco): o PNG da logo tem "CIDADAN" em texto
              branco, desenhado pra ficar sobre o azul da navbar — testado
              sobre fundo branco, esse texto fica invisível e só o "IA"
              aparece. */}
          {!isMobile && (
            <Link href="/" style={{ flexShrink: 0, height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4256c8' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '34px', width: 'auto', display: 'block' }} />
            </Link>
          )}
          {/* BUG CORRIGIDO / MUDANÇA DE COMPORTAMENTO (pedido do usuário):
              a alcinha some inteira no "full" — nesse estado a única saída
              é o botão "← Voltar" de dentro do card de detalhe (que leva
              pro "half"), não tem mais toque na alcinha nem arrasto. */}
          {isMobile && sheetState !== 'full' && (
            <div
              onClick={sheetState === 'peek' ? cicloSheet : undefined}
              onTouchStart={aoIniciarArraste}
              onTouchMove={aoArrastar}
              onTouchEnd={aoSoltarArraste}
              style={{ flexShrink: 0, padding: sheetState === 'peek' ? '6px 0 2px' : '8px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'grab', touchAction: 'none' }}
            >
              <svg className={sheetState === 'peek' ? 'sheet-chevron-up' : 'sheet-chevron-down'} width="26" height="15" viewBox="0 0 22 13" fill="none" style={{ color: '#4256c8', marginTop: '4px' }}>
                <path d="M1 12l10-10 10 10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {sheetState === 'peek' && (
                // CORREÇÃO DE ACESSIBILIDADE (PageSpeed Insights — contraste
                // insuficiente): #9ca3af sobre fundo branco não bate a taxa
                // mínima de 4.5:1 do WCAG AA pra texto normal. #6b7280 (já
                // usado como cor de texto secundário no resto do arquivo)
                // passa com folga, sem mudar a intenção visual "discreto".
                <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                  Arraste para ver mais
                </span>
              )}
            </div>
          )}
          {/* Borda direita — antes ficava no container do sidebar inteiro e
              cruzava a faixa azul da logo, criando uma "listrinha branca"
              indevida contra o azul (pedido do usuário). Movida pra cá:
              só cobre a altura do conteúdo abaixo da logo. */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', borderRight: isMobile ? undefined : '1px solid #e5e7eb' }}>
          <div
            // MUDANÇA DE COMPORTAMENTO (pedido do usuário): arrastar em
            // qualquer lugar do conteúdo só faz sentido enquanto o
            // conteúdo é um bloco só, sem lista própria (as telas de
            // detalhe, abaixo). Nas telas de listagem (filtros + lista de
            // cards), cada SidebarX agora cuida do próprio arrasto (só no
            // cabeçalho, até o filtro) e a lista tem scroll de dedo normal
            // — por isso este wrapper externo só assume overflow/arrasto
            // "global" quando existe algo selecionado (tela de detalhe).
            style={algumSelecionado
              ? { flex: 1, overflowY: isMobile ? 'hidden' : 'auto', minHeight: 0, touchAction: isMobile ? 'none' : undefined, display: 'flex', flexDirection: 'column' }
              : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            onTouchStart={algumSelecionado && isMobile ? aoIniciarArraste : undefined}
            onTouchMove={algumSelecionado && isMobile ? aoArrastar : undefined}
            onTouchEnd={algumSelecionado && isMobile ? aoSoltarArraste : undefined}
          >

          {camada === 'todos' ? (
            /* ── TODOS (pedido do usuário): mostra pins de todas as
                camadas juntos no mapa; aqui no sidebar não tem filtro nem
                lista (não teria como listar 5 formatos diferentes de item
                de forma sensata) — só um tutorial explicando como usar. */
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 14px 16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>Como funciona</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#111827', lineHeight: 1.5 }}>
                    <strong>1.</strong> Use o mouse ou os dedos para navegar pelo mapa ou através dos botões no topo.
                  </p>
                </div>
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#111827', lineHeight: 1.5 }}>
                    <strong>2.</strong> Clique em um pin para ver o resumo. Para abrir os detalhes completos, clique em <strong>&quot;Ver mais&quot;</strong>.
                  </p>
                </div>
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#111827', lineHeight: 1.5 }}>
                    <strong>3.</strong> Para registrar uma demanda, um pet perdido/achado, veículo ou imóvel, é preciso estar logado.
                  </p>
                </div>
              </div>

              <p style={{ fontSize: '11px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>O que cada camada é</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Demandas Municipais', desc: 'Registre demandas públicas da cidade e acompanhe a resposta das autoridades direcionadas.' },
                  { label: 'Vagas de Emprego', desc: 'Vagas abertas nas empresas de Frutal-MG.' },
                  { label: 'Veículos', desc: 'Carros, motos e outros veículos à venda.' },
                  { label: 'Imóveis', desc: 'Casas, apartamentos e outros imóveis pra alugar ou vender.' },
                  { label: 'Área PET', desc: 'Pets para adoção, perdidos pelos donos ou encontrados abandonados nas ruas.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '12.5px', fontWeight: 700, color: '#111827' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: 1.45 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : camada === 'pets' ? (
            /* ── CAMADA: PETS ── */
            <SidebarPets
              pets={pets}
              cores={coresPets}
              filtro={filtroPet}
              setFiltro={setFiltroPet}
              selecionado={petSelecionado}
              setSelecionado={(p) => { setPetSelecionado(p); if (!p) setSheetState('half'); else if (isMobile) setSheetState('full') }}
              onRegistrar={() => user ? setFormPet({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(p) => setFormPet({ aberto: true, editando: p })}
              onExcluir={excluirPet}
              onMarcarReencontrado={marcarPetReencontrado}
              onFoto={setFotoAmpliada}
              aoExigirLogin={() => setModalAuth(true)}
              isMobile={isMobile}
              aoIniciarArraste={aoIniciarArraste}
              aoArrastar={aoArrastar}
              aoSoltarArraste={aoSoltarArraste}
              onCentralizar={centralizarNoMapa}
            />
          ) : camada === 'classificados' ? (
            /* ── CAMADA: CLASSIFICADOS ── */
            <SidebarClassificados
              classificados={classificados}
              filtro={filtroClassificado}
              setFiltro={setFiltroClassificado}
              selecionado={classificadoSelecionado}
              setSelecionado={(c) => { setClassificadoSelecionado(c); if (!c) setSheetState('half'); else if (isMobile) setSheetState('full') }}
              onRegistrar={() => user ? setFormClassificado({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(c) => setFormClassificado({ aberto: true, editando: c })}
              onExcluir={excluirClassificado}
              onMarcarVendido={marcarClassificadoVendido}
              onFoto={setFotoAmpliada}
              aoExigirLogin={() => setModalAuth(true)}
              isMobile={isMobile}
              aoIniciarArraste={aoIniciarArraste}
              aoArrastar={aoArrastar}
              aoSoltarArraste={aoSoltarArraste}
              onCentralizar={centralizarNoMapa}
            />
          ) : camada === 'empregos' ? (
            /* ── CAMADA: EMPREGOS ── */
            <SidebarEmpregos
              empregos={empregos}
              selecionado={empregoSelecionado}
              setSelecionado={(e) => { setEmpregoSelecionado(e); if (!e) setSheetState('half'); else if (isMobile) setSheetState('full') }}
              onPublicar={() => user ? setFormEmprego({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(e) => setFormEmprego({ aberto: true, editando: e })}
              onExcluir={excluirEmprego}
              onEncerrar={encerrarEmprego}
              aoExigirLogin={() => setModalAuth(true)}
              isMobile={isMobile}
              aoIniciarArraste={aoIniciarArraste}
              aoArrastar={aoArrastar}
              aoSoltarArraste={aoSoltarArraste}
              onCentralizar={centralizarNoMapa}
            />
          ) : camada === 'imoveis' ? (
            /* ── CAMADA: IMÓVEIS ── */
            <SidebarImoveis
              imoveis={imoveis}
              filtro={filtroImovel}
              setFiltro={setFiltroImovel}
              selecionado={imovelSelecionado}
              setSelecionado={(i) => { setImovelSelecionado(i); if (!i) setSheetState('half'); else if (isMobile) setSheetState('full') }}
              onRegistrar={() => user ? setFormImovel({ aberto: true, editando: null }) : setModalAuth(true)}
              onEditar={(i) => setFormImovel({ aberto: true, editando: i })}
              onExcluir={excluirImovel}
              onMarcarVendidoAlugado={marcarImovelVendidoAlugado}
              onFoto={setFotoAmpliada}
              aoExigirLogin={() => setModalAuth(true)}
              isMobile={isMobile}
              aoIniciarArraste={aoIniciarArraste}
              aoArrastar={aoArrastar}
              aoSoltarArraste={aoSoltarArraste}
              onCentralizar={centralizarNoMapa}
            />
          ) : demandaSelecionada ? (
            /* ── DETALHE DA DEMANDA ── */
            <div key={demandaSelecionada.id} className="demanda-detalhe-anim" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Voltar */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #f9fafb', flexShrink: 0 }}>
                <button
                  onClick={() => { setDemandaSelecionada(null); setSheetState('half') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ← Voltar
                </button>
              </div>

              {/* Conteúdo */}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* Badge de status — padrão unificado (pedido do usuário):
                    badge → protocolo → foto → resto → respostas → ações,
                    igual nas outras 3 camadas agora. */}
                <div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
                    background: statusCor[demandaSelecionada.status]?.bg || '#f9fafb',
                    color: statusCor[demandaSelecionada.status]?.color || '#6b7280',
                  }}>
                    {statusLabel[demandaSelecionada.status] || demandaSelecionada.status}
                  </span>
                </div>

                {/* Protocolo — linha própria, não mais dentro do badge */}
                {demandaSelecionada.protocolo && (
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                    Protocolo: <strong style={{ color: '#111827' }}>{demandaSelecionada.protocolo}</strong>
                  </p>
                )}

                {/* Foto — saiu de dentro da caixa cinza (ficava escondida
                    quase no fim) pra cá, logo depois do protocolo. */}
                {demandaSelecionada.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={demandaSelecionada.foto_url}
                    alt="Foto da demanda"
                    onClick={() => setFotoAmpliada(demandaSelecionada.foto_url!)}
                    style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '7px', cursor: 'zoom-in', display: 'block' }}
                  />
                )}

                {/* Caixa principal — pares label/valor empilhados */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Demanda</p>
                    <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>{sentenceCase(demandaSelecionada.descricao)}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Categoria</p>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>{demandaSelecionada.categoria?.nome || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Nome</p>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>{titleCase(demandaSelecionada.morador_nome)}</p>
                    </div>
                  </div>

                  {demandaSelecionada.endereco_label && (
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Endereço</p>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>{titleCase(demandaSelecionada.endereco_label)}</p>
                    </div>
                  )}

                  {/* BUG CORRIGIDO (pedido do usuário): mostrava só
                      `demandaSelecionada.entidade` — a coluna legada de
                      autoridade única, sempre a primeira escolhida. Uma
                      demanda pode ter até 3 autoridades vinculadas
                      (demanda_entidades) e as outras duas nunca apareciam
                      aqui. Agora lista todo mundo de `vinculosDemanda`. */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }}>Direcionada para</p>
                    <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.4 }}>
                      {vinculosDemanda.length > 0
                        ? vinculosDemanda.map((v, i) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const ent = v.entidade as any
                            return (
                              <span key={v.id}>
                                {i > 0 && ', '}
                                {titleCase(ent?.nome)}
                                {ent?.cargo && <span style={{ color: '#6b7280' }}> ({titleCase(ent.cargo)})</span>}
                              </span>
                            )
                          })
                        : '—'}
                    </p>
                  </div>

                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                    Criada em {new Date(demandaSelecionada.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Respostas das autoridades — BUG CORRIGIDO (pedido do
                    usuário): status + nome + cargo iam tudo numa linha só,
                    sem quebra — com nome/cargo compridos, o card ficava
                    torto e diferente de autoridade pra autoridade. Agora
                    nome (com cargo embaixo) fica numa coluna que pode
                    quebrar linha à vontade, e o badge de status fica fixo
                    à direita (`flexShrink:0`), sem nunca espremer. */}
                {vinculosDemanda.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Respostas das autoridades</p>
                    {vinculosDemanda.map(v => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const ent = v.entidade as any
                      return (
                        <div key={v.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.35 }}>{ent?.nome}</p>
                              {ent?.cargo && <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', lineHeight: 1.35 }}>{ent.cargo}</p>}
                            </div>
                            <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 600, color: v.status === 'respondida' ? '#166534' : '#92400e' }}>
                              {v.status === 'respondida' ? 'Respondida' : 'Pendente'}
                            </span>
                          </div>
                          {v.resposta ? (
                            <p style={{ margin: 0, fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>{v.resposta}</p>
                          ) : (
                            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Aguardando resposta...</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                {/* BUG CORRIGIDO (código morto): fallback legado de "resposta
                    única" — o caminho legado (demanda sem demanda_entidades)
                    foi removido do sistema em 2026-08-30 (SISTEMA.md §12);
                    nenhuma demanda nova preenche demandas.resposta. */}

                {/* Ações do próprio usuário */}
                {user && demandaSelecionada.user_id === user.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['aguardando_resposta', 'respondida', 'nao_resolvida'].includes(demandaSelecionada.status) && (
                      <button
                        onClick={async () => {
                          if (!confirm('Marcar esta demanda como resolvida?')) return
                          const { data: { session } } = await supabase.auth.getSession()
                          const res = await fetch('/api/cidadao/marcar-resolvida', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                            body: JSON.stringify({ demanda_id: demandaSelecionada.id }),
                          })
                          if (!res.ok) return
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
                        setSheetState('half')
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
              {/* Topo: título + descrição + filtros — dono do arrasto
                  (mobile) pra redimensionar o sheet; sem scroll próprio. */}
              <div
                onTouchStart={isMobile ? aoIniciarArraste : undefined}
                onTouchMove={isMobile ? aoArrastar : undefined}
                onTouchEnd={isMobile ? aoSoltarArraste : undefined}
                style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '8px 14px 8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Demandas Municipais</h2>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Demandas dos cidadãos de Frutal-MG direcionadas às autoridades públicas.
                </p>

                {/* Botão registrar */}
                {user ? (
                  <button
                    onClick={() => setFormDemandaAberto(true)}
                    style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' }}>
                    Registrar Demanda
                  </button>
                ) : (
                  <button
                    onClick={() => setModalAuth(true)}
                    style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' }}>
                    Entrar para registrar
                  </button>
                )}

                {/* Filtro de categoria */}
                {categorias.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
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

              {/* Contador */}
              <div
                onTouchStart={isMobile ? aoIniciarArraste : undefined}
                onTouchMove={isMobile ? aoArrastar : undefined}
                onTouchEnd={isMobile ? aoSoltarArraste : undefined}
                style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '6px 14px', borderTop: '1px solid #f9fafb' }}>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{demandasVisiveis.length} demanda{demandasVisiveis.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Lista de cards resumidos — scroll de dedo normal, clicar
                  abre o mesmo card de detalhe completo do clique no pin. */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 14px 12px' }}>
                {demandasVisiveis.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      // BUG CORRIGIDO (pedido do usuário): o card da lista
                      // não checava login — dava pra contornar a trava do
                      // pin de demanda (que já era gated) simplesmente
                      // clicando na lista lateral em vez do pin.
                      if (!user) { setModalAuth(true); return }
                      setDemandaSelecionada(d)
                      if (isMobile) setSheetState('full')
                      else centralizarNoMapa(d.lat, d.lng)
                    }}
                    style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827' }}>
                        {d.categoria?.nome || 'Sem categoria'}
                      </span>
                      <span style={{
                        fontSize: '10.5px', fontWeight: 700, borderRadius: '20px', padding: '2px 8px', flexShrink: 0,
                        background: statusCor[d.status]?.bg || '#f9fafb',
                        color: statusCor[d.status]?.color || '#6b7280',
                      }}>
                        {statusLabel[d.status] || d.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {sentenceCase(d.descricao)}
                    </p>
                    {d.endereco_label && <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{titleCase(d.endereco_label)}</p>}
                  </div>
                ))}
              </div>

            </>
          )}
          </div>{/* fecha wrapper de conteúdo (rolável só quando há detalhe selecionado — ver comentário acima) */}
          </div>{/* fecha wrapper com fade */}
        </div>

        {/* MAPA */}
        <div style={isMobile ? { position: 'absolute', inset: 0 } : { flex: 1, position: 'relative', minWidth: 0 }}>
          <div ref={mapRef} className="mapa-map-div" style={{ width: '100%', height: '100%', minHeight: 'clamp(300px, 55vw, 500px)' }} />

          {/* Barra flutuante (chips de camada + conta) — substitui a Navbar
              nesta página, que agora ocupa a tela inteira. */}
          <MapaTopBar camada={camada} isMobile={isMobile} onAbrirLogin={() => setModalAuth(true)} />

          {/* Banner de login */}
          {!user && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(15,36,64,0.92), transparent)', padding: 'clamp(24px,5vw,40px) clamp(12px,4vw,24px) 20px', zIndex: 1000, textAlign: 'center' }}>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '14px', margin: '0 0 10px' }}>
                {{
                  todos: 'Faça login para ver o conteúdo completo dos pins',
                  demandas: 'Faça login para ver as demandas completas',
                  pets: 'Faça login para ver os registros completos',
                  classificados: 'Faça login para ver os anúncios completos',
                  empregos: 'Faça login para ver as vagas completas',
                  imoveis: 'Faça login para ver os anúncios completos',
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
          // BUG CORRIGIDO: salvar uma edição (aberta a partir do card de
          // detalhe, ou seja, com sheetState='full') desselecionava sem
          // tocar no sheet — ficava travado no "full" sem alcinha pra
          // sair. Só mexe no sheet quando de fato estava em "full" (não
          // afeta o fluxo normal de criar um registro novo, que abre o
          // formulário a partir do "peek"/"half").
          aoSalvar={() => { recarregarPets(); setPetSelecionado(null); if (isMobile && sheetState === 'full') setSheetState('half') }}
        />
      )}

      {/* Formulário de classificado (criar / editar) */}
      {formClassificado.aberto && (
        <FormularioClassificado
          editando={formClassificado.editando}
          aoFechar={() => setFormClassificado({ aberto: false, editando: null })}
          aoSalvar={() => { recarregarClassificados(); setClassificadoSelecionado(null); if (isMobile && sheetState === 'full') setSheetState('half') }}
        />
      )}

      {/* Formulário de vaga (criar / editar) */}
      {formEmprego.aberto && (
        <FormularioEmprego
          editando={formEmprego.editando}
          aoFechar={() => setFormEmprego({ aberto: false, editando: null })}
          aoSalvar={() => { recarregarEmpregos(); setEmpregoSelecionado(null); if (isMobile && sheetState === 'full') setSheetState('half') }}
        />
      )}

      {/* Formulário de imóvel (criar / editar) */}
      {formImovel.aberto && (
        <FormularioImovel
          editando={formImovel.editando}
          aoFechar={() => setFormImovel({ aberto: false, editando: null })}
          aoSalvar={() => { recarregarImoveis(); setImovelSelecionado(null); if (isMobile && sheetState === 'full') setSheetState('half') }}
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
        @keyframes sheet-chevron-bounce-down {
          0%, 100% { transform: rotate(180deg) translateY(0); opacity: 0.6; }
          50% { transform: rotate(180deg) translateY(-4px); opacity: 1; }
        }
        .sheet-chevron-up { animation: sheet-chevron-bounce 1.6s ease-in-out infinite; }
        .sheet-chevron-down { animation: sheet-chevron-bounce-down 1.6s ease-in-out infinite; }
      `}</style>

    </div>
  )
}

