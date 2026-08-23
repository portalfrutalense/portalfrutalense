'use client'

import { useEffect, useRef } from 'react'

const FRUTAL_LAT = -20.0234
const FRUTAL_LNG = -48.9338
const ZOOM = 14

export default function MiniMapaSatelite({ height = 200 }: { height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    let isMounted = true

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current || mapaRef.current) return

      // Importa CSS do leaflet
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
    })

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
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
