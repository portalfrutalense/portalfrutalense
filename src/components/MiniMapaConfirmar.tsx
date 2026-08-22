'use client'

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'

interface Props {
  latInicial: number
  lngInicial: number
  onConfirmar: (lat: number, lng: number) => void
}

export default function MiniMapaConfirmar({ latInicial, lngInicial, onConfirmar }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaObj = useRef<Leaflet.Map | null>(null)
  const tileAtual = useRef<Leaflet.TileLayer | null>(null)
  const leafletObj = useRef<typeof Leaflet | null>(null)
  const iniciado = useRef(false)
  const [satelite, setSatelite] = useState(false)

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
      const mapa = L.map(mapRef.current!, { zoomControl: true }).setView([latInicial, lngInicial], 17)
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

  function confirmar() {
    if (!mapaObj.current) return
    const c = mapaObj.current.getCenter()
    onConfirmar(c.lat, c.lng)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button type="button" onClick={alternarCamada}
        style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1001, background: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', color: '#111827', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
        {satelite ? '🗺 Mapa' : '🛰 Satélite'}
      </button>
      <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none' }}>
          <svg width="28" height="35" viewBox="0 0 32 40" fill="none">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.4 23.04 15.04 23.573a1.333 1.333 0 001.92 0C17.6 39.04 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#4256c8" />
            <circle cx="16" cy="16" r="7" fill="white" />
          </svg>
        </div>
        <button type="button" onClick={confirmar}
          style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: '#4256c8', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          Confirmar localização
        </button>
      </div>
    </div>
  )
}
