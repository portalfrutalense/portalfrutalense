'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl'

export const FRUTAL_LAT = -20.02752
export const FRUTAL_LNG = -48.92702

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const TILE_SATELITE = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const TILE_SATELITE_RUAS = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`

const ZOOM_SATELITE_RUAS = 16 // exibe nomes de ruas no satélite apenas a partir deste zoom

// [oeste, sul], [leste, norte] — MapLibre usa [lng, lat], diferente do par
// [lat, lng] que o Leaflet usava aqui antes.
const LIMITES_FRUTAL: [[number, number], [number, number]] = [[-49.30, -20.1529], [-48.73, -19.8869]]

const FONTE_SATELITE = 'satelite'
const CAMADA_SATELITE = 'satelite-camada'

/**
 * Mapa MapLibre GL base, compartilhado por todas as camadas (demandas, pets,
 * classificados, empregos). O mapa é criado uma única vez: trocar de camada
 * apenas troca os markers, preservando posição, zoom e os tiles já baixados.
 *
 * O mapa é sempre satélite — a partir do zoom 16 entra a variante com nomes
 * de rua. Não há modo de ruas puro nem alternância. Diferente do Leaflet (só
 * 2D), o MapLibre roda em WebGL com câmera 3D: inclinação (pitch) e rotação
 * (bearing) ficam livres para o usuário ajustar por gesto — arrastar com o
 * botão direito (ou Ctrl+arrastar) no desktop, girar/deslizar com dois dedos
 * no touch — sem nenhum controle extra de UI adicionado aqui.
 */
export function useMapaBase() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaIniciado = useRef(false)
  const mapaObj = useRef<MapLibreMap | null>(null)
  const maplibreObj = useRef<typeof import('maplibre-gl') | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const [mapaCarregado, setMapaCarregado] = useState(false)

  useEffect(() => {
    if (!mapRef.current || mapaIniciado.current) return
    mapaIniciado.current = true

    // Dedupe — sem isso, cada montagem deste hook (ex.: navegar pra fora do
    // /mapa e voltar) empilhava uma nova tag <link> igual no <head>.
    if (!document.querySelector('link[data-maplibre-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css'
      link.setAttribute('data-maplibre-css', 'true')
      document.head.appendChild(link)
    }

    import('maplibre-gl').then((maplibregl) => {
      if (!mapRef.current) return

      const mapa = new maplibregl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {
            [FONTE_SATELITE]: {
              type: 'raster',
              tiles: [TILE_SATELITE],
              tileSize: 256,
              attribution: '© Mapbox',
            },
          },
          layers: [{ id: CAMADA_SATELITE, type: 'raster', source: FONTE_SATELITE }],
        },
        center: [FRUTAL_LNG, FRUTAL_LAT],
        zoom: window.innerWidth < 768 ? 13 : 14,
        minZoom: 13,
        maxZoom: 18,
        maxBounds: LIMITES_FRUTAL,
        attributionControl: false,
      })

      mapa.on('load', () => {
        mapaObj.current = mapa
        maplibreObj.current = maplibregl
        setMapaCarregado(true)
      })

      // Assenta em zoom inteiro ao parar de mexer — tile de satélite é uma
      // imagem de resolução fixa por nível de zoom; num zoom fracionário
      // (ex: 16.7), o MapLibre pega o tile do nível inteiro mais próximo e
      // estica ele via GPU pra caber, o que borra a imagem visivelmente,
      // mesmo sem inclinação nenhuma. O Leaflet evitava isso saltando pra um
      // grupo de só 5 níveis fixos (13/14/15/16/18, nem o 17 tinha) — só que
      // isso deixava o gesto de zoom brusco/travado. Aqui assenta em
      // QUALQUER zoom inteiro (granularidade bem mais fina), então o gesto
      // continua suave enquanto o usuário mexe, e só "trava" pro nível
      // inteiro mais próximo quando ele solta — sem o borrão de fractional
      // zoom parado, sem o salto brusco de poucos níveis esparsos.
      mapa.on('zoomend', () => {
        const z = mapa.getZoom()
        const inteiro = Math.round(z)
        if (Math.abs(z - inteiro) > 0.01) {
          mapa.setZoom(inteiro)
          return // o próximo zoomend cuida da troca satélite/ruas
        }
        const fonte = mapa.getSource(FONTE_SATELITE) as RasterTileSource | undefined
        if (!fonte) return
        const precisaRuas = inteiro >= ZOOM_SATELITE_RUAS
        const temRuas = (fonte.tiles?.[0] || '').includes('satellite-streets')
        if (precisaRuas === temRuas) return
        fonte.setTiles([precisaRuas ? TILE_SATELITE_RUAS : TILE_SATELITE])
      })

      // Corrige o mapa esticando quando o tamanho do container muda
      const resizeObserver = new ResizeObserver(() => mapa.resize())
      resizeObserver.observe(mapRef.current)
      resizeObserverRef.current = resizeObserver
    })

    return () => {
      resizeObserverRef.current?.disconnect()
      // Sem isso, sair de /mapa e voltar deixava a instância antiga do
      // MapLibre (e seus listeners internos) sem ser destruída — só o DOM
      // que ela usava sumia, removido pelo React junto do componente.
      mapaObj.current?.remove()
      mapaObj.current = null
      maplibreObj.current = null
    }
  }, [])

  return { mapRef, mapaObj, maplibreObj, mapaCarregado }
}
