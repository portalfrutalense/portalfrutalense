'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const TILE_SATELITE = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const TILE_RUA = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const FRUTAL_LAT = -20.0234
const FRUTAL_LNG = -48.9338
const ZOOM_CIDADE = 13
const ZOOM_ENCONTRADO = 17
const ZOOM_REVISAO = 19
const ZOOM_MIN_NECESSARIO = 1
const ARRASTE_MIN_NECESSARIO = 1

// Verifica se coordenadas estão dentro de ~15km de Frutal-MG
function dentroFrutal(lat: number, lng: number): boolean {
  const dlat = lat - FRUTAL_LAT
  const dlng = lng - FRUTAL_LNG
  return Math.sqrt(dlat * dlat + dlng * dlng) < 0.15
}

interface Props {
  enderecoInicial?: string
  onConfirmar: (endereco: string, lat: number, lng: number) => void
  onAlterar?: () => void
  altura?: number | string
}

type Fase = 'inicial' | 'ajuste' | 'revisao' | 'confirmado'

function aplicarTravamento(mapa: Leaflet.Map, travar: boolean) {
  if (travar) {
    mapa.dragging.disable()
    mapa.scrollWheelZoom.disable()
    mapa.doubleClickZoom.disable()
    mapa.touchZoom.disable()
    mapa.boxZoom.disable()
    mapa.keyboard.disable()
  } else {
    mapa.dragging.enable()
    mapa.scrollWheelZoom.enable()
    mapa.doubleClickZoom.enable()
    mapa.touchZoom.enable()
    mapa.boxZoom.enable()
    mapa.keyboard.enable()
  }
}

const botaoFlutuante: React.CSSProperties = {
  background: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)', color: '#111827',
}

