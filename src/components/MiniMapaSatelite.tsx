'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

const FRUTAL_LAT = -20.0234
const FRUTAL_LNG = -48.9338
const ZOOM = 14

export default function MiniMapaSatelite({ height = 200 }: { height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    let isMounted = true

    async function init() {
      const L = await import('leaflet')
      if (!isMounted || !containerRef.current || mapaRef.current) return

      // CSS do leaflet
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const mapa = L.map(containerRef.current, {
        center: [FRUTAL_LAT, FRUTAL_LNG],
        zoom: ZOOM,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      })

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri' }
      ).addTo(mapa)

      mapaRef.current = mapa

      // Busca demandas do banco
      const supabase = createClient()
      const { data: demandas } = await supabase
        .from('demandas')
        .select('lat, lng, categoria:categorias_mapa(cor)')
        .in('status', ['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida'])
        .eq('oculto', false)

      if (!isMounted || !demandas) return

      demandas.forEach((d: { lat: number; lng: number; categoria?: { cor?: string } | null }) => {
        const cor = d.categoria?.cor || '#4256c8'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:${cor};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        })
        L.marker([d.lat, d.lng], { icon }).addTo(mapa)
      })
    }

    init()

    return () => {
      isMounted = false
      if (mapaRef.current) {
        ;(mapaRef.current as { remove: () => void }).remove()
        mapaRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
