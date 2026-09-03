'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import { Pet, EspeciePet, PortePet, CamadaConfig } from '@/types'
import { escapeHtml } from '@/lib/escapeHtml'
import { linkWhatsapp } from '@/lib/mascaraTelefone'
// Só o tipo — o maplibre-gl em si continua carregado dinamicamente por
// useMapaBase (import type é apagado na compilação, não força o bundle).
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'

/* ------------------------------------------------------------- ícones --- */

/** Silhuetas usadas no miolo do pin e nos seletores do formulário. */
const PATH_CACHORRO = 'M4.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm15 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm7 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.5 4c-2.8 0-5 2.5-5 5.2 0 1.6 1.1 2.8 2.6 2.8.9 0 1.6-.4 2.4-.4s1.5.4 2.4.4c1.5 0 2.6-1.2 2.6-2.8C17 13.5 14.8 11 12 11Z'
const PATH_GATO = 'M5 18V9l4-5h6l4 5v9M9 4l-1 3m7-3 1 3M9 13h.01M15 13h.01M10 16c.5.6 1 1 2 1s1.5-.4 2-1'

export function IconeEspecie({ especie, size = 18, cor = 'currentColor' }: { especie: EspeciePet; size?: number; cor?: string }) {
  if (especie === 'gato') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={PATH_GATO} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={cor} aria-hidden="true">
      <path d={PATH_CACHORRO} />
    </svg>
  )
}

/** Mesma silhueta, como string, para o HTML do pin no mapa — ou o ícone que
 * o master enviou pra essa situação (perdido/achado/adoção/reencontrado),
 * se houver, no mesmo padrão de `svgPinVeiculo` em CamadaClassificados. */