export default function MiniMapaConfirmar({ enderecoInicial = '', onConfirmar, onAlterar, altura = 280 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaObj = useRef<Leaflet.Map | null>(null)
  const tileAtual = useRef<Leaflet.TileLayer | null>(null)
  const leafletObj = useRef<typeof Leaflet | null>(null)
  const zoomAnterior = useRef<number | null>(null)
  const zoomAntesRevisao = useRef<number | null>(null)
  const sateliteAntesRevisao = useRef(false)

  const [fase, setFase] = useState<Fase>(enderecoInicial.trim() ? 'ajuste' : 'inicial')
  const faseRef = useRef<Fase>(fase)
  const [satelite, setSatelite] = useState(false)
  const [endereco, setEndereco] = useState(enderecoInicial)
  const [buscando, setBuscando] = useState(false)
  const [obtendoGps, setObtendoGps] = useState(false)
  const [aviso, setAviso] = useState('')
  const [precisaAjustar, setPrecisaAjustar] = useState(false)
  const [zoomsFeitos, setZoomsFeitos] = useState(0)
  const [arrastesFeitos, setArrastesFeitos] = useState(0)
  const [textoAlterado, setTextoAlterado] = useState(false)
  const [coordConfirmada, setCoordConfirmada] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.setAttribute('data-leaflet-css', 'true')
      document.head.appendChild(link)
    }

    let mapa: Leaflet.Map | null = null

    import('leaflet').then((L) => {
      if (!mapRef.current) return
      // Se o container já tem _leaflet_id (cleanup assíncrono não terminou a tempo),
      // remove o mapa existente antes de criar um novo
      if ((mapRef.current as any)._leaflet_id != null) {
        try {
          const mapaExistente = mapaObj.current
          if (mapaExistente) { mapaExistente.remove() } else { delete (mapRef.current as any)._leaflet_id }
        } catch { delete (mapRef.current as any)._leaflet_id }
        mapaObj.current = null
      }
      mapa = L.map(mapRef.current, { zoomControl: false }).setView([FRUTAL_LAT, FRUTAL_LNG], ZOOM_CIDADE)
      const tile = L.tileLayer(TILE_RUA, { attribution: '© Mapbox © OpenStreetMap' })
      tile.addTo(mapa)
      tileAtual.current = tile
      mapaObj.current = mapa
      leafletObj.current = L
      zoomAnterior.current = mapa.getZoom()

      // Garante que o Leaflet recalcule o tamanho após a montagem no DOM
      // Múltiplos timeouts para cobrir animações do container pai (chatbot)
      setTimeout(() => mapa?.invalidateSize(), 50)
      setTimeout(() => mapa?.invalidateSize(), 200)
      setTimeout(() => mapa?.invalidateSize(), 500)

      // ResizeObserver: recalcula quando o container ganha dimensão real
      if (mapRef.current && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => mapa?.invalidateSize())
        ro.observe(mapRef.current)
        // Limpar no cleanup via variável local
        ;(mapa as any)._ro = ro
      }

      mapa.on('zoomend', () => {
        const novoZoom = mapa!.getZoom()
        if (zoomAnterior.current !== null && novoZoom > zoomAnterior.current) {
          setZoomsFeitos((z) => z + 1)
        }
        zoomAnterior.current = novoZoom
      })

      mapa.on('dragend', () => {
        setArrastesFeitos((a) => a + 1)
      })

      aplicarTravamento(mapa, faseRef.current !== 'ajuste')
    })

    return () => {
      if (mapa) {
        ;(mapa as any)._ro?.disconnect()
        mapa.remove()
        mapa = null
        mapaObj.current = null
        tileAtual.current = null
        leafletObj.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    faseRef.current = fase
    if (mapaObj.current) aplicarTravamento(mapaObj.current, fase !== 'ajuste')
  }, [fase])

  function alternarCamada() {
    if (!mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    if (tileAtual.current) tileAtual.current.remove()
    const novo = !satelite
    const t = novo
      ? L.tileLayer(TILE_SATELITE, { attribution: '© Mapbox' })
      : L.tileLayer(TILE_RUA, { attribution: '© Mapbox © OpenStreetMap' })
    t.addTo(mapaObj.current)
    tileAtual.current = t
    setSatelite(novo)
  }

  function marcarFalha() {
    setAviso('Não encontramos esse endereço automaticamente. Arraste e dê zoom no mapa até o local certo.')
    setPrecisaAjustar(true)
    setZoomsFeitos(0)
    setArrastesFeitos(0)
    if (mapaObj.current) zoomAnterior.current = mapaObj.current.getZoom()
  }

  function fecharAviso() {
    setAviso('')
    setFase('ajuste')
  }

  async function buscarEndereco() {
    if (!endereco.trim() || buscando) return
    setBuscando(true)
    setAviso('')
    setTextoAlterado(false)
    try {
      const q = encodeURIComponent(`${endereco.trim()}, Frutal, Minas Gerais`)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&country=BR&language=pt&limit=1&proximity=${FRUTAL_LNG},${FRUTAL_LAT}&types=address`
      const res = await fetch(url)
      const data = await res.json()
      const feature = data?.features?.[0]
      // Mapbox faz correspondência aproximada — só aceita se for um endereço de fato
      // (não uma cidade/bairro genérico), com relevância razoável, e realmente perto de Frutal
      // (evita aceitar uma rua de mesmo nome em outra cidade)
      if (feature && feature.relevance >= 0.85 && mapaObj.current) {
        const [lng, lat] = feature.center
        if (!dentroFrutal(lat, lng)) {
          marcarFalha()
          return
        }
        setPrecisaAjustar(false)
        mapaObj.current.setView([lat, lng], ZOOM_ENCONTRADO)
        setFase('ajuste')
      } else {
        marcarFalha()
      }
    } catch {
      marcarFalha()
    } finally {
      setBuscando(false)
    }
  }

  function usarLocalizacaoAtual() {
    if (!navigator.geolocation || !mapaObj.current) return
    setObtendoGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapaObj.current?.setView([pos.coords.latitude, pos.coords.longitude], ZOOM_ENCONTRADO)
        setPrecisaAjustar(false)
        setObtendoGps(false)
      },
      () => setObtendoGps(false),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const bloqueadoPorAjuste = precisaAjustar && (zoomsFeitos < ZOOM_MIN_NECESSARIO || arrastesFeitos < ARRASTE_MIN_NECESSARIO)
  const bloqueadoPorTexto = textoAlterado
  const naoPodeSelecionar = !endereco.trim() || bloqueadoPorTexto || bloqueadoPorAjuste

  function selecionar() {
    if (!mapaObj.current || naoPodeSelecionar) return
    zoomAntesRevisao.current = mapaObj.current.getZoom()
    sateliteAntesRevisao.current = satelite
    if (!satelite) alternarCamada()
    mapaObj.current.setZoom(ZOOM_REVISAO)
    setFase('revisao')
  }

  function voltarDaRevisao() {
    if (!mapaObj.current) return
    if (satelite !== sateliteAntesRevisao.current) alternarCamada()
    if (zoomAntesRevisao.current !== null) mapaObj.current.setZoom(zoomAntesRevisao.current)
    setFase('ajuste')
  }

  function confirmarFinal() {
    if (!mapaObj.current || !endereco.trim()) return
    const c = mapaObj.current.getCenter()
    setCoordConfirmada({ lat: c.lat, lng: c.lng })
    onConfirmar(endereco.trim(), c.lat, c.lng)
    setFase('confirmado')
  }

  function alterar() {
    if (!mapaObj.current) return
    if (satelite !== sateliteAntesRevisao.current) alternarCamada()
    if (zoomAntesRevisao.current !== null) mapaObj.current.setZoom(zoomAntesRevisao.current)
    setCoordConfirmada(null)
    setFase('ajuste')
    onAlterar?.()
  }

  return (
    <>
    <div style={{ position: 'relative', width: '100%', height: typeof altura === 'number' ? `${altura}px` : altura, borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          filter: fase === 'inicial' ? 'blur(3px)' : 'none',
          transition: 'filter 0.35s ease',
        }}
      />

      {/* Pino central fixo (some na tela inicial, antes de qualquer busca) */}
      {fase !== 'inicial' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 500, pointerEvents: 'none' }}>
          <svg width="28" height="35" viewBox="0 0 32 40" fill="none">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.4 23.04 15.04 23.573a1.333 1.333 0 001.92 0C17.6 39.04 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#4256c8" />
            <circle cx="16" cy="16" r="7" fill="white" />
          </svg>
        </div>
      )}

      {/* Barra de busca — centralizada na tela inicial, flutuante no topo na fase de ajuste, some na revisão/confirmado */}
      {(fase === 'inicial' || fase === 'ajuste') && (
        <div
          style={
            fase === 'inicial'
              ? { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, display: 'flex', alignItems: 'center', background: 'white', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', padding: '4px', width: '85%', maxWidth: '260px', transition: 'all 0.35s ease' }
              : { position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1000, display: 'flex', alignItems: 'center', background: 'white', borderRadius: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.25)', padding: '4px', transition: 'all 0.35s ease' }
          }
        >
          <input
            type="text"
            value={endereco}
            onChange={(e) => { setEndereco(e.target.value); setTextoAlterado(true) }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarEndereco())}
            placeholder="Digite o endereço"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '6px 10px', fontSize: '13px' }}
          />
          <button type="button" onClick={buscarEndereco} disabled={buscando || !endereco.trim()}
            title="Buscar"
            style={{ ...botaoFlutuante, width: '30px', height: '30px', borderRadius: '50%', background: endereco.trim() ? '#4256c8' : '#e5e7eb', cursor: buscando ? 'wait' : endereco.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
            {buscando ? (
              <span style={{ fontSize: '11px', color: endereco.trim() ? 'white' : '#9ca3af' }}>...</span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={endereco.trim() ? 'white' : '#9ca3af'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Aviso: mapa esmaece com blur, texto vermelho centralizado, botão OK */}
      {aviso && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2000, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '10px', padding: '16px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', maxWidth: '260px', textAlign: 'center' }}>
            <p style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, margin: 0, marginBottom: '12px', lineHeight: 1.4 }}>
              {aviso}
            </p>
            <button type="button" onClick={fecharAviso}
              style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '16px', padding: '6px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </div>
      )}

      {fase === 'ajuste' && (
        <>
          {/* Zoom + Satélite, canto inferior esquerdo */}
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000, display: 'flex', gap: '4px' }}>
            <button type="button" onClick={() => mapaObj.current?.zoomOut()} title="Diminuir zoom"
              style={{ ...botaoFlutuante, width: '26px', height: '26px', fontSize: '15px', fontWeight: 700 }}>−</button>
            <button type="button" onClick={() => mapaObj.current?.zoomIn()} title="Aumentar zoom"
              style={{ ...botaoFlutuante, width: '26px', height: '26px', fontSize: '15px', fontWeight: 700 }}>+</button>
            <button type="button" onClick={alternarCamada} title="Alternar mapa/satélite"
              style={{ ...botaoFlutuante, height: '26px', padding: '0 8px', fontSize: '11px', fontWeight: 600 }}>
              {satelite ? '🗺' : '🛰'}
            </button>
          </div>

          {/* Localização atual, canto inferior direito */}
          <button type="button" onClick={usarLocalizacaoAtual} disabled={obtendoGps} title="Usar minha localização atual"
            style={{ ...botaoFlutuante, position: 'absolute', bottom: '10px', right: '10px', zIndex: 1000, width: '26px', height: '26px', fontSize: '13px', cursor: obtendoGps ? 'wait' : 'pointer' }}>
            {obtendoGps ? '...' : '📍'}
          </button>

          {/* Selecionar, centralizado embaixo */}
          <button type="button" onClick={selecionar} disabled={naoPodeSelecionar}
            title={bloqueadoPorTexto ? 'Aperte Buscar de novo depois de editar o endereço' : bloqueadoPorAjuste ? 'Ajuste o mapa até achar o local certo antes de selecionar' : undefined}
            style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: !naoPodeSelecionar ? '#4256c8' : '#9ca3af', color: 'white', border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: !naoPodeSelecionar ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', boxShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>
            {bloqueadoPorTexto ? 'Busque o endereço' : bloqueadoPorAjuste ? 'Ajuste o mapa' : 'Selecionar'}
          </button>
        </>
      )}

      {fase === 'confirmado' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', maxWidth: '85%', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
            Endereço confirmado
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#111827', fontWeight: 600, wordBreak: 'break-word' }}>
            {endereco.trim()}
          </p>
          {coordConfirmada && (
            <p style={{ margin: '0 0 10px', fontSize: '10px', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
              {coordConfirmada.lat.toFixed(6)}, {coordConfirmada.lng.toFixed(6)}
            </p>
          )}
          <button type="button" onClick={alterar}
            style={{ background: 'none', border: 'none', color: '#4256c8', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textDecoration: 'underline', padding: 0 }}>
            Alterar
          </button>
        </div>
      )}
    </div>

    {fase === 'revisao' && (
      <div style={{ background: 'white', borderRadius: '10px', padding: '10px 12px', boxShadow: '0 1px 8px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', textAlign: 'center', marginTop: '6px' }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#111827' }}>
          O local está correto?
        </p>
        <p style={{ margin: '4px 0 8px', fontSize: '11px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {endereco.trim()}
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button type="button" onClick={voltarDaRevisao}
            style={{ background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '16px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Voltar
          </button>
          <button type="button" onClick={confirmarFinal}
            style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '16px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Confirmar
          </button>
        </div>
      </div>
    )}
    </>
  )
}
