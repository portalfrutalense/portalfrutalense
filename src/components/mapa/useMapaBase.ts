'use client'

import { useEffect, useRef, useState } from 'react'

export const FRUTAL_LAT = -20.02752
export const FRUTAL_LNG = -48.92702

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const TILE_SATELITE = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const TILE_SATELITE_RUAS = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const TILE_RUA = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`

const ZOOM_SATELITE_RUAS = 16 // exibe nomes de ruas no satélite apenas a partir deste zoom
const ZOOM_NIVEIS = [13, 14, 15, 16, 18] // níveis permitidos — zoom salta direto entre eles

function snapZoom(z: number): number {
  return ZOOM_NIVEIS.reduce((prev, curr) => Math.abs(curr - z) < Math.abs(prev - z) ? curr : prev)
}

/**
 * Mapa Leaflet base, compartilhado por todas as camadas (demandas, pets,
 * classificados, empregos). O mapa é criado uma única vez: trocar de camada
 * apenas troca os markers, preservando posição, zoom e os tiles já baixados.
 */
export function useMapaBase() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaIniciado = useRef(false)
  const mapaObj = useRef<any>(null)
  const leafletObj = useRef<any>(null)
  const tileAtual = useRef<any>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const sateliteRef = useRef(true)

  const [mapaCarregado, setMapaCarregado] = useState(false)
  const [satelite, setSatelite] = useState(true)

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

      const mapa = L.map(mapRef.current!, {
        zoomControl: false,
        maxBounds: [[-20.1529, -49.30], [-19.8869, -48.73]],
        maxBoundsViscosity: 1.0,
        minZoom: 13,
        maxZoom: 18,
      }).setView([FRUTAL_LAT, FRUTAL_LNG], 14)

      const tile = L.tileLayer(TILE_SATELITE, { attribution: '© Mapbox', maxZoom: 18 })
      tile.addTo(mapa)
      tileAtual.current = tile
      mapaObj.current = mapa
      leafletObj.current = L
      setMapaCarregado(true)

      // Snap para níveis permitidos + troca satélite/ruas conforme zoom
      mapa.on('zoomend', () => {
        const z = mapa.getZoom()
        const snapped = snapZoom(z)
        if (z !== snapped) {
          mapa.setZoom(snapped, { animate: false })
          return // o próximo zoomend cuida do resto
        }
        if (!sateliteRef.current) return
        const urlAtual = (tileAtual.current as any)?._url as string | undefined
        const precisaRuas = z >= ZOOM_SATELITE_RUAS
        const temRuas = urlAtual?.includes('satellite-streets')
        if (precisaRuas && !temRuas) {
          tileAtual.current?.remove()
          const novoTile = L.tileLayer(TILE_SATELITE_RUAS, { attribution: '© Mapbox', maxZoom: 18 })
          novoTile.addTo(mapa)
          tileAtual.current = novoTile
        } else if (!precisaRuas && temRuas) {
          tileAtual.current?.remove()
          const novoTile = L.tileLayer(TILE_SATELITE, { attribution: '© Mapbox', maxZoom: 18 })
          novoTile.addTo(mapa)
          tileAtual.current = novoTile
        }
      })

      // Corrige o mapa esticando quando o tamanho do container muda
      const resizeObserver = new ResizeObserver(() => mapa.invalidateSize())
      resizeObserver.observe(mapRef.current!)
      resizeObserverRef.current = resizeObserver
    })

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [])

  function alternarCamadaTile() {
    if (!mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    if (tileAtual.current) tileAtual.current.remove()
    const novoSatelite = !satelite
    sateliteRef.current = novoSatelite
    let tile
    if (novoSatelite) {
      const z = mapaObj.current.getZoom()
      const url = z >= ZOOM_SATELITE_RUAS ? TILE_SATELITE_RUAS : TILE_SATELITE
      tile = L.tileLayer(url, { attribution: '© Mapbox', maxZoom: 18 })
    } else {
      tile = L.tileLayer(TILE_RUA, { attribution: '© Mapbox © OpenStreetMap', maxZoom: 18 })
    }
    tile.addTo(mapaObj.current)
    tileAtual.current = tile
    setSatelite(novoSatelite)
  }

  return { mapRef, mapaObj, leafletObj, mapaCarregado, satelite, alternarCamadaTile }
}
