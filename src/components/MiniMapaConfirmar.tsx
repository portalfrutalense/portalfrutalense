'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const FRUTAL_LAT = -20.0234
const FRUTAL_LNG = -48.9338
const ZOOM_CIDADE = 13
const ZOOM_ENCONTRADO = 17

// Verifica se coordenadas estão dentro de ~15km de Frutal-MG
function dentroFrutal(lat: number, lng: number): boolean {
  const dlat = lat - FRUTAL_LAT
  const dlng = lng - FRUTAL_LNG
  return Math.sqrt(dlat * dlat + dlng * dlng) < 0.15
}

interface Props {
  enderecoInicial?: string
  onConfirmar: (endereco: string, lat: number, lng: number) => void
}

const botaoFlutuante: React.CSSProperties = {
  background: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)', color: '#111827',
}

export default function MiniMapaConfirmar({ enderecoInicial = '', onConfirmar }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaObj = useRef<Leaflet.Map | null>(null)
  const tileAtual = useRef<Leaflet.TileLayer | null>(null)
  const leafletObj = useRef<typeof Leaflet | null>(null)
  const iniciado = useRef(false)

  const [satelite, setSatelite] = useState(false)
  const [endereco, setEndereco] = useState(enderecoInicial)
  const [buscando, setBuscando] = useState(false)
  const [obtendoGps, setObtendoGps] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!mapRef.current || iniciado.current) return
    iniciado.current = true

    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.setAttribute('data-leaflet-css', 'true')
      document.head.appendChild(link)
    }

    import('leaflet').then((L) => {
      const mapa = L.map(mapRef.current!, { zoomControl: false }).setView([FRUTAL_LAT, FRUTAL_LNG], ZOOM_CIDADE)
      const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
      tile.addTo(mapa)
      tileAtual.current = tile
      mapaObj.current = mapa
      leafletObj.current = L
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function alternarCamada() {
    if (!mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    if (tileAtual.current) tileAtual.current.remove()
    const novo = !satelite
    const t = novo
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
    t.addTo(mapaObj.current)
    tileAtual.current = t
    setSatelite(novo)
  }

  async function buscarEndereco() {
    if (!endereco.trim() || buscando) return
    setBuscando(true)
    setAviso('')
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
          setAviso('Esse endereço parece ficar fora de Frutal-MG. Arraste o mapa até o local certo.')
          return
        }
        mapaObj.current.setView([lat, lng], ZOOM_ENCONTRADO)
      } else {
        setAviso('Não encontramos esse endereço automaticamente. Arraste o mapa até o local certo.')
      }
    } catch {
      setAviso('Não encontramos esse endereço automaticamente. Arraste o mapa até o local certo.')
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
        setObtendoGps(false)
      },
      () => setObtendoGps(false),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  function confirmar() {
    if (!mapaObj.current || !endereco.trim()) return
    const c = mapaObj.current.getCenter()
    onConfirmar(endereco.trim(), c.lat, c.lng)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Pino central fixo */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 500, pointerEvents: 'none' }}>
        <svg width="28" height="35" viewBox="0 0 32 40" fill="none">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.4 23.04 15.04 23.573a1.333 1.333 0 001.92 0C17.6 39.04 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#4256c8" />
          <circle cx="16" cy="16" r="7" fill="white" />
        </svg>
      </div>

      {/* Barra de busca flutuante */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1000, display: 'flex', alignItems: 'center', background: 'white', borderRadius: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.25)', padding: '4px' }}>
        <input
          type="text"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
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

      {/* Aviso flutuante, abaixo da busca */}
      {aviso && (
        <div style={{ position: 'absolute', top: '54px', left: '10px', right: '10px', zIndex: 999, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: '#92400e', boxShadow: '0 1px 6px rgba(0,0,0,0.2)' }}>
          {aviso}
        </div>
      )}

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

      {/* Confirmar, centralizado embaixo */}
      <button type="button" onClick={confirmar} disabled={!endereco.trim()}
        style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: endereco.trim() ? '#4256c8' : '#9ca3af', color: 'white', border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: endereco.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', boxShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>
        Confirmar
      </button>
    </div>
  )
}