function svgPinEspecie(especie: EspeciePet, cor: string, iconeUrl?: string) {
  if (iconeUrl) {
    return `<img src="${escapeHtml(iconeUrl)}" alt="" style="width:19px;height:19px;object-fit:contain;" />`
  }
  if (especie === 'gato') {
    return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${PATH_GATO}"/></svg>`
  }
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="${cor}"><path d="${PATH_CACHORRO}"/></svg>`
}

/* ------------------------------------------------------------ helpers --- */

/** Chave de agrupamento (situação) — usada só pro filtro da barra lateral,
 * que continua agrupando por situação, sem separar espécie. */
export function chaveCorPet(p: Pet): string {
  if (p.reencontrado) return 'pet_reencontrado'
  if (p.tipo === 'perdido') return 'pet_perdido'
  if (p.tipo === 'adocao') return 'pet_adocao'
  return 'pet_achado'
}

// BUG CORRIGIDO (pedido do usuário): "Reencontrados" não é uma situação como
// as outras — é um pet que já foi encontrado, então não faz sentido ele
// aparecer misturado no filtro "Todos" (mapa e lista). Só aparece quando o
// filtro "Reencontrados" é selecionado explicitamente.
export function visivelNoFiltro(p: Pet, filtro: string): boolean {
  const chave = chaveCorPet(p)
  if (filtro) return chave === filtro
  return chave !== 'pet_reencontrado'
}

/** Chave de configuração de verdade (situação + espécie) — é essa que
 * indexa cor e ícone em `camadas_config`, pra cachorro e gato poderem ter
 * cor/ícone independentes dentro da mesma situação (ex: "Perdido" tem uma
 * config pra cachorro e outra pra gato). */
export function chaveConfigPet(p: Pet): string {
  return `${chaveCorPet(p)}_${p.especie}`
}

const COR_PADRAO: Record<string, string> = {
  pet_perdido_cachorro: '#dc2626',
  pet_perdido_gato: '#dc2626',
  pet_achado_cachorro: '#16a34a',
  pet_achado_gato: '#16a34a',
  pet_adocao_cachorro: '#7c3aed',
  pet_adocao_gato: '#7c3aed',
  pet_reencontrado_cachorro: '#2563eb',
  pet_reencontrado_gato: '#2563eb',
}

const ROTULO_FILTRO: Record<string, string> = {
  pet_perdido: 'Perdidos',
  pet_achado: 'Abandonados',
  pet_adocao: 'Adoção',
  pet_reencontrado: 'Reencontrados',
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Endereço é nome próprio (nome de rua/bairro) — cada palavra com inicial
// maiúscula, não só a primeira. Evita `\w`/`\b` (ASCII-only, quebra em
// acento) — mesmo cuidado documentado em MapaDemandas.tsx/titleCase.
function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().split(' ').map((w) => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

/* ================================================================= dados = */

export function usePets() {
  const supabase = createClient()
  const [pets, setPets] = useState<Pet[]>([])
  const [cores, setCores] = useState<Record<string, string>>(COR_PADRAO)
  const [icones, setIcones] = useState<Record<string, string>>({})

  async function recarregar() {
    const { data } = await supabase
      .from('pets')
      .select('*')
      .eq('oculto', false)
      .eq('ia_decisao', 'aprovada')
      .gt('expira_em', new Date().toISOString())
      .order('created_at', { ascending: false })
    setPets((data || []) as Pet[])
  }

  useEffect(() => {
    supabase
      .from('pets')
      .select('*')
      .eq('oculto', false)
      .eq('ia_decisao', 'aprovada')
      .gt('expira_em', new Date().toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => setPets((data || []) as Pet[]))
    supabase.from('camadas_config').select('*').eq('camada', 'pets').then(({ data }) => {
      if (!data) return
      const mapaCores = { ...COR_PADRAO }
      const mapaIcones: Record<string, string> = {}
      for (const c of data as CamadaConfig[]) {
        mapaCores[c.chave] = c.cor
        if (c.icone_url) mapaIcones[c.chave] = c.icone_url
      }
      setCores(mapaCores)
      setIcones(mapaIcones)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // BUG CORRIGIDO (B10-4): `expira_em` só era conferido no momento da
  // consulta ao banco — numa aba deixada aberta por horas, um pet que
  // expirasse nesse meio tempo continuava no mapa até um recarregamento
  // (F5) ou uma ação que chamasse `recarregar()`. Reconfere a cada minuto,
  // no cliente, sem bater no banco de novo — só remove do estado local o
  // que já expirou.
  useEffect(() => {
    const intervalo = setInterval(() => {
      const agora = new Date().toISOString()
      setPets(prev => prev.filter(p => p.expira_em > agora))
    }, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  return { pets, cores, icones, recarregar }
}

/* =============================================================== markers = */

export function useMarkersPets({
  ativo, pets, cores, icones, filtro, mapaObj, maplibreObj, mapaCarregado, aoSelecionar,
  logado, aoExigirLogin,
}: {
  ativo: boolean
  pets: Pet[]
  cores: Record<string, string>
  icones: Record<string, string>
  filtro: string
  mapaObj: React.MutableRefObject<MapLibreMap | null>
  maplibreObj: React.MutableRefObject<typeof import('maplibre-gl') | null>
  mapaCarregado: boolean
  aoSelecionar: (p: Pet) => void
  // BUG CORRIGIDO (pedido do usuário): pin de pet abria o popup direto,
  // sem checar login — só o pin de Demanda tinha essa trava. Mesmo padrão
  // agora nas 4 camadas: sem login, o clique no pin abre o modal de
  // entrar em vez do popup.
  logado: boolean
  aoExigirLogin: () => void
}) {
  const markersRef = useRef<Marker[]>([])
  const popupAbertoRef = useRef<Popup | null>(null)

  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !maplibreObj.current) return
    const maplibregl = maplibreObj.current
    const mapa = mapaObj.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (!ativo) return

    const visiveis = pets.filter(p => visivelNoFiltro(p, filtro))
    const porId = new Map(visiveis.map(p => [p.id, p]))

    visiveis.forEach((p) => {
      const cor = cores[chaveConfigPet(p)] || '#4256c8'
      // Por decisão explícita: pin de pet NUNCA mostra a foto do registro —
      // só o ícone configurado pelo master (com fallback pra silhueta
      // padrão). A foto continua aparecendo no popup, ao clicar.
      const miolo = svgPinEspecie(p.especie, '#ffffff', icones[chaveConfigPet(p)])

      const el = document.createElement('div')
      el.className = 'pin-pet'
      el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,.35))'
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;background:${cor};display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${miolo}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
      </div>`

      const titulo = p.reencontrado
        ? 'Reencontrado'
        : p.tipo === 'perdido' ? 'Perdi meu Pet'
        : p.tipo === 'adocao' ? 'Adotar um Pet'
        : 'Achei um Pet'

      const popup = new maplibregl.Popup({ maxWidth: '260px', closeButton: true }).setHTML(`
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          ${p.foto_url ? `<img src="${escapeHtml(p.foto_url)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />` : ''}
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.03em;">${titulo}</p>
          ${p.nome_pet ? `<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(sentenceCase(p.nome_pet))}</p>` : ''}
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${escapeHtml(titleCase(p.endereco_label))}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#111827;line-height:1.4;">${escapeHtml(sentenceCase(p.descricao))}</p>
          <button class="ver-pet-btn" data-ver-pet="${p.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver detalhes
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `)
      popup.on('open', () => { popupAbertoRef.current = popup })
      popup.on('close', () => { if (popupAbertoRef.current === popup) popupAbertoRef.current = null })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.lng, p.lat])
        .addTo(mapa)
      // Acessibilidade (PageSpeed Insights) — precisa vir DEPOIS de criar o
      // Marker: o construtor do MapLibre sobrescreve `aria-label` com um
      // valor genérico ("Map marker") se setado antes.
      el.setAttribute('aria-label', `Ver pet: ${titulo}`)

      // Sem `.setPopup()` de propósito — o clique é interceptado à mão
      // pra checar login antes (mesmo padrão de MapaDemandas.tsx).
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (!logado) { aoExigirLogin(); return }
        popup.setLngLat([p.lng, p.lat]).addTo(mapa)
      })

      markersRef.current.push(marker)
    })

    const container = mapa.getContainer()
    function aoClicar(e: MouseEvent) {
      const alvo = (e.target as HTMLElement).closest('.ver-pet-btn') as HTMLElement | null
      if (!alvo) return
      const pet = porId.get(alvo.getAttribute('data-ver-pet') || '')
      if (!pet) return
      popupAbertoRef.current?.remove()
      aoSelecionar(pet)
    }
    container.addEventListener('click', aoClicar)

    // Efeito radar: só perdido/achado (não adoção, não já reencontrado) —
    // um anel geográfico de verdade (polígono com coordenadas reais, não um
    // círculo "de tela"), pra ele deitar e acompanhar a perspectiva quando
    // o mapa inclina/gira, igual qualquer outra geometria do mapa. Um
    // círculo comum do MapLibre (camada 'circle') NÃO faz isso — o raio
    // dele é sempre em pixels de tela, sempre "de pé" pra câmera, então
    // precisa ser desenhado como polígono em vez disso.
    let animId: number | null = null
    if (mapaCarregado) {
      const comRadar = visiveis.filter((p) => !p.reencontrado && (p.tipo === 'perdido' || p.tipo === 'achado'))

      if (comRadar.length > 0) {
        const CICLO_MS = 2200
        const RAIO_MIN_M = 150
        const RAIO_MAX_M = 600
        // Desfasagem por pet (baseada no id) — evita todos pulsando em
        // uníssono, fica com cara mais orgânica de radar de verdade.
        const faseInicial = new Map(comRadar.map((p) => [p.id, [...p.id].reduce((s, c) => s + c.charCodeAt(0), 0) % CICLO_MS]))

        // 32 pontos em vez de 48 — corta um quarto do trabalho de recriar o
        // polígono a cada quadro, sem diferença visível num anel desse
        // tamanho na tela.
        function circuloGeoJSON(lat: number, lng: number, raioMetros: number, pontos = 32): [number, number][] {
          const coords: [number, number][] = []
          const distRad = raioMetros / 6371000
          const latRad = (lat * Math.PI) / 180
          for (let i = 0; i <= pontos; i++) {
            const angulo = (i / pontos) * 2 * Math.PI
            const dLat = distRad * Math.cos(angulo)
            const dLng = (distRad * Math.sin(angulo)) / Math.cos(latRad)
            coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI])
          }
          return coords
        }

        function construirFeatures() {
          const agora = performance.now()
          return comRadar.map((p) => {
            const fase = ((agora + (faseInicial.get(p.id) || 0)) % CICLO_MS) / CICLO_MS
            const raio = RAIO_MIN_M + (RAIO_MAX_M - RAIO_MIN_M) * fase
            return {
              type: 'Feature' as const,
              properties: { cor: cores[chaveConfigPet(p)] || '#4256c8', opacidade: 1 - fase },
              geometry: { type: 'Polygon' as const, coordinates: [circuloGeoJSON(p.lat, p.lng, raio)] },
            }
          })
        }

        if (!mapa.getSource('radar-pets')) {
          mapa.addSource('radar-pets', { type: 'geojson', data: { type: 'FeatureCollection', features: construirFeatures() } })
          // Halo branco por baixo da linha colorida — sem isso, o anel some
          // visualmente sempre que a cor configurada no master é parecida
          // com o fundo do satélite embaixo dele (grama, telhado, terra...).
          // Mesma técnica já usada no halo do texto dos nomes de rua do
          // mapa: uma linha mais grossa e neutra por baixo garante contraste
          // em cima de qualquer fundo.
          mapa.addLayer({
            id: 'radar-pets-halo',
            type: 'line',
            source: 'radar-pets',
            paint: {
              'line-color': '#ffffff',
              'line-width': 7,
              'line-opacity': ['*', ['get', 'opacidade'], 0.7],
            },
          })
          mapa.addLayer({
            id: 'radar-pets-linha',
            type: 'line',
            source: 'radar-pets',
            paint: {
              'line-color': ['get', 'cor'],
              'line-width': 5,
              'line-opacity': ['get', 'opacidade'],
            },
          })
        }

        // Atualiza no máximo ~15x/s — suave o bastante pro pulso (ciclo de
        // 2.2s, não precisa de mais que isso), sem pesar no mapa 3D já
        // carregado. Também não empilha requestAnimationFrame durante a
        // pausa entre atualizações — só agenda o próximo quando realmente
        // vai atualizar, em vez de rodar a 60fps só checando o relógio.
        //
        // PAUSA DURANTE MOVIMENTO (2026-08-31): sem isso, o radar continuava
        // chamando setData() a cada 65ms mesmo bem no meio de uma animação
        // de zoom/inclinação — nesse momento o mapa já está ocupado
        // processando a própria transição, e as atualizações do radar
        // competiam pelo mesmo pipeline. Se elas chegassem mais rápido do
        // que o mapa conseguia absorver durante esse pico, empilhavam numa
        // fila que só crescia, e o mapa nunca mais alcançava — travava de
        // vez (zoom parava de responder, e a própria animação do radar
        // parecia travada junto, já que o quadro nunca mais era repintado).
        // mapa.isMoving() cobre pan, zoom, rotação e inclinação — qualquer
        // um em andamento pausa a atualização até o próximo 'idle'.
        //
        // CORREÇÃO DE PERFORMANCE (PageSpeed Insights — TBT de ~19s no /mapa,
        // achado depois do revert de 2026-09-03): 65ms era mais frequente do
        // que o pulso (ciclo de 2.2s) precisa pra parecer suave — 100ms já
        // basta e reduz o trabalho de thread principal em ~35%. Também pausa
        // quando a aba está em segundo plano (`document.hidden`): sem isso,
        // o loop de setTimeout continuava recriando o polígono do radar a
        // cada ciclo mesmo com a aba escondida, sem nenhum efeito visível
        // pra ninguém — trabalho puro jogado fora.
        const INTERVALO_MS = 100
        function agendar() {
          animId = window.setTimeout(() => {
            try {
              if (!document.hidden && !mapa.isMoving()) {
                const fonte = mapa.getSource('radar-pets') as import('maplibre-gl').GeoJSONSource | undefined
                fonte?.setData({ type: 'FeatureCollection', features: construirFeatures() })
              }
            } catch (erro) {
              // Nunca deixa uma exceção aqui matar o loop de animação em
              // silêncio pra sempre — loga e tenta de novo no próximo ciclo.
              console.error('[radar-pets] erro ao atualizar anel:', erro)
            }
            agendar()
          }, INTERVALO_MS)
        }
        agendar()
      }
    }

    return () => {
      container.removeEventListener('click', aoClicar)
      if (animId !== null) window.clearTimeout(animId)
      if (mapa.getLayer('radar-pets-linha')) mapa.removeLayer('radar-pets-linha')
      if (mapa.getLayer('radar-pets-halo')) mapa.removeLayer('radar-pets-halo')
      if (mapa.getSource('radar-pets')) mapa.removeSource('radar-pets')
    }
  }, [ativo, pets, cores, icones, filtro, mapaCarregado, logado]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* =============================================================== sidebar = */

export const rotuloEspecie: Record<EspeciePet, string> = { cachorro: 'Cachorro', gato: 'Gato' }
export const rotuloPorte: Record<PortePet, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' }

export function SidebarPets({
  pets, cores, filtro, setFiltro, selecionado, setSelecionado,
  onRegistrar, onEditar, onExcluir, onMarcarReencontrado, onFoto, aoExigirLogin,
  isMobile, aoIniciarArraste, aoArrastar, aoSoltarArraste, onCentralizar,
}: {
  pets: Pet[]
  cores: Record<string, string>
  filtro: string
  setFiltro: (f: string) => void
  selecionado: Pet | null
  setSelecionado: (p: Pet | null) => void
  onRegistrar: () => void
  onEditar: (p: Pet) => void
  onExcluir: (p: Pet) => void
  onMarcarReencontrado: (p: Pet) => void
  onFoto: (url: string) => void
  // BUG CORRIGIDO (pedido do usuário): clicar num card da lista abria o
  // registro completo sem checar login — só o pin no mapa tinha essa
  // trava. Abre o modal de entrar em vez de expandir, igual ao pin.
  aoExigirLogin: () => void
  // Lista de cards resumidos abaixo do filtro — arrastar (mobile) só
  // funciona do cabeçalho (até o filtro) pra cima; a lista tem scroll de
  // dedo normal, por isso esses handlers de arraste não vão nela.
  isMobile: boolean
  aoIniciarArraste: (e: React.TouchEvent) => void
  aoArrastar: (e: React.TouchEvent) => void
  aoSoltarArraste: () => void
  // Clicar num card da lista centraliza o mapa nele — só faz sentido no
  // desktop (mobile expande o sheet pro card completo, não tem por que
  // mexer no mapa por baixo).
  onCentralizar: (lat: number, lng: number) => void
}) {
  const { user, perfil } = useAuth()
  const visiveis = pets.filter(p => visivelNoFiltro(p, filtro))

  if (selecionado) {
    const cor = cores[chaveConfigPet(selecionado)] || '#4256c8'
    const meu = user?.id === selecionado.user_id
    const ehMaster = perfil?.role === 'master'
    const titulo = selecionado.reencontrado
      ? 'Reencontrado'
      : selecionado.tipo === 'perdido' ? 'Perdi meu Pet'
      : selecionado.tipo === 'adocao' ? 'Adotar um Pet'
      : 'Achei um Pet'

    return (
      <div key={selecionado.id} className="demanda-detalhe-anim" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f9fafb', flexShrink: 0 }}>
          <button onClick={() => setSelecionado(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Voltar
          </button>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: cor }}>
              <IconeEspecie especie={selecionado.especie} size={13} cor={cor} />
              {titulo}
            </span>
          </div>

          {/* Protocolo — padrão unificado (pedido do usuário) entre badge e
              foto, igual nas outras camadas agora. Campo novo aqui: nunca
              era exibido antes, só existia no banco. */}
          {selecionado.protocolo && (
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
              Protocolo: <strong style={{ color: '#111827' }}>{selecionado.protocolo}</strong>
            </p>
          )}

          {selecionado.foto_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={selecionado.foto_url} alt={selecionado.nome_pet || 'Foto do Pet'}
              onClick={() => onFoto(selecionado.foto_url!)}
              style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '7px', cursor: 'zoom-in', display: 'block' }} />
          )}

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selecionado.nome_pet && (
              <div>
                <p style={rotuloEstilo}>Nome</p>
                <p style={valorEstilo}>{sentenceCase(selecionado.nome_pet)}</p>
              </div>
            )}
            <div>
              <p style={rotuloEstilo}>Descrição</p>
              <p style={valorEstilo}>{sentenceCase(selecionado.descricao)}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <p style={rotuloEstilo}>Espécie</p>
                <p style={valorEstilo}>{rotuloEspecie[selecionado.especie]}</p>
              </div>
              {selecionado.porte && (
                <div>
                  <p style={rotuloEstilo}>Porte</p>
                  <p style={valorEstilo}>{rotuloPorte[selecionado.porte]}</p>
                </div>
              )}
              {selecionado.raca && (
                <div>
                  <p style={rotuloEstilo}>Raça</p>
                  <p style={valorEstilo}>{sentenceCase(selecionado.raca)}</p>
                </div>
              )}
              {selecionado.cor && (
                <div>
                  <p style={rotuloEstilo}>Cor</p>
                  <p style={valorEstilo}>{sentenceCase(selecionado.cor)}</p>
                </div>
              )}
            </div>
            {selecionado.data_hora_aproximada && (
              <div>
                <p style={rotuloEstilo}>{selecionado.tipo === 'perdido' ? 'Quando sumiu' : 'Quando foi encontrado'}</p>
                <p style={valorEstilo}>{new Date(selecionado.data_hora_aproximada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            )}
            {selecionado.endereco_label && (
              <div>
                <p style={rotuloEstilo}>{selecionado.tipo === 'perdido' ? 'Sumiu perto de' : selecionado.tipo === 'adocao' ? 'Localização' : 'Encontrado em'}</p>
                <p style={valorEstilo}>{titleCase(selecionado.endereco_label)}</p>
              </div>
            )}
            <div>
              <p style={rotuloEstilo}>Contato</p>
              {/* BUG CORRIGIDO (pedido do usuário): contato era só texto —
                  vira link direto pro WhatsApp (wa.me). */}
              <a href={linkWhatsapp(selecionado.contato)} target="_blank" rel="noopener noreferrer" style={botaoWhatsapp}>
                <IconeWhatsapp />
                Chamar no WhatsApp
              </a>
            </div>
          </div>

          {/* BUG CORRIGIDO (B10-3, decisão confirmada com o usuário): o
              bloco inteiro de ações (inclusive "Editar") ficava atrás de
              `meu` — o master só conseguia editar os PRÓPRIOS pets, sem
              nenhum caminho (nem no mapa, nem no painel) pra corrigir o
              conteúdo de um pet de outro usuário. "Editar" agora aparece
              pro master em qualquer pet; "Excluir"/"Marcar reencontrado"
              continuam só pro dono (mesma rota exige `user_id === user.id`
              — exclusão/moderação de terceiros já tem seu próprio caminho
              no painel master). */}
          {(meu || ehMaster) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* BUG CORRIGIDO: aparecia também pra 'adocao', mas o banco só
                  permite reencontrado=true quando tipo='perdido'
                  (CHECK pets_reencontrado_so_perdido) — pro dono de um pet em
                  adoção, o botão clicava e nada acontecia, pra sempre, sem
                  nenhuma mensagem. */}
              {meu && selecionado.tipo === 'perdido' && !selecionado.reencontrado && (
                <button onClick={() => onMarcarReencontrado(selecionado)}
                  style={{ ...botaoAcao, color: '#166534', fontWeight: 600 }}>
                  Marcar como reencontrado
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: ehMaster && meu ? '1fr 1fr' : '1fr', gap: '6px' }}>
                {ehMaster && <button onClick={() => onEditar(selecionado)} style={{ ...botaoAcao, color: '#4256c8' }}>Editar</button>}
                {meu && <button onClick={() => onExcluir(selecionado)} style={{ ...botaoAcao, color: '#dc2626' }}>Excluir</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Cabeçalho — dono do arrasto (mobile) pra redimensionar o sheet;
          não tem scroll próprio, é sempre do tamanho do conteúdo. */}
      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '8px 14px 8px' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Área PET</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Pets para adoção, perdidos pelos donos e animais encontrados abandonados nas ruas.
        </p>

        <button onClick={onRegistrar}
          style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' }}>
          {user ? 'Registrar Pet' : 'Entrar para registrar'}
        </button>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Tipo</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box' }}>
          <option value=''>Todos</option>
          {(['pet_perdido', 'pet_achado', 'pet_adocao', 'pet_reencontrado'] as const).map(chave => (
            <option key={chave} value={chave}>{ROTULO_FILTRO[chave]}</option>
          ))}
        </select>
      </div>

      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '6px 14px', borderTop: '1px solid #f9fafb' }}
      >
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {visiveis.length} registro{visiveis.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista de cards resumidos — scroll de dedo normal (sem arrasto de
          sheet aqui), clicar abre o card completo (mesmo caminho do pin). */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 14px 12px' }}>
        {visiveis.map((p) => {
          const cor = cores[chaveConfigPet(p)] || '#4256c8'
          return (
            <div
              key={p.id}
              onClick={() => { if (!user) { aoExigirLogin(); return } setSelecionado(p); if (!isMobile) onCentralizar(p.lat, p.lng) }}
              style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827' }}>
                  {p.especie === 'cachorro' ? 'Cachorro' : 'Gato'}
                </span>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: cor, background: `${cor}18`, borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>
                  {ROTULO_FILTRO[chaveCorPet(p)]}
                </span>
              </div>
              {/* Linha 2 muda conforme a situação (pedido do usuário):
                  perdido/reencontrado mostra o nome; achado/adoção mostra
                  raça+cor, já que geralmente não se sabe o nome do pet. */}
              {(p.tipo === 'perdido' || p.reencontrado)
                ? (p.nome_pet && <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px', lineHeight: 1.4 }}>{sentenceCase(p.nome_pet)}</p>)
                : ((p.raca || p.cor) && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px', lineHeight: 1.4 }}>
                      {[p.raca, p.cor].filter(Boolean).map(v => sentenceCase(v)).join(', ')}
                    </p>
                  ))}
              {p.endereco_label && <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{titleCase(p.endereco_label)}</p>}
            </div>
          )
        })}
      </div>
    </>
  )
}

const rotuloEstilo: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }
const valorEstilo: React.CSSProperties = { fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }
const botaoAcao: React.CSSProperties = { fontSize: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 500, width: '100%' }

// Botão de contato via WhatsApp — mesmo ícone (traço, estilo feather) já
// usado no botão flutuante do assistente de IA (ChatBot.tsx), só que aqui
// preenchido, cor da marca do WhatsApp.
const botaoWhatsapp: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '2px', background: '#25d366', color: 'white', fontSize: '12.5px', fontWeight: 600, padding: '8px 14px', borderRadius: '20px', textDecoration: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }
function IconeWhatsapp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}



/* ============================================================ formulário = */

export { FormPet as FormularioPet } from './FormPet'
